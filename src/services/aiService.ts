import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { logger } from "../lib/logger.js";
import { initDb } from "../db.js";
import { runAgentLoop } from "./agentLoop.js";
import { executeTool } from "./toolRegistry.js";
import { adminTools } from "../tools/adminTools.js";
import { customerTools } from "../tools/customerTools.js";

interface AIResponse {
  text: string;
  keyUsed: string;
}

export const ADMIN_SYSTEM_PROMPT = `You are the ultimate autonomous agent and assistant for the System / Platform Administrator of WhatXpress. You manage restaurants (tenants), plans, metrics, dining tables, kitchen orders, menu options, and discount coupons. Understand the user intent and use functions to act. Always be helpful, concise and confirm the actions you have taken. If a user (restaurant owner) texts you asking for support, answer their questions based on common sense software platform support.`;

export async function buildCashierSystemPrompt(aiConfig: any, tenantId: string): Promise<string> {
  const db = await initDb();
  const settings = await db.get("SELECT currency_symbol FROM tenant_settings WHERE tenant_id = ?", [tenantId]);
  const currencySymbol = settings?.currency_symbol || "$";
  return `Eres el Agente Virtual de Ventas y Cajero Automático del restaurante.
Te comportas como un empleado humano excelente, muy amable, carismático y eficiente. No suenas como un robot rígido.
Tu objetivo principal es tomar pedidos de los clientes, responder preguntas del menú y resolver dudas de manera natural.

REGLAS CLAVE:
1. Siempre debes responder en el MISMO idioma que te hable el cliente (si te habla en español, respondes en español; si en inglés, en inglés).
2. Tienes acceso a herramientas interactivas (las funciones "consultar_menu", "consultar_detalles_platillo", etc.) para leer y escribir datos en el sistema del restaurante en tiempo real. ¡Úsalas libremente cuando el usuario te pregunte o confirme algo!
3. El símbolo de moneda del restaurante es: ${currencySymbol}.
4. Si el cliente confirma su orden, debes llamar a "registrar_pedido_pos" para guardarla oficialmente.
5. Instrucciones personalizadas del dueño del restaurante:
${aiConfig?.custom_instructions || "Atiende amablemente a los clientes."}
`;
}

export async function loadAdminHistory(): Promise<any[]> {
  return [];
}

export async function getAiClient(): Promise<GoogleGenAI> {
  const db = await initDb();
  let keys = await db.all("SELECT * FROM api_pool WHERE status = 'healthy' ORDER BY last_used_at ASC");
  let activeKey: string | null = null;
  if (keys.length > 0) activeKey = keys[0].key_value;
  if (!activeKey) activeKey = process.env.GEMINI_API_KEY?.trim() || null;
  if (!activeKey) throw new Error("No API key available");
  return new GoogleGenAI({ apiKey: activeKey });
}

export async function processSystemAdminChat(message: string): Promise<string> {
  const ai = await getAiClient();
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: ADMIN_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: adminTools }],
    },
    history: await loadAdminHistory(),
  });
  // Cast to any: Gemini's GenerateContentResponse.functionCalls uses optional
  // FunctionCall.name while agentLoop's FunctionCall requires it. The shapes
  // are structurally compatible at runtime.
  return runAgentLoop(chat as any, { message }, adminTools, executeTool, {
    tenantId: "system_admin",
  });
}

export async function processCustomerWhatsAppChat(tenantId: string, customerPhone: string, customerName: string, message: string, history: any[]): Promise<string> {
  const ai = await getAiClient();
  const db = await initDb();
  const aiConfig = await db.get("SELECT * FROM ai_config WHERE tenant_id = ?", [tenantId]);
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: await buildCashierSystemPrompt(aiConfig, tenantId),
      tools: [{ functionDeclarations: customerTools }],
    },
    history,
  });
  return runAgentLoop(chat as any, { message }, customerTools, executeTool, {
    tenantId,
    phone: customerPhone,
  });
}

export async function generateAIContent(prompt: string, systemInstruction: string, imageBase64?: string, history?: any[], jsonMode?: boolean): Promise<AIResponse> {
  const db = await initDb();

  // Get all healthy keys, prioritized by last_used_at (FIFO to balance usage)
  let keys = await db.all("SELECT * FROM api_pool WHERE status = 'healthy' ORDER BY last_used_at ASC");

  if (keys.length === 0) {
    // If no healthy keys in pool, fallback to ENV
    const envKey = process.env.GEMINI_API_KEY?.trim();
    if (!envKey || envKey === "MY_GEMINI_API_KEY" || envKey.includes(" ")) {
      throw new Error("No available API keys in pool and no valid fallback key configured.");
    }
    keys = [{ key_value: envKey, id: 'env-fallback' }];
  }

  for (let i = 0; i < keys.length; i++) {
    const keyRecord = keys[i];
    const apiKey = keyRecord.key_value;

    try {
      const ai = new GoogleGenAI({ apiKey });

      const contents: any[] = [];
      if (history && history.length > 0) {
        contents.push(...history);
      }

      if (prompt) {
        if (imageBase64) {
          if (!imageBase64.startsWith("data:image/")) {
            throw new Error("El formato de imagen no está soportado. Por favor, suba una imagen válida en formato Base64.");
          }
          const matches = imageBase64.match(/^data:(image\/[a-zA-Z]*);base64,([^\"]*)$/);
          if (matches && matches.length === 3) {
            contents.push({
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: matches[1],
                    data: matches[2]
                  }
                }
              ]
            });
          } else {
            throw new Error("Error al decodificar la imagen en Base64.");
          }
        } else {
          contents.push({ role: 'user', parts: [{ text: prompt }] });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          ...(jsonMode ? { responseMimeType: "application/json" } : {})
        }
      });

      const reply = response.text;

      // Update last_used_at for successfully used database keys
      if (keyRecord.key_value && keyRecord.id !== 'env-fallback') {
        await db.run("UPDATE api_pool SET last_used_at = CURRENT_TIMESTAMP, fail_count = 0 WHERE key_value = ?", [keyRecord.key_value]);
      }

      return {
        text: reply || "I am currently unable to answer. Please try again.",
        keyUsed: apiKey.substring(0, 10) + "..."
      };

    } catch (error: any) {
      const errorMessage = error.message || "";
      logger.error({ err: errorMessage, key: apiKey.substring(0, 8) }, "[AI] API key error");

      if (keyRecord.key_value && keyRecord.id !== 'env-fallback') {
        const isInvalid = errorMessage.includes("API key not valid") || errorMessage.includes("INVALID_ARGUMENT");
        const isRateLimited = errorMessage.includes("429") || errorMessage.includes("RESOURCES_EXHAUSTED");

        if (isInvalid) {
          await db.run("UPDATE api_pool SET status = 'invalid', fail_count = fail_count + 1 WHERE key_value = ?", [keyRecord.key_value]);
        } else if (isRateLimited) {
          await db.run("UPDATE api_pool SET status = 'rate_limited', fail_count = fail_count + 1 WHERE key_value = ?", [keyRecord.key_value]);
        } else {
          // General failure, increment fail count
          await db.run("UPDATE api_pool SET fail_count = fail_count + 1 WHERE key_value = ?", [keyRecord.key_value]);
        }
      }

      // If it was the last key, re-throw
      if (i === keys.length - 1) {
        throw new Error(`AI failed with all available keys. Last error: ${errorMessage}`);
      }

      // Continue to next key in pool
      logger.info("[AI] Rotating to next available API key");
    }
  }

  throw new Error("Critical failure in AI rotation logic.");
}

export async function startAPIKeyHealthChecker() {
  logger.info("[AI] Starting API Key Health Checker background interval...");
  setInterval(async () => {
    try {
      const db = await initDb();
      const keys = await db.all("SELECT * FROM api_pool WHERE status IN ('rate_limited', 'invalid')");
      for (const keyRecord of keys) {
        try {
          const ai = new GoogleGenAI({ apiKey: keyRecord.key_value });
          await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "test",
            config: { maxOutputTokens: 1 }
          });
          // If it succeeds, restore status to healthy and reset fail count
          await db.run("UPDATE api_pool SET status = 'healthy', fail_count = 0 WHERE key_value = ?", [keyRecord.key_value]);
          logger.info({ key: keyRecord.key_value.substring(0, 10) }, "[AI] API Key restored to healthy");
        } catch (err) {
          // Still failing, leave as is
        }
      }
    } catch (e) {
      logger.error({ err: e }, "[AI] Background health checker error");
    }
  }, 30 * 60 * 1000); // Every 30 minutes
}