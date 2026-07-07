import { db } from "../db";
import { logger } from "../lib/logger";
import { initDb } from "../db";
import type { ToolContext } from "../services/agentLoop";

// Helper to fetch the tenant's currency symbol (was a closure variable in the original).
async function getCurrencySymbol(tenantId: string): Promise<string> {
  const db = await initDb();
  const settings = await db.get("SELECT currency_symbol FROM tenant_settings WHERE tenant_id = ?", [tenantId]);
  return settings?.currency_symbol || "$";
}

export async function consultar_menu(args: any, ctx: ToolContext): Promise<string> {
  const db = await initDb();
  const currencySymbol = await getCurrencySymbol(ctx.tenantId);
  const menuItems = await db.all("SELECT id, name, price, description, is_available FROM menu_items WHERE tenant_id = ?", [ctx.tenantId]);
  return "Platillos del Menú:\n" + menuItems.map((m: any) =>
    `- "${m.name}" (ID: ${m.id}) - Precio: ${currencySymbol}${m.price} [${m.is_available ? "Disponible" : "Agotado"}] - ${m.description || "Sin descripción"}`
  ).join("\n");
}

export async function consultar_detalles_platillo(args: any, ctx: ToolContext): Promise<string> {
  const db = await initDb();
  const currencySymbol = await getCurrencySymbol(ctx.tenantId);
  const item = await db.get("SELECT id, name FROM menu_items WHERE tenant_id = ? AND name LIKE ?", [ctx.tenantId, `%${args.platillo_nombre}%`]);
  if (!item) {
    return `No encontré ningún platillo llamado '${args.platillo_nombre}' en el menú.`;
  }
  const attributes = await db.all("SELECT name, options FROM item_attributes WHERE menu_item_id = ?", [item.id]);
  const extras = await db.all("SELECT name, price FROM item_extras WHERE menu_item_id = ?", [item.id]);

  let details = `Detalles para "${item.name}":\n`;
  if (attributes.length > 0) {
    details += `Variantes/Opciones:\n` + attributes.map((a: any) => `- ${a.name}: Opciones disponibles: ${a.options}`).join("\n") + "\n";
  } else {
    details += `No tiene variantes/opciones especiales.\n`;
  }
  if (extras.length > 0) {
    details += `Extras disponibles:\n` + extras.map((e: any) => `- ${e.name} por ${currencySymbol}${e.price}`).join("\n") + "\n";
  } else {
    details += `No tiene ingredientes extras configurados.\n`;
  }
  return details;
}

export async function calcular_costo_envio(args: any, ctx: ToolContext): Promise<string> {
  const db = await initDb();
  const currencySymbol = await getCurrencySymbol(ctx.tenantId);
  const settings = await db.get("SELECT latitude, longitude, delivery_base_fee, delivery_per_km_fee, delivery_max_distance FROM tenant_settings WHERE tenant_id = ?", [ctx.tenantId]);
  if (!settings || !settings.latitude || !settings.longitude) {
    return "Error: El restaurante aún no ha configurado sus coordenadas geográficas en su perfil de dirección.";
  }
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
    return `Ubicación fuera de cobertura. La distancia es de ${distanceKm} km, pero el límite máximo de cobertura del restaurante es de ${maxDistance} km.`;
  } else {
    const deliveryFee = baseFee + (distanceKm * perKmFee);
    return `Costo calculado con éxito. Distancia: ${distanceKm} km. Cargo de envío sugerido: ${currencySymbol}${deliveryFee.toFixed(2)}.`;
  }
}

export async function consultar_promociones(args: any, ctx: ToolContext): Promise<string> {
  const db = await initDb();
  const currencySymbol = await getCurrencySymbol(ctx.tenantId);
  const today = new Date().toISOString().split("T")[0];
  const coupons = await db.all("SELECT code, name, discount, discount_type, minimum_order FROM tenant_coupons WHERE tenant_id = ? AND status = 'Active' AND start_date <= ? AND end_date >= ?", [ctx.tenantId, today, today]);
  if (coupons.length === 0) {
    return "Actualmente no hay cupones de descuento o promociones activas registradas.";
  } else {
    return "Cupones y Descuentos Activos:\n" + coupons.map((c: any) =>
      `- Cupón: "${c.code}" (${c.name}) - Descuento: ${c.discount}${c.discount_type === "Percentage" ? "%" : currencySymbol} (Compra mínima: ${currencySymbol}${c.minimum_order || 0})`
    ).join("\n");
  }
}

export async function registrar_pedido_pos(args: any, ctx: ToolContext): Promise<string> {
  const db = await initDb();
  const currencySymbol = await getCurrencySymbol(ctx.tenantId);
  const customerPhone = ctx.phone || "";
  const customerName = customerPhone;
  const menuItems = await db.all("SELECT id, name, price FROM menu_items WHERE tenant_id = ?", [ctx.tenantId]);

  let total = 0;
  const orderItems: any[] = [];

  for (const prod of args.productos) {
    const menuItem = menuItems.find((m: any) => m.name.toLowerCase() === prod.nombre.toLowerCase() || m.name.toLowerCase().includes(prod.nombre.toLowerCase()));
    if (menuItem) {
      const qty = Number(prod.cantidad) || 1;
      total += menuItem.price * qty;
      orderItems.push({ menu_item_id: menuItem.id, quantity: qty, price: menuItem.price });
    }
  }

  if (orderItems.length === 0) {
    return "Error al crear la orden: Ninguno de los productos especificados coincide con platillos existentes en el menú del restaurante.";
  }

  const deliveryFee = Number(args.costo_envio) || 0;
  const grandTotal = total + deliveryFee;

  await db.run("BEGIN TRANSACTION");
  try {
    const orderId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // 1. Create WhatsApp Order
    await db.run(
      "INSERT INTO whatsapp_orders (id, tenant_id, customer_phone, items, total, status) VALUES (?, ?, ?, ?, ?, ?)",
      [orderId, ctx.tenantId, customerPhone, JSON.stringify(orderItems), grandTotal, "pending"]
    );

    // 2. Create POS Order for the restaurant live dashboard
    const posOrderId = "pos_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    await db.run(
      "INSERT INTO pos_orders (id, tenant_id, table_number, status, total, order_type, customer_name, discount_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [posOrderId, ctx.tenantId, "WhatsApp", "pending", grandTotal, deliveryFee > 0 ? "delivery" : "take_out", customerName || customerPhone, 0]
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
        [kitchenId, posOrderId, ctx.tenantId, matchingItem?.name || "Platillo", item.quantity, "Pending"]
      );
    }

    // 5. Create Delivery Assignment if there is a delivery fee
    if (deliveryFee > 0) {
      const assignId = "da_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      await db.run(
        "INSERT INTO delivery_assignments (id, tenant_id, order_id, customer_phone, status, delivery_fee) VALUES (?, ?, ?, ?, 'pending', ?)",
        [assignId, ctx.tenantId, posOrderId, customerPhone, deliveryFee]
      );
    }

    // 6. Update Daily sales and AI counts metrics
    await db.run(
      "UPDATE metrics SET today_sales = today_sales + ?, ai_orders_count = ai_orders_count + 1 WHERE tenant_id = ?",
      [grandTotal, ctx.tenantId]
    );

    // 7. Log automatic action in AI logs
    await db.run(
      "INSERT INTO ai_logs (tenant_id, role, message, timestamp, automation_type) VALUES (?, 'assistant', ?, ?, 'order')",
      [ctx.tenantId, `Pedido POS registrado automáticamente: ${orderItems.length} producto(s), total con envío ${currencySymbol}${grandTotal.toFixed(2)}`, new Date().toISOString()]
    );

    await db.run("COMMIT");
    return `Pedido registrado con éxito bajo el ID POS: ${posOrderId}. ID WhatsApp: ${orderId}. Total: ${currencySymbol}${grandTotal.toFixed(2)}. ¡Enviado a cocina y repartidor!`;
  } catch (err: any) {
    await db.run("ROLLBACK");
    return `Error de base de datos registrando la transacción: ${err.message}`;
  }
}

export async function consultar_estado_pedido(args: any, ctx: ToolContext): Promise<string> {
  const db = await initDb();
  const currencySymbol = await getCurrencySymbol(ctx.tenantId);
  const customerPhone = ctx.phone || "";
  let order;
  if (args.order_id) {
    order = await db.get("SELECT status, total, created_at FROM pos_orders WHERE tenant_id = ? AND (id = ? OR id LIKE ?)", [ctx.tenantId, args.order_id, `%${args.order_id}%`]);
  } else {
    order = await db.get("SELECT id, status, total, created_at FROM pos_orders WHERE tenant_id = ? AND customer_name LIKE ? ORDER BY created_at DESC LIMIT 1", [ctx.tenantId, `%${customerPhone}%`]);
  }

  if (!order) {
    return "No encontré ningún pedido activo o reciente registrado bajo tus datos.";
  } else {
    // Also lookup delivery driver assignment if active
    const delivery = await db.get("SELECT status FROM delivery_assignments WHERE tenant_id = ? AND order_id = ?", [ctx.tenantId, order.id]);
    return `Pedido encontrado: Estado de preparación: "${order.status}". Total: ${currencySymbol}${order.total}. Fecha de creación: ${order.created_at}.` +
           (delivery ? ` Estado de la entrega a domicilio: "${delivery.status}".` : "");
  }
}

export async function transferir_a_humano(args: any, ctx: ToolContext): Promise<string> {
  const db = await initDb();
  const customerPhone = ctx.phone || "";
  await db.run(
    "INSERT OR REPLACE INTO whatsapp_chat_control (tenant_id, customer_phone, is_bot_active, updated_at) VALUES (?, ?, 0, CURRENT_TIMESTAMP)",
    [ctx.tenantId, customerPhone]
  );
  await db.run(
    "INSERT INTO ai_logs (tenant_id, role, message, timestamp, automation_type) VALUES (?, 'assistant', ?, ?, 'support')",
    [ctx.tenantId, `Asistente pausado autónomamente para interceptación humana solicitado por el chat ${customerPhone}`, new Date().toISOString()]
  );
  return "Asistente pausado con éxito. Un operador humano ha sido notificado y tomará control del chat de inmediato.";
}