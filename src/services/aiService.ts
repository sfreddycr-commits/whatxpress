import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { logger } from "../lib/logger.js";
import { initDb } from "../db.js";

interface AIResponse {
  text: string;
  keyUsed: string;
}

export async function processSystemAdminChat(message: string): Promise<string> {
  const db = await initDb();
  let keys = await db.all("SELECT * FROM api_pool WHERE status = 'healthy' ORDER BY last_used_at ASC");
  let activeKey = null;
  if (keys.length > 0) activeKey = keys[0].key_value;
  if (!activeKey) activeKey = process.env.GEMINI_API_KEY?.trim();
  if (!activeKey) throw new Error("No API key available");
  
  const ai = new GoogleGenAI({ apiKey: activeKey });
  
  const listTenants: FunctionDeclaration = {
    name: 'list_tenants',
    description: 'Lists all registered restaurants/tenants on the platform.',
    parameters: { type: Type.OBJECT, properties: {} }
  };

  const getMetrics: FunctionDeclaration = {
    name: 'get_metrics',
    description: 'Gets global platform metrics (ARR, total tenants).',
    parameters: { type: Type.OBJECT, properties: {} }
  };
  
  const createTenant: FunctionDeclaration = {
    name: 'create_tenant',
    description: 'Creates a new restaurant/tenant.',
    parameters: { 
      type: Type.OBJECT, 
      properties: {
         name: { type: Type.STRING, description: 'Name of the restaurant' },
         plan: { type: Type.STRING, description: 'Plan to assign (e.g. Starter, Pro)' }
      },
      required: ['name', 'plan']
    }
  };

  const createPlan: FunctionDeclaration = {
    name: 'create_plan',
    description: 'Creates a new subscription plan for the platform.',
    parameters: { 
      type: Type.OBJECT, 
      properties: {
         id: { type: Type.STRING, description: 'Unique identifier for the plan (e.g., enterprise)' },
         name: { type: Type.STRING, description: 'Display name of the plan' },
         price: { type: Type.NUMBER, description: 'Monthly price in USD' },
         max_orders: { type: Type.NUMBER, description: 'Maximum orders allowed' }
      },
      required: ['id', 'name', 'price', 'max_orders']
    }
  };

  const updateTenantPlan: FunctionDeclaration = {
    name: 'update_tenant_plan',
    description: 'Updates the subscription plan of an existing tenant.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         identifier: { type: Type.STRING, description: 'ID or Name of the restaurant to update' },
         new_plan: { type: Type.STRING, description: 'Name of the new plan' }
      },
      required: ['identifier', 'new_plan']
    }
  };

  const suspendTenant: FunctionDeclaration = {
    name: 'suspend_tenant',
    description: 'Suspends an existing tenant by ID or Name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         identifier: { type: Type.STRING, description: 'ID or Name of the restaurant to suspend' }
      },
      required: ['identifier']
    }
  };

  const createTable: FunctionDeclaration = {
    name: 'create_table',
    description: 'Creates a physical dining table for a restaurant and generates its QR code.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         tenant_id: { type: Type.STRING, description: 'ID of the restaurant' },
         table_number: { type: Type.STRING, description: 'Table number or name, e.g. Mesa 4' },
         capacity: { type: Type.NUMBER, description: 'Seating capacity of the table, e.g. 4' }
      },
      required: ['tenant_id', 'table_number']
    }
  };

  const addDishVariant: FunctionDeclaration = {
    name: 'add_dish_variant',
    description: 'Adds customized attributes/variants (e.g. Size, Spiciness) to a menu item.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         menu_item_id: { type: Type.STRING, description: 'The ID of the dish to customize' },
         name: { type: Type.STRING, description: 'Name of the variant, e.g. Size' },
         options: { type: Type.STRING, description: 'JSON array of options, e.g. ["Small", "Medium", "Large"]' }
      },
      required: ['menu_item_id', 'name', 'options']
    }
  };

  const updateKitchenOrderStatus: FunctionDeclaration = {
    name: 'update_kitchen_order_status',
    description: 'Updates the prep state of a kitchen order (Pending, Preparing, Ready).',
    parameters: {
      type: Type.OBJECT,
      properties: {
         kitchen_order_id: { type: Type.STRING, description: 'The unique ID of the kitchen order' },
         status: { type: Type.STRING, description: 'The new status, e.g. Preparing or Ready' }
      },
      required: ['kitchen_order_id', 'status']
    }
  };

  const applyPromoCoupon: FunctionDeclaration = {
    name: 'apply_promo_coupon',
    description: 'Validates and applies a coupon code to a customer order.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         tenant_id: { type: Type.STRING, description: 'The unique ID of the restaurant/tenant' },
         code: { type: Type.STRING, description: 'The coupon code, e.g. PROMO2026' },
         subtotal: { type: Type.NUMBER, description: 'The current order subtotal before discount' }
      },
      required: ['tenant_id', 'code', 'subtotal']
    }
  };

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
       systemInstruction: 'You are the ultimate autonomous agent and assistant for the System / Platform Administrator of WhatXpress. You manage restaurants (tenants), plans, metrics, dining tables, kitchen orders, menu options, and discount coupons. Understand the user intent and use functions to act. Always be helpful, concise and confirm the actions you have taken. If a user (restaurant owner) texts you asking for support, answer their questions based on common sense software platform support.',
       tools: [{ functionDeclarations: [listTenants, getMetrics, createTenant, suspendTenant, createPlan, updateTenantPlan, createTable, addDishVariant, updateKitchenOrderStatus, applyPromoCoupon] }]
    }
  });
  
  const response = await chat.sendMessage({ message });
  let finalReply = response.text || "";
  
  if (response.functionCalls && response.functionCalls.length > 0) {
     for (const call of response.functionCalls) {
        let resultInfo = "";
        if (call.name === 'list_tenants') {
           const tenants = await db.all('SELECT id, name, status, plan, mrr FROM tenants LIMIT 10');
           resultInfo = "Restaurants: " + JSON.stringify(tenants);
        } else if (call.name === 'get_metrics') {
           const tenants = await db.all('SELECT id, status, mrr FROM tenants');
           const active = tenants.filter((t: any) => t.status === 'Active').length;
           const totalARR = tenants.reduce((acc: number, t: any) => acc + ((t.mrr || 0) * 12), 0);
           resultInfo = `Total Active Tenants: ${active}, Total Platform ARR: $${totalARR}`;
        } else if (call.name === 'create_tenant') {
           const args: any = call.args;
           const tenantId = "tenant_" + Math.random().toString(36).substr(2, 9);
           const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
           await db.run(
              "INSERT INTO tenants (id, name, status, plan, mrr, bg_color, init_letters, trial_ends_at, subscription_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [tenantId, args.name, 'Active', args.plan, args.plan === 'Pro' ? 99 : 29, 'bg-blue-100 text-blue-600', args.name.substring(0, 2).toUpperCase(), trialEndDate, 'trialing']
           );
           resultInfo = `Tenant ${args.name} created successfully with ID ${tenantId}.`;
        } else if (call.name === 'suspend_tenant') {
           const args: any = call.args;
           await db.run("UPDATE tenants SET status = 'Suspended' WHERE id = ? OR name LIKE ?", [args.identifier, `%${args.identifier}%`]);
           resultInfo = `Tenant with identifier ${args.identifier} has been suspended (if it existed).`;
        } else if (call.name === 'create_plan') {
           const args: any = call.args;
           const features = ["Autogestión de Menú Virtual", "Recepción de Pedidos Multicanal", "Soporte Standard"];
           await db.run(
              "INSERT OR REPLACE INTO plans (id, name, price, interval, max_orders, features, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [args.id, args.name, args.price, 'monthly', args.max_orders, JSON.stringify(features), 0]
           );
           resultInfo = `Plan ${args.name} created successfully with price $${args.price}.`;
        } else if (call.name === 'update_tenant_plan') {
           const args: any = call.args;
           await db.run("UPDATE tenants SET plan = ? WHERE id = ? OR name LIKE ?", [args.new_plan, args.identifier, `%${args.identifier}%`]);
           resultInfo = `Tenant matching '${args.identifier}' had its plan upgraded/updated to ${args.new_plan}.`;
        } else if (call.name === 'create_table') {
           const args: any = call.args;
           const tableId = "table_" + Math.random().toString(36).substr(2, 9);
           const qrUrl = `/menu/${args.tenant_id}?table=${args.table_number}`;
           await db.run(
              "INSERT INTO dining_tables (id, tenant_id, table_number, capacity, qr_code_url, status) VALUES (?, ?, ?, ?, ?, ?)",
              [tableId, args.tenant_id, args.table_number, args.capacity || 4, qrUrl, 'Available']
           );
           resultInfo = `Table ${args.table_number} created successfully with QR url ${qrUrl}.`;
        } else if (call.name === 'add_dish_variant') {
           const args: any = call.args;
           const attrId = "opt_" + Math.random().toString(36).substr(2, 9);
           await db.run(
              "INSERT INTO item_attributes (id, menu_item_id, name, options) VALUES (?, ?, ?, ?)",
              [attrId, args.menu_item_id, args.name, args.options]
           );
           resultInfo = `Variant ${args.name} with options ${args.options} added to menu item ${args.menu_item_id}.`;
        } else if (call.name === 'update_kitchen_order_status') {
           const args: any = call.args;
           await db.run("UPDATE kitchen_orders SET status = ? WHERE id = ?", [args.status, args.kitchen_order_id]);
           resultInfo = `Kitchen order ${args.kitchen_order_id} status updated to ${args.status}.`;
        } else if (call.name === 'apply_promo_coupon') {
            const args: any = call.args;
            const coupon = await db.get("SELECT * FROM tenant_coupons WHERE tenant_id = ? AND code = ? AND status = 'Active'", [args.tenant_id, args.code]);
            if (!coupon) {
              resultInfo = `El cupón '${args.code}' no existe o está inactivo.`;
            } else {
              const today = new Date().toISOString().split('T')[0];
              if (today < coupon.start_date || today > coupon.end_date) {
                resultInfo = `El cupón '${args.code}' ha expirado.`;
              } else if (args.subtotal < coupon.minimum_order) {
                resultInfo = `El cupón '${args.code}' requiere una compra mínima de $${coupon.minimum_order}.`;
              } else {
                let discountAmount = coupon.discount_type === 'Percentage' ? (args.subtotal * coupon.discount) / 100 : coupon.discount;
                resultInfo = `Cupón '${args.code}' aplicado correctamente. Descuento calculado: $${discountAmount}.`;
              }
            }
         }
        
        const secondResponse = await chat.sendMessage([{
           functionResponse: {
             name: call.name,
             response: { result: resultInfo }
           }
        }]);
        finalReply = secondResponse.text || "Operación completada.";
     }
  }
  return finalReply;
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
            contents.push({ role: 'user', parts: [{ text: prompt }] });
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
