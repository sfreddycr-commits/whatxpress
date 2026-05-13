import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { generateAIContent } from './aiService.js';
import { logger } from '../lib/logger.js';
import { initDb } from '../db';

// Store ongoing connections. Exposed globally for the notification service.
const connections: Record<string, any> = {};
(global as any).__waConnections = connections;

// We use events to send QR codes to the client, or just a simple polling approach.
// For simplicity, we'll store the latest QR text per tenant.
const pendingQRs: Record<string, string | null> = {};

// Exponential backoff reconnection tracking
const reconnectAttempts: Record<string, number> = {};
const MAX_BACKOFF_MS = 60000; // 60 seconds max
const BASE_BACKOFF_MS = 3000; // 3 seconds base

const customerQueues: Record<string, Promise<void>> = {};

const authFolder = path.join(process.cwd(), 'whatsapp_auth');

if (!fs.existsSync(authFolder)) {
  fs.mkdirSync(authFolder, { recursive: true });
}

export async function getWhatsAppStatus(tenantId: string) {
  if (connections[tenantId]) {
    return { status: 'connected' };
  }
  
  if (pendingQRs[tenantId]) {
    const qrDataUrl = await QRCode.toDataURL(pendingQRs[tenantId] as string);
    return { status: 'qr_ready', qr: qrDataUrl };
  }
  
  const tenantAuthFolder = path.join(authFolder, tenantId);
  if (fs.existsSync(tenantAuthFolder) && fs.readdirSync(tenantAuthFolder).length > 0) {
    // Credentials exist but not connected in memory. Probably a server restart. Auto-reconnect.
    connectWhatsApp(tenantId);
    return { status: 'connecting' };
  }
  
  return { status: 'disconnected' };
}

// --- Order Detection via AI ---
async function detectAndCreateOrder(tenantId: string, customerMessage: string, aiReply: string, menuItems: any[], db: any): Promise<{ ordered: boolean; orderId?: string; confirmationText?: string }> {
  try {
    // Build menu lookup for the AI
    const menuByName: Record<string, { id: string; price: number }> = {};
    for (const item of menuItems) {
      menuByName[item.name.toLowerCase()] = { id: item.id, price: item.price };
    }

    // Simple keyword detection first (fast path)
    const lowerReply = aiReply.toLowerCase();
    const orderKeywords = ['confirmo', 'confirmo tu pedido', 'pedido confirmado', 'your order is confirmed', 'order confirmed',
                           'pedido recibido', 'your order', 'procesando pedido', 'processing your order'];

    const hasOrderConfirmation = orderKeywords.some(kw => lowerReply.includes(kw));

    // Also check if the AI mentioned specific items being ordered
    const mentionedItems = menuItems.filter(item =>
      lowerReply.includes(item.name.toLowerCase()) ||
      lowerReply.includes(item.name.toLowerCase().split(' ')[0])
    );

    if (!hasOrderConfirmation && mentionedItems.length === 0) {
      return { ordered: false };
    }

    // Use AI to extract order details from the conversation
    const menuList = menuItems.map(i => `- "${i.name}" (ID: ${i.id}, Price: $${i.price})`).join('\n');

    const ai = new (await import("@google/genai")).GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    const extractPrompt = `You are an order extraction system. Given a restaurant menu and a conversation, extract the ordered items.

Menu:
${menuList}

AI RESPONSE to customer:
"${aiReply}"

Customer message:
"${customerMessage}"

Your task: Based on the AI response above, determine if the customer confirmed/ordered something. If yes, list the items ordered with quantities.

Respond ONLY in this JSON format (no other text):
{
  "ordered": true/false,
  "items": [{"name": "item name", "quantity": number}],
  "total": number
}

If no order was confirmed, respond: {"ordered": false, "items": [], "total": 0}`;

    let extractReply = '';
    try {
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ text: extractPrompt }],
        config: { systemInstruction: "You extract order information from restaurant conversations. Always respond with valid JSON only." }
      });
      extractReply = result.text || '';
    } catch (e) {
      logger.error({ err: e }, "[WhatsApp] Order extraction AI error");
      return { ordered: false };
    }

    // Parse JSON response
    let orderData;
    try {
      const jsonMatch = extractReply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        orderData = JSON.parse(jsonMatch[0]);
      } else {
        return { ordered: false };
      }
    } catch (e) {
      logger.warn({ reply: extractReply.substring(0, 100) }, "[WhatsApp] Could not parse order extraction response");
      return { ordered: false };
    }

    if (!orderData.ordered || !orderData.items || orderData.items.length === 0) {
      return { ordered: false };
    }

    // Calculate total
    let total = 0;
    const orderItems = [];
    for (const item of orderData.items) {
      const menuItem = menuItems.find(m => m.name.toLowerCase() === item.name.toLowerCase());
      if (menuItem) {
        const qty = item.quantity || 1;
        total += menuItem.price * qty;
        orderItems.push({ menu_item_id: menuItem.id, quantity: qty, price: menuItem.price });
      }
    }

    if (orderItems.length === 0) return { ordered: false };

    // Create the order
    const orderId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    await db.run("BEGIN TRANSACTION");
    try {
      await db.run(
        "INSERT INTO whatsapp_orders (id, tenant_id, items, total, status) VALUES (?, ?, ?, ?, ?)",
        [orderId, tenantId, JSON.stringify(orderItems), total, 'pending']
      );

      // Update metrics
      const currentMetrics = await db.get('SELECT today_sales, ai_orders_count FROM metrics WHERE tenant_id = ?', [tenantId]);
      if (currentMetrics) {
        await db.run(
          "UPDATE metrics SET today_sales = today_sales + ?, ai_orders_count = ai_orders_count + 1 WHERE tenant_id = ?",
          [total, tenantId]
        );
      }

      // Log to ai_logs
      await db.run(
        "INSERT INTO ai_logs (tenant_id, role, message, timestamp, automation_type) VALUES (?, ?, ?, ?, ?)",
        [tenantId, 'assistant', `Orden creada automáticamente: ${orderItems.length} producto(s), total $${total.toFixed(2)}`, new Date().toISOString(), 'order']
      );

      await db.run("COMMIT");
    } catch (inner) {
      await db.run("ROLLBACK");
      throw inner;
    }

    return {
      ordered: true,
      orderId,
      confirmationText: `✅ Pedido #${orderId.substring(0, 12)} confirmado. Total: $${total.toFixed(2)}. Lo recibiras pronto!`
    };

  } catch (err) {
    logger.error({ err }, "[WhatsApp] detectAndCreateOrder error");
    return { ordered: false };
  }
}


export async function initWhatsAppConnections() {
  logger.info("[WhatsApp] Initializing connections...");
  
  // Strategy 1: Load from DB state
  const db = await initDb();
  let activeTenants = new Set<string>();
  try {
    const rows = await db.all(`SELECT tenant_id FROM whatsapp_connections WHERE status = 'connected'`);
    rows.forEach((r: any) => activeTenants.add(r.tenant_id));
  } catch (e) {}

  // Strategy 2: Scan physical filesystem for existing session folders (Resilience fallback)
  try {
    if (fs.existsSync(authFolder)) {
      const folders = fs.readdirSync(authFolder);
      folders.forEach(folderName => {
        const fullPath = path.join(authFolder, folderName);
        if (fs.statSync(fullPath).isDirectory()) {
          // Quick check if folder contains multi-file auth data
          const files = fs.readdirSync(fullPath);
          if (files.length > 0) {
            activeTenants.add(folderName);
          }
        }
      });
    }
  } catch (e) {
    logger.error({ err: e }, "[WhatsApp] Error scanning auth folder");
  }

  logger.info({ tenantCount: activeTenants.size }, "[WhatsApp] Found existing session targets. Reconnecting...");

  for (const tenantId of activeTenants) {
    logger.info({ tenantId }, "[WhatsApp] Auto-connecting tenant session");
    connectWhatsApp(tenantId).catch(err => logger.error({ err, tenantId }, "[WhatsApp] Auto-connect failed"));
  }
}
export async function connectWhatsApp(tenantId: string) {
  if (connections[tenantId]) {
    return { status: 'already_connected' };
  }

  const tenantAuthFolder = path.join(authFolder, tenantId);
  const { state, saveCreds } = await useMultiFileAuthState(tenantAuthFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }) as any,
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false,
    generateHighQualityLinkPreview: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info({ tenantId }, "[WhatsApp] New QR generated");
      pendingQRs[tenantId] = qr;
    }

    if (connection === 'close') {
      const loggedOut = (lastDisconnect?.error as any)?.output?.statusCode === DisconnectReason.loggedOut;
      delete connections[tenantId];
      if (loggedOut) {
        logger.info({ tenantId }, "[WhatsApp] Tenant logged out, cleaning auth");
        delete reconnectAttempts[tenantId];
        if (fs.existsSync(tenantAuthFolder)) {
          fs.rmSync(tenantAuthFolder, { recursive: true, force: true });
        }
        delete pendingQRs[tenantId];
      } else {
        const attempts = (reconnectAttempts[tenantId] || 0) + 1;
        reconnectAttempts[tenantId] = attempts;
        const delay = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
        logger.warn({ tenantId, delay: delay/1000, attempts }, "[WhatsApp] Connection closed, reconnecting");
        setTimeout(function() { connectWhatsApp(tenantId); }, delay);
      }
    } else if (connection === 'open') {
      logger.info({ tenantId }, "[WhatsApp] Connected");
      connections[tenantId] = sock;
      delete pendingQRs[tenantId];
      delete reconnectAttempts[tenantId];
    }
  });

  // Keepalive ping every 60 seconds to detect stale connections
  const pingInterval = setInterval(async () => {
    try {
      await sock.sendPresenceUpdate('available');
    } catch {
      // Connection dead, clear interval (close handler will fire)
    }
  }, 60000);
  
  sock.ev.on('connection.update', (update) => {
    const { connection: conn2 } = update;
    if (conn2 === 'close') {
      clearInterval(pingInterval);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    for (const msg of m.messages) {
      if (!msg.key.fromMe && msg.message) {
        const customerPhone = msg.key.remoteJid!;
        const pushName = msg.pushName || '';
        
        // Cache contact info (name + profile picture)
        if (pushName || true) {
          try {
            const db = await initDb();
            let profilePicUrl = '';
            try {
              profilePicUrl = await sock.profilePictureUrl(customerPhone, 'image') || '';
            } catch (picErr) {
              // Some users have no profile pic or privacy settings block it
            }
            await db.run(
              `INSERT INTO whatsapp_contacts (tenant_id, phone, push_name, profile_pic_url, is_archived, updated_at)
               VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
               ON CONFLICT (tenant_id, phone) DO UPDATE SET
                 push_name = COALESCE(NULLIF(EXCLUDED.push_name, ''), whatsapp_contacts.push_name),
                 profile_pic_url = COALESCE(NULLIF(EXCLUDED.profile_pic_url, ''), whatsapp_contacts.profile_pic_url),
                 is_archived = 0,
                 updated_at = CURRENT_TIMESTAMP`,
              [tenantId, customerPhone, pushName, profilePicUrl]
            );
          } catch (contactErr) {
            // Non-critical, don't break message handling
          }
        }

        const currentQueue = customerQueues[customerPhone] || Promise.resolve();

        customerQueues[customerPhone] = currentQueue.then(async () => {
          try {
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            if (text) {
              logger.debug({ tenantId, message: text.substring(0, 50) }, "[WhatsApp] Message received");
              
              if (tenantId === 'system_admin') {
                const jid = msg.key.remoteJid!;
                if (!(global as any).systemAdminSessions) {
                  (global as any).systemAdminSessions = new Map<string, { state: 'none' | 'awaiting_email' | 'awaiting_password', email?: string, loggedIn: boolean }>();
                }
                const sessionMap = (global as any).systemAdminSessions;
                const session = sessionMap.get(jid) || { state: 'none', loggedIn: false };
                
                if (text.trim().toLowerCase() === '/login') {
                  session.state = 'awaiting_email';
                  session.loggedIn = false;
                  sessionMap.set(jid, session);
                  await sock.sendMessage(jid, { text: "Por favor, ingresa tu correo electrónico de administrador:" });
                } else if (session.state === 'awaiting_email') {
                  session.email = text.trim();
                  session.state = 'awaiting_password';
                  sessionMap.set(jid, session);
                  await sock.sendMessage(jid, { text: "Por favor, ingresa tu contraseña:" });
                } else if (session.state === 'awaiting_password') {
                  if (session.email === 'admin@whatxpress.com' && text.trim() === (process.env.WA_ADMIN_PASSWORD || 'admin123')) {
                    session.loggedIn = true;
                    session.state = 'none';
                    sessionMap.set(jid, session);
                    await sock.sendMessage(jid, { text: "✅ Inicio de sesión exitoso. Bienvenido, SuperAdmin. Has entrado al Modo Asistente de Administración." });
                  } else {
                    session.state = 'none';
                    sessionMap.set(jid, session);
                    await sock.sendMessage(jid, { text: "❌ Credenciales incorrectas. Inicio de sesión cancelado." });
                  }
                } else if (text.trim().toLowerCase() === '/logout' && session.loggedIn) {
                  session.loggedIn = false;
                  sessionMap.set(jid, session);
                  await sock.sendMessage(jid, { text: "Has cerrado sesión correctamente. Volviendo al modo de ventas." });
                } else {
                  if (session.loggedIn) {
                    const { processSystemAdminChat } = await import('./aiService.js');
                    const response = await processSystemAdminChat(text);
                    await sock.sendMessage(msg.key.remoteJid!, { text: response });
                  } else {
                    const { generateAIContent } = await import('./aiService.js');
                    const salesInstruction = `You are a sales and informational agent for WhatXpress, a SaaS platform that allows restaurants to manage orders, menus, and AI-powered WhatsApp ordering.
Be friendly, persuasive, and helpful. You explain features like multi-channel order receiving, automated WhatsApp agents for restaurants, and payment gateways.
If the user asks to login as administrator or owner of the platform tell them they can use the command "/login".
IMPORTANT: You MUST respond in the EXACT same language that the customer speaks to you.`;
                    const response = await generateAIContent(text, salesInstruction);
                    await sock.sendMessage(msg.key.remoteJid!, { text: response.text });
                  }
                }
              } else {
                const db = await initDb();
                const config = await db.get('SELECT * FROM ai_config WHERE tenant_id = ?', [tenantId]);
                const menuItems = await db.all('SELECT * FROM menu_items WHERE tenant_id = ?', [tenantId]);
                
                let menuText = menuItems.map((item: any) => `- "${item.name}" ($${item.price})`).join('\n');
                
                const systemInstruction = `You are an autonomous AI restaurant agent/seller for a restaurant. 
Behave like a natural human seller, not a strict robot. Engage the customer, be friendly, persuasive, and helpful.
IMPORTANT: You MUST respond in the EXACT same language that the customer speaks to you. If they speak Spanish, reply in Spanish. If English, reply in English.

Here is the restaurant menu:
${menuText}

Custom instructions from the restaurant owner:
${config ? config.custom_instructions : ''}

You MUST respond strictly in the following JSON format:
{
  "reply": "Friendly conversational message to send to the customer on WhatsApp",
  "order_detected": true,
  "items": [{"name": "item name matching the menu exactly", "quantity": number}]
}
If no order is confirmed yet, set order_detected to false and items to empty list. Respond with valid JSON only.`;

                // 1. Save incoming user message to history
                await db.run(
                  "INSERT INTO whatsapp_chat_history (tenant_id, customer_phone, role, message) VALUES (?, ?, 'user', ?)",
                  [tenantId, customerPhone, text]
                );

                // 2. Load previous history from db
                const historyRows = await db.all(
                  "SELECT role, message FROM whatsapp_chat_history WHERE tenant_id = ? AND customer_phone = ? ORDER BY created_at DESC LIMIT 10",
                  [tenantId, customerPhone]
                );
                const history = historyRows.reverse().map((row: any) => ({
                  role: row.role === 'user' ? 'user' : 'model',
                  parts: [{ text: row.message }]
                }));

                // 2.b Check if bot is paused by human operator
                const chatControl = await db.get(
                  "SELECT is_bot_active FROM whatsapp_chat_control WHERE tenant_id = ? AND customer_phone = ?",
                  [tenantId, customerPhone]
                );
                const isBotActive = chatControl ? chatControl.is_bot_active !== 0 : true;
                
                if (!isBotActive) {
                  logger.info({ tenantId, customerPhone }, "[WhatsApp] Chat intercepted by HUMAN, skipping AI.");
                  return; 
                }

                // 3. Call Gemini in JSON mode
                const aiResult = await generateAIContent(text, systemInstruction, undefined, history, true);
                
                let parsedResult;
                try {
                  const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
                  parsedResult = JSON.parse(jsonMatch ? jsonMatch[0] : aiResult.text);
                } catch (e) {
                  logger.error({ text: aiResult.text.substring(0, 100) }, "[WhatsApp] Failed to parse Gemini JSON response");
                  parsedResult = { reply: aiResult.text, order_detected: false, items: [] };
                }

                // 4. Save model's conversational reply to history
                await db.run(
                  "INSERT INTO whatsapp_chat_history (tenant_id, customer_phone, role, message) VALUES (?, ?, 'model', ?)",
                  [tenantId, customerPhone, parsedResult.reply]
                );

                // 5. Send reply message on WhatsApp
                await sock.sendMessage(customerPhone, { text: parsedResult.reply });

                // 5b. Send product images for mentioned items
                if (!parsedResult.order_detected) {
                  const mentionedItems = menuItems.filter((item: any) => 
                    parsedResult.reply.toLowerCase().includes(item.name.toLowerCase())
                  );
                  // Send up to 3 images to avoid spam
                  for (const item of mentionedItems.slice(0, 3)) {
                    const primaryImage = item.image_url ? item.image_url.split(',')[0] : '';
                    if (primaryImage && (primaryImage.startsWith('http') || primaryImage.startsWith('/uploads'))) {
                      try {
                        // Resolve absolute URL if relative
                        const imageUrl = primaryImage.startsWith('http') ? primaryImage : `https://app.whatxpress.com${primaryImage}`;
                        await sock.sendMessage(customerPhone, {
                          image: { url: imageUrl },
                          caption: `${item.name} — $${item.price}`
                        });
                      } catch (imgErr) {
                        logger.warn({ item: item.name }, "[WhatsApp] Could not send product image");
                      }
                    }
                  }
                }

                // 6. Handle automatic order registration if order detected
                if (parsedResult.order_detected && parsedResult.items && parsedResult.items.length > 0) {
                  let total = 0;
                  const orderItems = [];
                  for (const item of parsedResult.items) {
                    const menuItem = menuItems.find(m => m.name.toLowerCase() === item.name.toLowerCase());
                    if (menuItem) {
                      const qty = item.quantity || 1;
                      total += menuItem.price * qty;
                      orderItems.push({ menu_item_id: menuItem.id, quantity: qty, price: menuItem.price });
                    }
                  }

                  if (orderItems.length > 0) {
                    const orderId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    await db.run("BEGIN TRANSACTION");
                    try {
                      await db.run(
                        "INSERT INTO whatsapp_orders (id, tenant_id, items, total, status) VALUES (?, ?, ?, ?, ?)",
                        [orderId, tenantId, JSON.stringify(orderItems), total, 'pending']
                      );
                      await db.run(
                        "UPDATE metrics SET today_sales = today_sales + ?, ai_orders_count = ai_orders_count + 1 WHERE tenant_id = ?",
                        [total, tenantId]
                      );
                      await db.run(
                        "INSERT INTO ai_logs (tenant_id, role, message, timestamp, automation_type) VALUES (?, 'assistant', ?, ?, 'order')",
                        [tenantId, `Orden creada automáticamente: ${orderItems.length} producto(s), total $${total.toFixed(2)}`, new Date().toISOString()]
                      );
                      // Also create in pos_orders for dashboard visibility
                      const posOrderId = "pos_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                      await db.run(
                        "INSERT INTO pos_orders (id, tenant_id, table_number, status, total) VALUES (?, ?, ?, ?, ?)",
                        [posOrderId, tenantId, 'WhatsApp', 'pending', total]
                      );
                      for (const item of orderItems) {
                        const poiId = "poi_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                        await db.run(
                          "INSERT INTO pos_order_items (id, order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
                          [poiId, posOrderId, item.menu_item_id, item.quantity, item.price]
                        );
                      }
                      await db.run("COMMIT");

                      // Create delivery assignment for the owner to assign a driver
                      const assignId = "da_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                      await db.run(
                        "INSERT INTO delivery_assignments (id, tenant_id, order_id, customer_phone, status) VALUES (?, ?, ?, ?, 'pending')",
                        [assignId, tenantId, posOrderId, customerPhone]
                      );

                      const confirmationText = `✅ Pedido #${orderId.substring(0, 12)} confirmado. Total: $${total.toFixed(2)}. ¡Lo recibirás pronto!`;
                      await sock.sendMessage(customerPhone, { text: confirmationText });
                      
                      await db.run(
                        "INSERT INTO whatsapp_chat_history (tenant_id, customer_phone, role, message) VALUES (?, ?, 'model', ?)",
                        [tenantId, customerPhone, confirmationText]
                      );
                    } catch (err) {
                      await db.run("ROLLBACK");
                      logger.error({ err }, "[WhatsApp] Transaction error creating order");
                    }
                  }
                }
              }
            }

            // ═══ LOCATION MESSAGE HANDLING ═══
            const locationMsg = msg.message?.locationMessage;
            if (locationMsg && tenantId !== 'system_admin') {
              const customerLat = locationMsg.degreesLatitude;
              const customerLng = locationMsg.degreesLongitude;
              logger.info({ tenantId, lat: customerLat, lng: customerLng }, "[WhatsApp] Location received from customer");

              const db = await initDb();
              const settings = await db.get('SELECT latitude, longitude, delivery_base_fee, delivery_per_km_fee, delivery_max_distance FROM tenant_settings WHERE tenant_id = ?', [tenantId]);
              
              if (!settings || !settings.latitude || !settings.longitude) {
                await sock.sendMessage(customerPhone, { text: "📍 Recibí tu ubicación, pero el restaurante aún no ha configurado su dirección en el mapa. Por favor contacta directamente para coordinar." });
              } else {
                // Haversine distance calculation
                const R = 6371;
                const dLat = (customerLat - settings.latitude) * Math.PI / 180;
                const dLon = (customerLng - settings.longitude) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                          Math.cos(settings.latitude * Math.PI / 180) * Math.cos(customerLat * Math.PI / 180) * 
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                const distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 100) / 100;

                const baseFee = Number(settings.delivery_base_fee) || 0;
                const perKmFee = Number(settings.delivery_per_km_fee) || 0;
                const maxDistance = Number(settings.delivery_max_distance) || 0;

                // 1. Check maximum range limit
                if (maxDistance > 0 && distanceKm > maxDistance) {
                  const reply = `😔 Lo siento mucho, pero tu ubicación está a ${distanceKm} km de nosotros, y nuestro límite máximo de cobertura para delivery es de ${maxDistance} km.\n\n¡Pero si gustas puedes pasar a recoger tu pedido o comer en mesa! 🏃‍♂️`;
                  await sock.sendMessage(customerPhone, { text: reply });
                  await db.run("INSERT INTO whatsapp_chat_history (tenant_id, customer_phone, role, message) VALUES (?, ?, 'model', ?)", [tenantId, customerPhone, reply]);
                } else {
                  // 2. Pure math cost calculation
                  const calculatedFee = baseFee + (distanceKm * perKmFee);
                  
                  const reply = `📍 ¡Listo! Medí la distancia:\n📏 Separación: ${distanceKm} km\n🛵 Costo de Envío: $${calculatedFee.toFixed(2)}\n\n¿Estás de acuerdo con el cargo por envío? Responde 'SÍ' para formalizar el pedido.`;
                  await sock.sendMessage(customerPhone, { text: reply });
                  await db.run("INSERT INTO whatsapp_chat_history (tenant_id, customer_phone, role, message) VALUES (?, ?, 'model', ?)", [tenantId, customerPhone, reply]);
                }
              }
            }
          } catch (err: any) {
            logger.error({ err }, "[WhatsApp] Error sending message or calling AI");
            try {
              await sock.sendMessage(msg.key.remoteJid!, { text: "Sorry, I encountered an internal error. Please try again later." });
            } catch (e) {
              logger.error({ err: e }, "[WhatsApp] Failed to send error fallback message");
            }
          }
        }).catch(err => {
          logger.error({ err }, "[WhatsApp] Fatal queue error for customer");
        });
      }
    }
  });


  return { status: 'connecting' };
}

export async function disconnectWhatsApp(tenantId: string) {
  if (connections[tenantId]) {
    connections[tenantId].logout();
    delete connections[tenantId];
  }
  const tenantAuthFolder = path.join(authFolder, tenantId);
  if (fs.existsSync(tenantAuthFolder)) {
      fs.rmSync(tenantAuthFolder, { recursive: true, force: true });
  }
  delete pendingQRs[tenantId];
  return { status: 'disconnected' };
}
