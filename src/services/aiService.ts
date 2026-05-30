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
        
        const secondResponse = await chat.sendMessage({
          message: [{
            functionResponse: {
              name: call.name,
              response: { result: resultInfo }
            }
          }]
        });
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

export async function processCustomerWhatsAppChat(tenantId: string, customerPhone: string, customerName: string, message: string, history: any[]): Promise<string> {
  const db = await initDb();
  let keys = await db.all("SELECT * FROM api_pool WHERE status = 'healthy' ORDER BY last_used_at ASC");
  let activeKey = null;
  if (keys.length > 0) activeKey = keys[0].key_value;
  if (!activeKey) activeKey = process.env.GEMINI_API_KEY?.trim();
  if (!activeKey) throw new Error("No API key available for restaurant customer agent");

  const ai = new GoogleGenAI({ apiKey: activeKey });

  // 1. Tool definitions for Cashier Role
  const consultarMenu: FunctionDeclaration = {
    name: 'consultar_menu',
    description: 'Consulta los platillos disponibles en el menú del restaurante con sus precios y descripciones.',
    parameters: { type: Type.OBJECT, properties: {} }
  };

  const consultarDetallesPlatillo: FunctionDeclaration = {
    name: 'consultar_detalles_platillo',
    description: 'Consulta las variantes (como tamaños) y extras (adicionales) disponibles para un platillo específico del menú.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        platillo_nombre: { type: Type.STRING, description: 'Nombre del platillo para buscar variantes o extras' }
      },
      required: ['platillo_nombre']
    }
  };

  const calcularCostoEnvio: FunctionDeclaration = {
    name: 'calcular_costo_envio',
    description: 'Calcula el costo de envío (delivery) en base a las coordenadas de latitud y longitud enviadas por el cliente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        latitud: { type: Type.NUMBER, description: 'Latitud geográfica recibida' },
        longitud: { type: Type.NUMBER, description: 'Longitud geográfica recibida' }
      },
      required: ['latitud', 'longitud']
    }
  };

  const consultarPromociones: FunctionDeclaration = {
    name: 'consultar_promociones',
    description: 'Consulta cupones de descuento o promociones activas actualmente en el restaurante.',
    parameters: { type: Type.OBJECT, properties: {} }
  };

  const registrarPedidoPos: FunctionDeclaration = {
    name: 'registrar_pedido_pos',
    description: 'Registra formalmente el pedido en el sistema de caja (POS) del restaurante para que aparezca en el panel de control y sea enviado a la cocina.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productos: {
          type: Type.ARRAY,
          description: 'Lista de productos ordenados con sus nombres exactos del menú y cantidades',
          items: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING, description: 'Nombre exacto del platillo que coincide con el menú' },
              cantidad: { type: Type.NUMBER, description: 'Cantidad ordenada de este platillo' }
            },
            required: ['nombre', 'cantidad']
          }
        },
        costo_envio: { type: Type.NUMBER, description: 'Costo de envío (delivery) calculado previamente, opcional o 0 si no es para envío' }
      },
      required: ['productos']
    }
  };

  const consultarEstadoPedido: FunctionDeclaration = {
    name: 'consultar_estado_pedido',
    description: 'Consulta el estado actual de preparación o entrega de los pedidos asociados al cliente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        order_id: { type: Type.STRING, description: 'ID de orden opcional suministrado por el cliente' }
      }
    }
  };

  const transferirAHumano: FunctionDeclaration = {
    name: 'transferir_a_humano',
    description: 'Pausa el bot asistente e intercepta el chat para que un operador humano del restaurante responda de forma manual.',
    parameters: { type: Type.OBJECT, properties: {} }
  };

  // 2. Build the System Instruction based on Tenant Config
  const config = await db.get('SELECT * FROM ai_config WHERE tenant_id = ?', [tenantId]);
  const settings = await db.get('SELECT currency_symbol FROM tenant_settings WHERE tenant_id = ?', [tenantId]);
  const currencySymbol = settings?.currency_symbol || '$';

  const systemInstruction = `Eres el Agente Virtual de Ventas y Cajero Automático del restaurante. 
Te comportas como un empleado humano excelente, muy amable, carismático y eficiente. No suenas como un robot rígido.
Tu objetivo principal es tomar pedidos de los clientes, responder preguntas del menú y resolver dudas de manera natural.

REGLAS CLAVE:
1. Siempre debes responder en el MISMO idioma que te hable el cliente (si te habla en español, respondes en español; si en inglés, en inglés).
2. Tienes acceso a herramientas interactivas (las funciones "consultar_menu", "consultar_detalles_platillo", etc.) para leer y escribir datos en el sistema del restaurante en tiempo real. ¡Úsalas libremente cuando el usuario te pregunte o confirme algo!
3. El símbolo de moneda del restaurante es: ${currencySymbol}.
4. Si el cliente confirma su orden, debes llamar a "registrar_pedido_pos" para guardarla oficialmente.
5. Instrucciones personalizadas del dueño del restaurante:
${config?.custom_instructions || 'Atiende amablemente a los clientes.'}
`;

  // 3. Initialize Chat with history
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history,
    config: {
      systemInstruction: systemInstruction,
      tools: [{ functionDeclarations: [consultarMenu, consultarDetallesPlatillo, calcularCostoEnvio, consultarPromociones, registrarPedidoPos, consultarEstadoPedido, transferirAHumano] }]
    }
  });

  const response = await chat.sendMessage({ message });
  let finalReply = response.text || "";

  // 4. Handle tool execution loop (supports recursive function calling)
  if (response.functionCalls && response.functionCalls.length > 0) {
    for (const call of response.functionCalls) {
      let resultInfo = "";
      logger.info({ tenantId, tool: call.name, args: call.args }, "[AI Cajero] Executing tool");

      try {
        if (call.name === 'consultar_menu') {
          const menuItems = await db.all('SELECT id, name, price, description, is_available FROM menu_items WHERE tenant_id = ?', [tenantId]);
          resultInfo = "Platillos del Menú:\n" + menuItems.map((m: any) => 
            `- "${m.name}" (ID: ${m.id}) - Precio: ${currencySymbol}${m.price} [${m.is_available ? 'Disponible' : 'Agotado'}] - ${m.description || 'Sin descripción'}`
          ).join('\n');

        } else if (call.name === 'consultar_detalles_platillo') {
          const args: any = call.args;
          const item = await db.get('SELECT id, name FROM menu_items WHERE tenant_id = ? AND name LIKE ?', [tenantId, `%${args.platillo_nombre}%`]);
          if (!item) {
            resultInfo = `No encontré ningún platillo llamado '${args.platillo_nombre}' en el menú.`;
          } else {
            const attributes = await db.all('SELECT name, options FROM item_attributes WHERE menu_item_id = ?', [item.id]);
            const extras = await db.all('SELECT name, price FROM item_extras WHERE menu_item_id = ?', [item.id]);
            
            let details = `Detalles para "${item.name}":\n`;
            if (attributes.length > 0) {
              details += `Variantes/Opciones:\n` + attributes.map((a: any) => `- ${a.name}: Opciones disponibles: ${a.options}`).join('\n') + '\n';
            } else {
              details += `No tiene variantes/opciones especiales.\n`;
            }
            if (extras.length > 0) {
              details += `Extras disponibles:\n` + extras.map((e: any) => `- ${e.name} por ${currencySymbol}${e.price}`).join('\n') + '\n';
            } else {
              details += `No tiene ingredientes extras configurados.\n`;
            }
            resultInfo = details;
          }

        } else if (call.name === 'calcular_costo_envio') {
          const args: any = call.args;
          const settings = await db.get('SELECT latitude, longitude, delivery_base_fee, delivery_per_km_fee, delivery_max_distance FROM tenant_settings WHERE tenant_id = ?', [tenantId]);
          if (!settings || !settings.latitude || !settings.longitude) {
            resultInfo = "Error: El restaurante aún no ha configurado sus coordenadas geográficas en su perfil de dirección.";
          } else {
            const customerLat = args.latitud;
            const customerLng = args.longitud;
            
            const R = 6371; // Earth radius in km
            const dLat = (customerLat - settings.latitude) * Math.PI / 180;
            const dLon = (customerLng - settings.longitude) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                      Math.cos(settings.latitude * Math.PI / 180) * Math.cos(customerLat * Math.PI / 180) * 
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 100) / 100;

            const baseFee = Number(settings.delivery_base_fee) || 0;
            const perKmFee = Number(settings.delivery_per_km_fee) || 0;
            const maxDistance = Number(settings.delivery_max_distance) || 0;

            if (maxDistance > 0 && distanceKm > maxDistance) {
              resultInfo = `Ubicación fuera de cobertura. La distancia es de ${distanceKm} km, pero el límite máximo de cobertura del restaurante es de ${maxDistance} km.`;
            } else {
              const deliveryFee = baseFee + (distanceKm * perKmFee);
              resultInfo = `Costo calculado con éxito. Distancia: ${distanceKm} km. Cargo de envío sugerido: ${currencySymbol}${deliveryFee.toFixed(2)}.`;
            }
          }

        } else if (call.name === 'consultar_promociones') {
          const today = new Date().toISOString().split('T')[0];
          const coupons = await db.all("SELECT code, name, discount, discount_type, minimum_order FROM tenant_coupons WHERE tenant_id = ? AND status = 'Active' AND start_date <= ? AND end_date >= ?", [tenantId, today, today]);
          if (coupons.length === 0) {
            resultInfo = "Actualmente no hay cupones de descuento o promociones activas registradas.";
          } else {
            resultInfo = "Cupones y Descuentos Activos:\n" + coupons.map((c: any) => 
              `- Cupón: "${c.code}" (${c.name}) - Descuento: ${c.discount}${c.discount_type === 'Percentage' ? '%' : currencySymbol} (Compra mínima: ${currencySymbol}${c.minimum_order || 0})`
            ).join('\n');
          }

        } else if (call.name === 'registrar_pedido_pos') {
          const args: any = call.args;
          const menuItems = await db.all('SELECT id, name, price FROM menu_items WHERE tenant_id = ?', [tenantId]);
          
          let total = 0;
          const orderItems = [];
          
          for (const prod of args.productos) {
            const menuItem = menuItems.find((m: any) => m.name.toLowerCase() === prod.nombre.toLowerCase() || m.name.toLowerCase().includes(prod.nombre.toLowerCase()));
            if (menuItem) {
              const qty = Number(prod.cantidad) || 1;
              total += menuItem.price * qty;
              orderItems.push({ menu_item_id: menuItem.id, quantity: qty, price: menuItem.price });
            }
          }

          if (orderItems.length === 0) {
            resultInfo = "Error al crear la orden: Ninguno de los productos especificados coincide con platillos existentes en el menú del restaurante.";
          } else {
            const deliveryFee = Number(args.costo_envio) || 0;
            const grandTotal = total + deliveryFee;
            
            await db.run("BEGIN TRANSACTION");
            try {
              const orderId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              
              // 1. Create WhatsApp Order
              await db.run(
                "INSERT INTO whatsapp_orders (id, tenant_id, customer_phone, items, total, status) VALUES (?, ?, ?, ?, ?, ?)",
                [orderId, tenantId, customerPhone, JSON.stringify(orderItems), grandTotal, 'pending']
              );

              // 2. Create POS Order for the restaurant live dashboard
              const posOrderId = "pos_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
              await db.run(
                "INSERT INTO pos_orders (id, tenant_id, table_number, status, total, order_type, customer_name, discount_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [posOrderId, tenantId, 'WhatsApp', 'pending', grandTotal, deliveryFee > 0 ? 'delivery' : 'take_out', customerName || customerPhone, 0]
              );

              // 3. Insert items for POS order
              for (const item of orderItems) {
                const poiId = "poi_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                await db.run(
                  "INSERT INTO pos_order_items (id, order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
                  [poiId, posOrderId, item.menu_item_id, item.quantity, item.price]
                );
                
                // 4. Create Kitchen Order automatically
                const kitchenId = "ko_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                const matchingItem = menuItems.find((m: any) => m.id === item.menu_item_id);
                await db.run(
                  "INSERT INTO kitchen_orders (id, order_id, tenant_id, item_name, quantity, status) VALUES (?, ?, ?, ?, ?, ?)",
                  [kitchenId, posOrderId, tenantId, matchingItem?.name || "Platillo", item.quantity, 'Pending']
                );
              }

              // 5. Create Delivery Assignment if there is a delivery fee
              if (deliveryFee > 0) {
                const assignId = "da_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                await db.run(
                  "INSERT INTO delivery_assignments (id, tenant_id, order_id, customer_phone, status, delivery_fee) VALUES (?, ?, ?, ?, 'pending', ?)",
                  [assignId, tenantId, posOrderId, customerPhone, deliveryFee]
                );
              }

              // 6. Update Daily sales and AI counts metrics
              await db.run(
                "UPDATE metrics SET today_sales = today_sales + ?, ai_orders_count = ai_orders_count + 1 WHERE tenant_id = ?",
                [grandTotal, tenantId]
              );

              // 7. Log automatic action in AI logs
              await db.run(
                "INSERT INTO ai_logs (tenant_id, role, message, timestamp, automation_type) VALUES (?, 'assistant', ?, ?, 'order')",
                [tenantId, `Pedido POS registrado automáticamente: ${orderItems.length} producto(s), total con envío ${currencySymbol}${grandTotal.toFixed(2)}`, new Date().toISOString()]
              );

              await db.run("COMMIT");
              resultInfo = `Pedido registrado con éxito bajo el ID POS: ${posOrderId}. ID WhatsApp: ${orderId}. Total: ${currencySymbol}${grandTotal.toFixed(2)}. ¡Enviado a cocina y repartidor!`;
            } catch (err: any) {
              await db.run("ROLLBACK");
              resultInfo = `Error de base de datos registrando la transacción: ${err.message}`;
            }
          }

        } else if (call.name === 'consultar_estado_pedido') {
          const args: any = call.args;
          let order;
          if (args.order_id) {
            order = await db.get("SELECT status, total, created_at FROM pos_orders WHERE tenant_id = ? AND (id = ? OR id LIKE ?)", [tenantId, args.order_id, `%${args.order_id}%`]);
          } else {
            order = await db.get("SELECT id, status, total, created_at FROM pos_orders WHERE tenant_id = ? AND customer_name LIKE ? ORDER BY created_at DESC LIMIT 1", [tenantId, `%${customerPhone}%`]);
          }

          if (!order) {
            resultInfo = "No encontré ningún pedido activo o reciente registrado bajo tus datos.";
          } else {
            // Also lookup delivery driver assignment if active
            const delivery = await db.get("SELECT status FROM delivery_assignments WHERE tenant_id = ? AND order_id = ?", [tenantId, order.id]);
            resultInfo = `Pedido encontrado: Estado de preparación: "${order.status}". Total: ${currencySymbol}${order.total}. Fecha de creación: ${order.created_at}.` +
                         (delivery ? ` Estado de la entrega a domicilio: "${delivery.status}".` : "");
          }

        } else if (call.name === 'transferir_a_humano') {
          await db.run(
            "INSERT OR REPLACE INTO whatsapp_chat_control (tenant_id, customer_phone, is_bot_active, updated_at) VALUES (?, ?, 0, CURRENT_TIMESTAMP)",
            [tenantId, customerPhone]
          );
          await db.run(
            "INSERT INTO ai_logs (tenant_id, role, message, timestamp, automation_type) VALUES (?, 'assistant', ?, ?, 'support')",
            [tenantId, `Asistente pausado autónomamente para interceptación humana solicitado por el chat ${customerPhone}`, new Date().toISOString()]
          );
          resultInfo = "Asistente pausado con éxito. Un operador humano ha sido notificado y tomará control del chat de inmediato.";
        }

      } catch (err: any) {
        logger.error({ err, name: call.name }, "[AI Cajero] Execution error");
        resultInfo = `Error ejecutando la herramienta ${call.name}: ${err.message}`;
      }

      // Send the result of tool execution back to Gemini to formulate final friendly response
      const secondResponse = await chat.sendMessage({
        message: [{
          functionResponse: {
            name: call.name,
            response: { result: resultInfo }
          }
        }]
      });
      finalReply = secondResponse.text || "Operación completada.";
    }
  }

  return finalReply;
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

