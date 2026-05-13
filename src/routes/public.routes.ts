import express from 'express';
import { getDb } from '../db.js';
import { logger } from '../lib/logger.js';

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    System check for operations monitoring
 */
router.get("/health", async (req, res) => {
  try {
    const db = getDb();
    // Simple database connectivity check
    await db.get("SELECT 1");
    
    res.json({
      status: "ok",
      message: "Server is up and running",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {
        database: "connected",
        whatsapp: "unavailable" // Placeholder to fulfill older signature requirements
      }
    });
  } catch (e) {
    logger.error({ err: e }, "[health-check-failure]");
    res.status(503).json({ status: "error", error: "Database unavailable" });
  }
});

/**
 * @route   GET /api/public/plans
 * @desc    Retrieves all active purchase tier models for landing page rendering
 */
router.get("/plans", async (req, res) => {
  try {
    const db = getDb();
    const rawPlans = await db.all("SELECT * FROM plans ORDER BY price");
    const plans = (rawPlans || []).map((p: any) => ({
      ...p,
      features: typeof p.features === "string" ? JSON.parse(p.features) : (p.features || []),
      is_popular: !!p.is_popular
    }));
    res.json(plans);
  } catch (e) {
    logger.error({ err: e }, "[public/plans]");
    res.status(500).json({ error: String(e) });
  }
});

/**
 * @route   GET /api/public/track/:type/:token
 * @desc    Provides live assignment tracking information given a valid short lived hash
 */
router.get("/track/:type/:token", async (req, res) => {
  try {
    const db = getDb();
    const { type, token } = req.params;
    const isDriver = type === 'driver';
    
    const query = isDriver 
      ? `SELECT da.*, dd.name as driver_name, dd.current_lat, dd.current_lng, dd.phone as driver_phone, 
                po.total as order_total, po.table_number
         FROM delivery_assignments da 
         JOIN delivery_drivers dd ON da.driver_id = dd.id 
         LEFT JOIN pos_orders po ON da.order_id = po.id
         WHERE da.driver_token = ?`
      : `SELECT da.id, da.status, da.customer_lat, da.customer_lng, da.distance_km, 
                dd.name as driver_name, dd.current_lat, dd.current_lng
         FROM delivery_assignments da 
         JOIN delivery_drivers dd ON da.driver_id = dd.id 
         WHERE da.customer_token = ?`;
    
    const assignment = await db.get(query, [token]);
    if (!assignment) return res.status(404).json({ error: "Enlace no encontrado." });
    
    // Check explicit expiry
    const verify = await db.get("SELECT expires_at, status FROM delivery_assignments WHERE id = ?", [(assignment as any).id]);
    if (verify.expires_at && new Date(verify.expires_at) < new Date()) {
       return res.status(410).json({ error: "Este enlace ya ha expirado." });
    }
    if (isDriver && verify.status === 'delivered') {
       return res.status(410).json({ error: "Esta entrega ya finalizó." });
    }

    res.json(assignment);
  } catch (e) { 
    res.status(500).json({ error: String(e) }); 
  }
});

/**
 * @route   POST /api/public/track/driver/:token/action
 * @desc    Updates status on specific delivery utilizing purely the ephemeral token link
 */
router.post("/track/driver/:token/action", async (req, res) => {
  try {
    const db = getDb();
    const { token } = req.params;
    const { action } = req.body; 
    
    const assignment = await db.get("SELECT id, driver_id, tenant_id, customer_phone, status FROM delivery_assignments WHERE driver_token = ?", [token]);
    if (!assignment) return res.status(404).json({ error: "Orden no encontrada." });
    
    const now = new Date().toISOString();
    if (action === 'picked_up') {
      await db.run("UPDATE delivery_assignments SET status = 'picked_up', picked_up_at = ? WHERE id = ?", [now, (assignment as any).id]);
    } else if (action === 'delivered') {
      await db.run("UPDATE delivery_assignments SET status = 'delivered', delivered_at = ?, expires_at = ? WHERE id = ?", [now, now, (assignment as any).id]);
      if ((assignment as any).driver_id) {
         await db.run("UPDATE delivery_drivers SET total_deliveries = total_deliveries + 1 WHERE id = ?", [(assignment as any).driver_id]);
      }
    }
    res.json({ success: true });
  } catch (e) { 
    res.status(500).json({ error: String(e) }); 
  }
});

/**
 * @route   POST /api/public/track/driver/:token/location
 * @desc    Live GPS publishing via tracking hash for immediate driver mapping
 */
router.post("/track/driver/:token/location", async (req, res) => {
   try {
     const db = getDb();
     const { token } = req.params;
     const { lat, lng } = req.body;
     const assignment = await db.get("SELECT driver_id FROM delivery_assignments WHERE driver_token = ?", [token]);
     if (!assignment) return res.status(404).json({ error: "Invalid token" });
     await db.run("UPDATE delivery_drivers SET current_lat = ?, current_lng = ? WHERE id = ?", [lat, lng, (assignment as any).driver_id]);
     res.json({ success: true });
   } catch (e) { 
     res.status(500).json({ error: "Fail" }); 
   }
});

/**
 * @route   GET /api/public/menu/:tenantId
 * @desc    Aggregated client menu dataset (categories & full inventory) for non-auth view
 */
router.get("/menu/:tenantId", async (req, res) => {
  try {
    const db = getDb();
    const tenantId = req.params.tenantId;
    const tenant = await db.get("SELECT name, bg_color, init_letters FROM tenants WHERE id = ?", [tenantId]);
    const categories = await db.all("SELECT * FROM categories WHERE tenant_id = ? ORDER BY name ASC", [tenantId]);
    const menuItems = await db.all("SELECT * FROM menu_items WHERE tenant_id = ? AND is_available = 1", [tenantId]);
    const settings = await db.get("SELECT whatsapp_number, phone_number FROM tenant_settings WHERE tenant_id = ?", [tenantId]);
    
    if (!tenant) return res.status(404).json({error: "Restaurant not found"});
    
    res.json({
      restaurantName: (tenant as any).name,
      themeColor: (tenant as any).bg_color,
      initLetters: (tenant as any).init_letters,
      whatsappNumber: (settings as any)?.whatsapp_number || (settings as any)?.phone_number || "",
      categories,
      menuItems
    });
  } catch (e) {
    res.status(500).json({error: String(e)});
  }
});

/**
 * @route   POST /api/public/orders
 * @desc    Submits self-served guest order from direct client web menu portal with KDS sync
 */
router.post("/orders", async (req, res) => {
  try {
    const db = getDb();
    const { tenant_id, table_number, items, customer_name, customer_phone, delivery_type } = req.body;
    const orderId = `pub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const orderType = delivery_type === 'delivery' ? 'delivery' : delivery_type === 'dine_in' ? 'dine_in' : 'takeaway';
    const tableNum = table_number || (orderType === 'delivery' ? 'Delivery' : orderType === 'takeaway' ? 'Para llevar' : null);
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "El carrito no contiene productos válidos" });
    }

    const total = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    const tenant = await db.get("SELECT id FROM tenants WHERE id = ?", [tenant_id]);
    if (!tenant) {
      return res.status(400).json({ error: "Tenant not found" });
    }

    await db.run("BEGIN TRANSACTION");
    try {
      await db.run(
        "INSERT INTO pos_orders (id, tenant_id, table_number, status, total, order_type, customer_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [orderId, tenant_id, tableNum, 'open', total, orderType, customer_name || null]
      );
      
      for (const item of items) {
        const poiId = `poi_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await db.run(
          "INSERT INTO pos_order_items (id, order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
          [poiId, orderId, item.menu_item_id, item.quantity, item.price]
        );

        const menuItem = await db.get("SELECT name FROM menu_items WHERE id = ?", [item.menu_item_id]);
        const itemName = menuItem ? (menuItem as any).name : "Item";
        const kdsId = `ko_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await db.run(
          "INSERT INTO kitchen_orders (id, order_id, tenant_id, item_name, quantity, status) VALUES (?, ?, ?, ?, ?, ?)",
          [kdsId, orderId, tenant_id, itemName, item.quantity, 'Pending']
        );
      }

      // Create delivery assignment if delivery
      if (orderType === 'delivery' && customer_phone) {
        const delId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await db.run(
          "INSERT INTO delivery_assignments (id, tenant_id, order_id, customer_phone, status) VALUES (?, ?, ?, ?, 'pending')",
          [delId, tenant_id, orderId, customer_phone]
        );
      }

      await db.run("COMMIT");

      // Broadcast via WebSocket to kitchen
      const { broadcastToTenant } = await import('./websocketServer.js');
      if (broadcastToTenant) {
        broadcastToTenant(tenant_id, {
          type: "kitchen_orders_updated",
          orderId,
          tableNumber: tableNum || "Para llevar",
          items: items.map((i: any) => ({
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            price: i.price
          }))
        });
      }

      res.json({ message: "Orden recibida", orderId, status: "open" });
    } catch (innerErr) {
      await db.run("ROLLBACK");
      throw innerErr;
    }
  } catch (e) {
    logger.error({ err: e }, "[public/orders]");
    res.status(500).json({ error: String(e) });
  }
});

export default router;
