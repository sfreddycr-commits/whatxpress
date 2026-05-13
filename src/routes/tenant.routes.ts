import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { logger } from '../lib/logger.js';
import { authenticateToken, verifyTenantAccess, AuthRequest } from '../middleware/auth.js';
import { getSafeTenantId } from '../lib/utils.js';
import { sendWhatsAppNotification } from '../services/whatsappNotifier.js';

export function createTenantRouter(broadcastToTenant: (tenantId: string, payload: any) => void) {
  const router = express.Router();

  /**
   * OPS CONTROLLER Aggregator
   */
  router.get("/ops-control/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
     try {
       const db = getDb();
       const tenantId = req.params.tenantId;
       const orders = await db.all(`
         SELECT 
           po.*,
           (SELECT COUNT(*) FROM kitchen_orders ko WHERE ko.order_id = po.id) as total_items,
           (SELECT COUNT(*) FROM kitchen_orders ko WHERE ko.order_id = po.id AND ko.status = 'Ready') as ready_items,
           da.id as delivery_id,
           da.status as delivery_status,
           da.driver_id,
           dd.name as driver_name,
           da.driver_token,
           da.customer_token
         FROM pos_orders po
         LEFT JOIN delivery_assignments da ON po.id = da.order_id
         LEFT JOIN delivery_drivers dd ON da.driver_id = dd.id
         WHERE po.tenant_id = ? AND po.status != 'closed'
         ORDER BY po.created_at DESC
       `, [tenantId]);

       res.json(orders);
     } catch (e) {
       res.status(500).json({ error: String(e) });
     }
  });

  /**
   * DASHBOARD DATA Aggregator
   */
  router.get("/dashboard/:tenantId", authenticateToken, verifyTenantAccess, handleTenantDashboard);

  /**
   * CATEGORIES MANAGEMENT
   */
  router.post("/categories", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { id, tenant_id, name, icon } = req.body;
      const finalTenantId = await getSafeTenantId(req, tenant_id);
      const finalId = id || `cat_${Date.now()}`;
      await db.run(`
        INSERT INTO categories (id, tenant_id, name, icon) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          name = EXCLUDED.name,
          icon = EXCLUDED.icon
      `, [finalId, finalTenantId, name, icon]);
      res.json({ message: "Category saved", id: finalId });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.delete("/categories/:id", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const catId = req.params.id;
      
      await db.run("BEGIN TRANSACTION");
      try {
        // Detach all products before deleting the category parent
        await db.run("UPDATE menu_items SET category_id = NULL WHERE category_id = ?", [catId]);
        
        // Perform actual deletion
        await db.run("DELETE FROM categories WHERE id = ?", [catId]);
        
        await db.run("COMMIT");
        res.json({ message: "Category deleted successfully" });
      } catch (innerErr) {
        await db.run("ROLLBACK");
        throw innerErr;
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * MENU ITEMS MANAGEMENT
   */
  router.post("/menu-items", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { id, tenant_id, category_id, name, price, description, image_url, is_available } = req.body;
      const finalTenantId = await getSafeTenantId(req, tenant_id);
      const finalId = id || `m_${Date.now()}`;
      await db.run(`
        INSERT INTO menu_items (id, tenant_id, category_id, name, price, description, image_url, is_available)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          category_id = EXCLUDED.category_id,
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          is_available = EXCLUDED.is_available
      `, [finalId, finalTenantId, category_id || null, name, Number(price) || 0, description, image_url, is_available ? 1 : 0]);
      res.json({ message: "Menu item saved", id: finalId });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.delete("/menu-items/:id", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const itemId = req.params.id;
      
      await db.run("BEGIN TRANSACTION");
      try {
        // 1. Clear configuration links
        await db.run("DELETE FROM item_attributes WHERE menu_item_id = ?", [itemId]);
        await db.run("DELETE FROM item_extras WHERE menu_item_id = ?", [itemId]);
        await db.run("DELETE FROM item_addons WHERE menu_item_id = ?", [itemId]);
        
        // 2. Detach from historical order data safely without deleting analytics
        await db.run("UPDATE pos_order_items SET menu_item_id = NULL WHERE menu_item_id = ?", [itemId]);
        
        // 3. Perform absolute absolute final deletion
        await db.run("DELETE FROM menu_items WHERE id = ?", [itemId]);
        
        await db.run("COMMIT");
        res.json({ message: "Menu item deleted and cleanup complete" });
      } catch (innerErr) {
        await db.run("ROLLBACK");
        throw innerErr;
      }
    } catch (e) {
      logger.error({ err: e, itemId: req.params.id }, "[menu-item-delete] Failed cleanup destruction");
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * POS ORDERS CRUD & KDS WEBSOCKET RELAY
   */
  router.post("/pos-orders", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { id, tenant_id, table_number, total, items, waiter_id, order_type, payment_method, payment_status, tip, tax_amount, discount_amount, customer_name } = req.body;
      const finalTenantId = await getSafeTenantId(req, tenant_id);
      const orderId = id || `ord_${Date.now()}`;
      
      await db.run("BEGIN TRANSACTION");
      try {
        await db.run(`
          INSERT INTO pos_orders (id, tenant_id, table_number, status, total, waiter_id, order_type, payment_method, payment_status, tip, tax_amount, discount_amount, customer_name) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            table_number = EXCLUDED.table_number,
            status = EXCLUDED.status,
            total = EXCLUDED.total,
            waiter_id = EXCLUDED.waiter_id,
            order_type = EXCLUDED.order_type,
            payment_method = EXCLUDED.payment_method,
            payment_status = EXCLUDED.payment_status,
            tip = EXCLUDED.tip,
            tax_amount = EXCLUDED.tax_amount,
            discount_amount = EXCLUDED.discount_amount,
            customer_name = EXCLUDED.customer_name
        `, [orderId, finalTenantId, table_number, req.body.status || 'open', total, waiter_id || null, order_type || 'dine_in', payment_method || null, payment_status || 'pending', tip || 0, tax_amount || 0, discount_amount || 0, customer_name || null]);
        
        if (items && Array.isArray(items)) {
          await db.run("DELETE FROM pos_order_items WHERE order_id = ?", [orderId]);
          await db.run("DELETE FROM kitchen_orders WHERE order_id = ?", [orderId]);
          for (const item of items) {
            const menuItem = await db.get("SELECT name FROM menu_items WHERE id = ?", [item.menu_item_id]);
            const itemName = menuItem ? (menuItem as any).name : "Item";

            const poiId = `poi_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await db.run(
              "INSERT INTO pos_order_items (id, order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
              [poiId, orderId, item.menu_item_id, item.quantity, item.price]
            );

            const kdsId = `ko_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await db.run(
              "INSERT INTO kitchen_orders (id, order_id, tenant_id, item_name, quantity, status) VALUES (?, ?, ?, ?, ?, ?)",
              [kdsId, orderId, finalTenantId, itemName, item.quantity, 'Pending']
            );
          }
        }
        
        // Trigger Broadcast to Kitchen Display Screens via WebSocket Server hook
        broadcastToTenant(finalTenantId, {
          type: "kitchen_orders_updated",
          orderId,
          tableNumber: table_number || "N/A",
          items: (items || []).map((item: any) => ({
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            price: item.price
          }))
        });

        // Automatic delivery task handler
        if (order_type === 'delivery' || table_number === 'Llevar') {
          const existingDelivery = await db.get("SELECT id FROM delivery_assignments WHERE order_id = ?", [orderId]);
          if (!existingDelivery) {
            const delId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await db.run(
              "INSERT INTO delivery_assignments (id, tenant_id, order_id, status) VALUES (?, ?, ?, 'pending')",
              [delId, finalTenantId, orderId]
            );
          }
        }

        await db.run("COMMIT");
        res.json({ message: "Order saved", id: orderId });
      } catch (innerErr) {
        await db.run("ROLLBACK");
        throw innerErr;
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/pos-orders/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const order = await db.get("SELECT * FROM pos_orders WHERE id = ?", [req.params.id]);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const items = await db.all(`
        SELECT poi.*, mi.name as menu_item_name, mi.image_url
        FROM pos_order_items poi
        LEFT JOIN menu_items mi ON poi.menu_item_id = mi.id
        WHERE poi.order_id = ?
      `, [req.params.id]);

      res.json({ ...(order as any), items });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.patch("/pos-orders/:id/status", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      const { status } = req.body;
      await db.run("UPDATE pos_orders SET status = ? WHERE id = ?", [status, req.params.id]);
      res.json({ message: "Status updated" });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * PAYMENT PROCESSING
   */
  router.post("/pos-orders/:id/pay", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { payment_method, amount, tip, tax_amount, discount_amount } = req.body;
      const orderId = req.params.id;
      
      const order = await db.get("SELECT * FROM pos_orders WHERE id = ?", [orderId]);
      if (!order) return res.status(404).json({ error: "Order not found" });

      await db.run("BEGIN TRANSACTION");
      try {
        const paymentId = "pay_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
        await db.run(`
          INSERT INTO order_payments (id, order_id, tenant_id, amount, payment_method, payment_status, tip, paid_at)
          VALUES (?, ?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
        `, [paymentId, orderId, (order as any).tenant_id, amount, payment_method, tip || 0]);

        await db.run(`
          UPDATE pos_orders SET 
            status = 'closed', 
            payment_method = ?, 
            payment_status = 'paid', 
            tip = COALESCE(?, tip), 
            tax_amount = COALESCE(?, tax_amount), 
            discount_amount = COALESCE(?, discount_amount),
            paid_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [payment_method, tip || 0, tax_amount || 0, discount_amount || 0, orderId]);

        const tenantId = (order as any).tenant_id;
        const totalPaid = Number(amount) + Number(tip || 0);

        // Update tenant metrics
        await db.run(
          "INSERT INTO metrics (tenant_id, today_sales, ai_orders_count, automation_rate, active_tables) VALUES (?, ?, 0, 0, 0) ON CONFLICT (tenant_id) DO UPDATE SET today_sales = today_sales + ?",
          [tenantId, totalPaid, totalPaid]
        );

        await db.run("COMMIT");
        res.json({ success: true, message: "Payment processed", payment_id: paymentId });
      } catch (innerErr) {
        await db.run("ROLLBACK");
        throw innerErr;
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/pos-orders/:id/receipt", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const order = await db.get(`
        SELECT po.*, ts.currency_symbol, t.name as tenant_name
        FROM pos_orders po
        LEFT JOIN tenant_settings ts ON po.tenant_id = ts.tenant_id
        LEFT JOIN tenants t ON po.tenant_id = t.id
        WHERE po.id = ?
      `, [req.params.id]);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const items = await db.all(`
        SELECT poi.*, mi.name as menu_item_name
        FROM pos_order_items poi
        LEFT JOIN menu_items mi ON poi.menu_item_id = mi.id
        WHERE poi.order_id = ?
      `, [req.params.id]);

      const payments = await db.all("SELECT * FROM order_payments WHERE order_id = ?", [req.params.id]);

      const o = order as any;
      const sym = o.currency_symbol || '$';
      const now = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
      const waiter = o.waiter_id ? 'Sí' : 'No';

      const html = `<html><body style="font-family:monospace;font-size:12px;padding:20px;max-width:300px;margin:auto">
        <h2 style="text-align:center">${o.tenant_name || 'WhatXpress'}</h2>
        <p style="text-align:center;font-size:10px">${now}</p>
        <hr>
        <p><strong>Orden:</strong> #${o.id?.substring(o.id.length - 10)}</p>
        <p><strong>Mesa:</strong> ${o.table_number || 'N/A'}</p>
        <p><strong>Tipo:</strong> ${o.order_type || 'dine_in'}</p>
        ${o.customer_name ? `<p><strong>Cliente:</strong> ${o.customer_name}</p>` : ''}
        <hr>
        <table style="width:100%;font-size:11px">
          <tr><th style="text-align:left">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr>
          ${items.map((i: any) => `<tr><td>${i.menu_item_name || 'Item'}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${sym}${(i.price * i.quantity).toFixed(2)}</td></tr>`).join('')}
        </table>
        <hr>
        <p><strong>Subtotal:</strong> <span style="float:right">${sym}${items.reduce((a: number, i: any) => a + (i.price * i.quantity), 0).toFixed(2)}</span></p>
        ${o.tax_amount > 0 ? `<p><strong>Impuesto:</strong> <span style="float:right">${sym}${Number(o.tax_amount).toFixed(2)}</span></p>` : ''}
        ${o.discount_amount > 0 ? `<p><strong>Descuento:</strong> <span style="float:right">-${sym}${Number(o.discount_amount).toFixed(2)}</span></p>` : ''}
        ${o.tip > 0 ? `<p><strong>Propina:</strong> <span style="float:right">${sym}${Number(o.tip).toFixed(2)}</span></p>` : ''}
        <hr>
        <p style="font-size:14px;font-weight:bold"><strong>TOTAL:</strong> <span style="float:right">${sym}${Number(o.total || 0).toFixed(2)}</span></p>
        <hr>
        <p style="font-size:10px"><strong>Método de pago:</strong> ${o.payment_method || 'N/A'}</p>
        ${payments.length > 0 ? `<p style="font-size:10px"><strong>Pagado:</strong> ${new Date(payments[0].paid_at || payments[0].created_at).toLocaleString('es-CR')}</p>` : ''}
        <hr>
        <p style="text-align:center;font-size:10px">¡Gracias por tu visita!</p>
      </body></html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/pos-orders/:id/refund", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { reason } = req.body;
      const orderId = req.params.id;

      const payment = await db.get("SELECT * FROM order_payments WHERE order_id = ? AND payment_status = 'completed'", [orderId]);
      if (!payment) return res.status(404).json({ error: "No completed payment found for this order" });

      await db.run("UPDATE order_payments SET payment_status = 'refunded', refunded_at = CURRENT_TIMESTAMP, refund_amount = amount, refund_reason = ? WHERE id = ?", [reason || 'No reason provided', (payment as any).id]);
      await db.run("UPDATE pos_orders SET payment_status = 'refunded', status = 'refunded' WHERE id = ?", [orderId]);

      res.json({ success: true, message: "Order refunded" });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/pos-orders/:id/void", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { reason } = req.body;
      const orderId = req.params.id;
      
      await db.run("UPDATE pos_orders SET status = 'voided', payment_status = 'voided' WHERE id = ?", [orderId]);
      await db.run("DELETE FROM kitchen_orders WHERE order_id = ?", [orderId]);
      
      res.json({ success: true, message: "Order voided" });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * SPLIT PAYMENTS
   */
  router.post("/pos-orders/:id/split", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { splits } = req.body;
      const orderId = req.params.id;
      
      if (!splits || !Array.isArray(splits) || splits.length < 2) {
        return res.status(400).json({ error: "Se requieren al menos 2 formas de dividir" });
      }

      const order = await db.get("SELECT * FROM pos_orders WHERE id = ?", [orderId]);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const tenantId = (order as any).tenant_id;

      await db.run("BEGIN TRANSACTION");
      try {
        const splitIds: string[] = [];
        for (const split of splits) {
          const splitId = "spl_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
          await db.run(`
            INSERT INTO split_payments (id, order_id, tenant_id, split_label, amount, tip, payment_method, items)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [splitId, orderId, tenantId, split.label || "Split", split.amount, split.tip || 0, split.payment_method || 'cash', split.items ? JSON.stringify(split.items) : null]);
          splitIds.push(splitId);
        }
        await db.run("COMMIT");

        // Calculate total from all splits
        const totalFromSplits = splits.reduce((sum: number, s: any) => sum + Number(s.amount) + Number(s.tip || 0), 0);
        const orderTotal = Number((order as any).total || 0);

        res.json({ 
          success: true, 
          message: `Orden dividida en ${splits.length} pagos`, 
          split_ids: splitIds,
          total_charged: totalFromSplits
        });
      } catch (innerErr) {
        await db.run("ROLLBACK");
        throw innerErr;
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/pos-orders/:id/splits", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const splits = await db.all("SELECT * FROM split_payments WHERE order_id = ? ORDER BY created_at ASC", [req.params.id]);
      res.json(splits || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * CASH DRAWER / SHIFT MANAGEMENT
   */
  router.post("/cash-drawer/open", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenant_id, opening_amount, user_id } = req.body;
      
      const activeShift = await db.get("SELECT id FROM cash_drawer_events WHERE tenant_id = ? AND event_type = 'open' AND closed_at IS NULL", [tenant_id]);
      if (activeShift) return res.status(400).json({ error: "Ya hay un turno abierto. Ciérralo antes de abrir otro." });

      const shiftId = "shift_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      await db.run(`
        INSERT INTO cash_drawer_events (id, tenant_id, user_id, event_type, opening_amount, opened_at)
        VALUES (?, ?, ?, 'open', ?, CURRENT_TIMESTAMP)
      `, [shiftId, tenant_id, user_id || null, opening_amount || 0]);

      res.json({ success: true, shift_id: shiftId });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/cash-drawer/close", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenant_id, closing_amount, notes, user_id } = req.body;

      const activeShift = await db.get("SELECT * FROM cash_drawer_events WHERE tenant_id = ? AND event_type = 'open' AND closed_at IS NULL", [tenant_id]);
      if (!activeShift) return res.status(400).json({ error: "No hay turno abierto para cerrar." });

      const s = activeShift as any;

      // Aggregate sales per payment method from this shift
      const shiftStart = s.opened_at;
      const totals = await db.all(`
        SELECT payment_method, COALESCE(SUM(amount + tip), 0) as total
        FROM order_payments op
        JOIN pos_orders po ON op.order_id = po.id
        WHERE po.tenant_id = ? AND po.paid_at >= ? AND op.payment_status = 'completed'
        GROUP BY payment_method
      `, [tenant_id, shiftStart]);

      let cashSales = 0, cardSales = 0, transferSales = 0, otherSales = 0, totalTips = 0;
      for (const t of totals) {
        const method = (t as any).payment_method?.toLowerCase();
        const total = Number((t as any).total);
        if (method === 'cash') cashSales = total;
        else if (method === 'card' || method === 'credit') cardSales = total;
        else if (method === 'transfer') transferSales = total;
        else otherSales += total;
      }

      const tipTotals = await db.get("SELECT COALESCE(SUM(tip), 0) as tips FROM pos_orders WHERE tenant_id = ? AND paid_at >= ?", [tenant_id, shiftStart]);
      totalTips = Number((tipTotals as any)?.tips || 0);

      const refunds = await db.get("SELECT COALESCE(SUM(refund_amount), 0) as returns FROM order_payments WHERE tenant_id = ? AND payment_status = 'refunded' AND refunded_at >= ?", [tenant_id, shiftStart]);
      const refundsTotal = Number((refunds as any)?.returns || 0);

      const expectedAmount = Number(s.opening_amount) + cashSales + cardSales + transferSales + otherSales + totalTips - refundsTotal;
      const difference = Number(closing_amount || 0) - expectedAmount;

      await db.run(`
        UPDATE cash_drawer_events SET 
          event_type = 'closed',
          closing_amount = ?, 
          expected_amount = ?,
          difference = ?,
          cash_sales = ?,
          card_sales = ?,
          transfer_sales = ?,
          other_sales = ?,
          total_tips = ?,
          refunds_total = ?,
          notes = ?,
          closed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [closing_amount || 0, expectedAmount, difference, cashSales, cardSales, transferSales, otherSales, totalTips, refundsTotal, notes || null, s.id]);

      res.json({ 
        success: true, 
        shift_id: s.id,
        expected_amount: expectedAmount,
        closing_amount: closing_amount || 0,
        difference,
        cash_sales: cashSales,
        card_sales: cardSales,
        transfer_sales: transferSales,
        total_tips: totalTips,
        refunds_total: refundsTotal
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/cash-drawer/:tenantId/history", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const shifts = await db.all(
        "SELECT * FROM cash_drawer_events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50",
        [req.params.tenantId]
      );
      res.json(shifts || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/cash-drawer/:tenantId/active", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const active = await db.get("SELECT * FROM cash_drawer_events WHERE tenant_id = ? AND event_type = 'open' AND closed_at IS NULL", [req.params.tenantId]);
      res.json(active || null);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/payments/:tenantId/history", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const payments = await db.all(
        `SELECT op.*, po.table_number, po.status as order_status, po.total as order_total
         FROM order_payments op
         JOIN pos_orders po ON op.order_id = po.id
         WHERE op.tenant_id = ?
         ORDER BY op.created_at DESC LIMIT 100`,
        [req.params.tenantId]
      );
      res.json(payments || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * BILLING & SUBSCRIPTION
   */
  router.post("/upgrade", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenant_id, plan } = req.body;
      const mrr = plan === 'Pro' ? 99 : 29;
      await db.run(
        "UPDATE tenants SET plan = ?, mrr = ?, subscription_status = 'active' WHERE id = ?",
        [plan, mrr, tenant_id]
      );
      res.json({ success: true, message: "Subscription upgraded" });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/invoices/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const invoices = await db.all(
        "SELECT id, amount, currency, status, due_date, paid_at, created_at FROM invoices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 24",
        [req.params.tenantId]
      );
      res.json(invoices || []);
    } catch (e) {
      logger.error({ err: e }, "[tenant/invoices]");
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/cancel-subscription", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenant_id } = req.body;
      await db.run(
        "UPDATE subscriptions SET cancel_at_period_end = 1 WHERE tenant_id = ?",
        [tenant_id]
      );
      await db.run(
        "UPDATE tenants SET subscription_status = ? WHERE id = ?",
        ["canceling", tenant_id]
      );
      res.json({ success: true, message: "Subscription will be canceled at end of period" });
    } catch (e) {
      logger.error({ err: e }, "[tenant/cancel]");
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * NOTIFICATIONS & COMMUNICATION API
   */
  router.get("/notifications/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const notifs = await db.all(
        "SELECT id, type, title, message, link, read, created_at FROM notifications WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50",
        [req.params.tenantId]
      );
      res.json(notifs || []);
    } catch (e) {
      logger.error({ err: e }, "[tenant/notifications]");
      res.status(500).json({ error: String(e) });
    }
  });

  router.patch("/notifications/:id/read", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      await db.run("UPDATE notifications SET read = true WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.patch("/notifications/:tenantId/read-all", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      await db.run("UPDATE notifications SET read = true WHERE tenant_id = ? AND read = false", [req.params.tenantId]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/conversations/:tenantId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenantId } = req.params;
      const conversations = await db.all(
        `SELECT h.customer_phone, MAX(h.created_at) as last_message_at, COUNT(*) as message_count,
         MAX(CASE WHEN h.role = 'user' THEN h.message END) as last_message,
         c.push_name, c.profile_pic_url
         FROM whatsapp_chat_history h
         LEFT JOIN whatsapp_contacts c ON c.tenant_id = h.tenant_id AND c.phone = h.customer_phone
         WHERE h.tenant_id = ? GROUP BY h.customer_phone, c.push_name, c.profile_pic_url ORDER BY last_message_at DESC LIMIT 100`,
        [tenantId]
      );
      
      // Lazy load missing contact info directly from active WhatsApp socket
      const sock = (global as any).__waConnections ? (global as any).__waConnections[tenantId] : null;
      if (sock && conversations) {
        let updated = false;
        for (const conv of conversations) {
          if (!conv.profile_pic_url || !conv.push_name) {
            try {
              let fetchedPic = conv.profile_pic_url;
              let fetchedName = conv.push_name;
              
              if (!fetchedPic) {
                try {
                  fetchedPic = await sock.profilePictureUrl(conv.customer_phone, 'image');
                } catch (e) {} // May not exist or be private
              }
              
              // We can't easily get pushName retrospectively without a message event,
              // but we can at least save the fetched picture to DB.
              if (fetchedPic !== conv.profile_pic_url || fetchedName !== conv.push_name) {
                conv.profile_pic_url = fetchedPic;
                conv.push_name = fetchedName;
                updated = true;
                
                await db.run(
                  `INSERT INTO whatsapp_contacts (tenant_id, phone, push_name, profile_pic_url, updated_at)
                   VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                   ON CONFLICT (tenant_id, phone) DO UPDATE SET
                     push_name = COALESCE(EXCLUDED.push_name, whatsapp_contacts.push_name),
                     profile_pic_url = COALESCE(EXCLUDED.profile_pic_url, whatsapp_contacts.profile_pic_url),
                     updated_at = CURRENT_TIMESTAMP`,
                  [tenantId, conv.customer_phone, fetchedName || '', fetchedPic || '']
                );
              }
            } catch (err) {
              console.error("[WhatsApp] Error lazy loading contact info:", err);
            }
          }
        }
      }
      
      res.json(conversations || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/conversations/:tenantId/:phone', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenantId, phone } = req.params;
      const messages = await db.all(
        `SELECT id, role, message, created_at FROM whatsapp_chat_history WHERE tenant_id = ? AND customer_phone = ? ORDER BY created_at ASC`,
        [tenantId, decodeURIComponent(phone)]
      );
      res.json(messages || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/conversations/:tenantId/control/:phone', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenantId, phone } = req.params;
      const control = await db.get(
        "SELECT is_bot_active FROM whatsapp_chat_control WHERE tenant_id = ? AND customer_phone = ?",
        [tenantId, decodeURIComponent(phone)]
      );
      res.json({ is_bot_active: control ? control.is_bot_active !== 0 : true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/conversations/toggle-bot', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenantId, phone, isActive } = req.body;
      await db.run(
        `INSERT INTO whatsapp_chat_control (tenant_id, customer_phone, is_bot_active, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(tenant_id, customer_phone) DO UPDATE SET is_bot_active = excluded.is_bot_active, updated_at = CURRENT_TIMESTAMP`,
        [tenantId, phone, isActive ? 1 : 0]
      );
      res.json({ success: true, isActive });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/conversations/send', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenantId, phone, message } = req.body;
      
      const { sendWhatsAppNotification } = await import("../services/whatsappNotifier.js");
      const sent = await sendWhatsAppNotification(tenantId, phone, message);
      
      if (sent) {
        await db.run(
          "INSERT INTO whatsapp_chat_history (tenant_id, customer_phone, role, message) VALUES (?, ?, 'model', ?)",
          [tenantId, phone, message]
        );
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "WhatsApp service disconnected or could not send message." });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * METRICS & ANALYTICS
   */
  router.get("/order-limit/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const tenant = await db.get("SELECT plan FROM tenants WHERE id = ?", [req.params.tenantId]);
      const planName = (tenant as any)?.plan || 'Pro';
      const limit = planName === 'Pro' || planName === 'Enterprise' ? -1 : 1000;
      res.json({
        allowed: true,
        used: 0,
        limit: limit,
        remaining: limit === -1 ? -1 : limit
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/whatsapp-orders/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const orders = await db.all("SELECT * FROM whatsapp_orders WHERE tenant_id = ? ORDER BY created_at DESC", [req.params.tenantId]);
      res.json(orders || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * DINING TABLES
   */
  router.get("/tables/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const tables = await db.all("SELECT * FROM dining_tables WHERE tenant_id = ? ORDER BY table_number ASC", [req.params.tenantId]);
      res.json(tables || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/tables", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { id, tenant_id, table_number, capacity, status } = req.body;
      const finalId = id || "table_" + Math.random().toString(36).substr(2, 9);
      const qrUrl = `/menu/${tenant_id}?table=${table_number}`;
      
      await db.run(`
        INSERT INTO dining_tables (id, tenant_id, table_number, capacity, qr_code_url, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          table_number = EXCLUDED.table_number,
          capacity = EXCLUDED.capacity,
          qr_code_url = EXCLUDED.qr_code_url,
          status = EXCLUDED.status
      `, [finalId, tenant_id, table_number, capacity || 4, qrUrl, status || 'Available']);
      
      res.json({ message: "Table saved successfully", id: finalId, qr_code_url: qrUrl });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.delete("/tables/:id", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      await db.run("DELETE FROM dining_tables WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * TAXES & FEES
   */
  router.get("/taxes/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const taxes = await db.all("SELECT * FROM tenant_taxes WHERE tenant_id = ? AND status = 'Active' ORDER BY created_at ASC", [req.params.tenantId]);
      res.json(taxes || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/taxes", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { id, tenant_id, name, tax_rate, type, status } = req.body;
      const finalId = id || "tax_" + Math.random().toString(36).substr(2, 9);
      
      await db.run(`
        INSERT INTO tenant_taxes (id, tenant_id, name, tax_rate, type, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          tax_rate = EXCLUDED.tax_rate,
          type = EXCLUDED.type,
          status = EXCLUDED.status
      `, [finalId, tenant_id, name, tax_rate, type || 'Percentage', status || 'Active']);
      
      res.json({ message: "Tax configuration saved successfully", id: finalId });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * COUPONS MANAGEMENT
   */
  router.get("/coupons/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const coupons = await db.all("SELECT * FROM tenant_coupons WHERE tenant_id = ? ORDER BY created_at DESC", [req.params.tenantId]);
      res.json(coupons || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/coupons", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { id, tenant_id, name, code, discount, discount_type, start_date, end_date, minimum_order, maximum_discount, limit_per_user, status } = req.body;
      const finalId = id || "coupon_" + Math.random().toString(36).substr(2, 9);
      
      await db.run(`
        INSERT INTO tenant_coupons (id, tenant_id, name, code, discount, discount_type, start_date, end_date, minimum_order, maximum_discount, limit_per_user, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          discount = EXCLUDED.discount,
          discount_type = EXCLUDED.discount_type,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          minimum_order = EXCLUDED.minimum_order,
          maximum_discount = EXCLUDED.maximum_discount,
          limit_per_user = EXCLUDED.limit_per_user,
          status = EXCLUDED.status
      `, [finalId, tenant_id, name, code, discount, discount_type || 'Percentage', start_date, end_date, minimum_order || 0, maximum_discount || null, limit_per_user || 1, status || 'Active']);
      
      res.json({ message: "Coupon saved successfully", id: finalId });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/coupons/validate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenant_id, code, subtotal } = req.body;
      const coupon = await db.get("SELECT * FROM tenant_coupons WHERE tenant_id = ? AND code = ? AND status = 'Active'", [tenant_id, code]);
      if (!coupon) {
        return res.status(404).json({ valid: false, error: "El cupón no existe o está inactivo." });
      }
      
      const today = new Date().toISOString().split('T')[0];
      if (today < (coupon as any).start_date || today > (coupon as any).end_date) {
        return res.status(400).json({ valid: false, error: "El cupón ha expirado o aún no es válido." });
      }
      
      if (subtotal < (coupon as any).minimum_order) {
        return res.status(400).json({ valid: false, error: `El pedido mínimo para usar este cupón es de $${(coupon as any).minimum_order.toFixed(2)}` });
      }
      
      let discountAmount = 0;
      if ((coupon as any).discount_type === 'Percentage') {
        discountAmount = (subtotal * (coupon as any).discount) / 100;
        if ((coupon as any).maximum_discount && discountAmount > (coupon as any).maximum_discount) {
          discountAmount = (coupon as any).maximum_discount;
        }
      } else {
        discountAmount = (coupon as any).discount;
      }
      
      res.json({
        valid: true,
        coupon_id: (coupon as any).id,
        code: (coupon as any).code,
        discount_amount: discountAmount,
        discount_type: (coupon as any).discount_type,
        discount_value: (coupon as any).discount
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * WAITERS MANAGEMENT (PHASE 1 SECURED)
   */
  router.get("/waiters/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const waiters = await db.all("SELECT * FROM tenant_waiters WHERE tenant_id = ? ORDER BY created_at DESC", [req.params.tenantId]);
      res.json(waiters || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/waiters", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { id, tenant_id, name, pin, status } = req.body;
      const finalId = id || "waiter_" + Math.random().toString(36).substr(2, 9);
      let finalPin = pin;
      
      const existing = id ? await db.get("SELECT pin FROM tenant_waiters WHERE id = ?", [id]) : null;

      if (pin) {
        if (!pin.toString().startsWith('$2b$')) {
           finalPin = await bcrypt.hash(pin.toString(), 10);
        }
      } else if (existing) {
        finalPin = (existing as any).pin;
      } else {
        return res.status(400).json({ error: "El PIN es requerido para nuevos meseros" });
      }

      await db.run(`
        INSERT INTO tenant_waiters (id, tenant_id, name, pin, status)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          pin = EXCLUDED.pin,
          status = EXCLUDED.status
      `, [finalId, tenant_id, name, finalPin, status || 'Active']);
      
      res.json({ message: "Waiter saved successfully", id: finalId });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/waiters/verify-pin", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenant_id, pin } = req.body;
      if (!pin) return res.status(400).json({ valid: false, error: "PIN requerido" });

      const waiters = await db.all("SELECT * FROM tenant_waiters WHERE tenant_id = ? AND status = 'Active'", [tenant_id]);
      
      let matchingWaiter = null;
      for (const w of waiters) {
        let isMatch = false;
        if (w.pin.startsWith('$2b$') || w.pin.startsWith('$2a$')) {
           isMatch = await bcrypt.compare(pin.toString(), w.pin);
        } else {
           isMatch = w.pin === pin.toString();
           if (isMatch) {
              const newHash = await bcrypt.hash(pin.toString(), 10);
              await db.run("UPDATE tenant_waiters SET pin = ? WHERE id = ?", [newHash, w.id]);
           }
        }

        if (isMatch) {
          matchingWaiter = w;
          break;
        }
      }

      if (matchingWaiter) {
        const sanitized = { ...matchingWaiter };
        delete (sanitized as any).pin;
        res.json({ valid: true, waiter: sanitized });
      } else {
        res.status(401).json({ valid: false, error: "PIN incorrecto." });
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * DELIVERY LOGISTICS CONFIG
   */
  router.get("/delivery-rules/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const rules = await db.all("SELECT * FROM tenant_delivery_rules WHERE tenant_id = ? ORDER BY created_at DESC", [req.params.tenantId]);
      res.json(rules || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/delivery-rules", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { id, tenant_id, name, min_distance, max_distance, delivery_fee, status } = req.body;
      const finalId = id || "rule_" + Math.random().toString(36).substr(2, 9);
      
      await db.run(`
        INSERT INTO tenant_delivery_rules (id, tenant_id, name, min_distance, max_distance, delivery_fee, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          min_distance = EXCLUDED.min_distance,
          max_distance = EXCLUDED.max_distance,
          delivery_fee = EXCLUDED.delivery_fee,
          status = EXCLUDED.status
      `, [finalId, tenant_id, name, Number(min_distance), Number(max_distance), Number(delivery_fee), status || 'Active']);
      
      res.json({ message: "Rule saved successfully", id: finalId });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/delivery-rules/calculate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenant_id, distance } = req.body;
      const dist = Number(distance);
      const rule = await db.get(
        "SELECT * FROM tenant_delivery_rules WHERE tenant_id = ? AND min_distance <= ? AND max_distance >= ? AND status = 'Active'",
        [tenant_id, dist, dist]
      );
      if (rule) {
        res.json({ fee: (rule as any).delivery_fee, rule });
      } else {
        res.json({ fee: 0, message: "No active delivery rule matches this distance." });
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * MENU OPTIONS (ADDONS, VARIANTS)
   */
  router.get("/menu-options/:menuItemId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const itemId = req.params.menuItemId;
      const attributes = await db.all("SELECT * FROM item_attributes WHERE menu_item_id = ?", [itemId]);
      const extras = await db.all("SELECT * FROM item_extras WHERE menu_item_id = ?", [itemId]);
      const addons = await db.all("SELECT * FROM item_addons WHERE menu_item_id = ?", [itemId]);
      res.json({ attributes, extras, addons });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/menu-options", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      const { type, id, menu_item_id, name, price, options } = req.body;
      const finalId = id || "opt_" + Math.random().toString(36).substr(2, 9);
      
      if (type === 'attribute') {
        await db.run(`
          INSERT INTO item_attributes (id, menu_item_id, name, options)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, options = EXCLUDED.options
        `, [finalId, menu_item_id, name, options]);
      } else if (type === 'extra') {
        await db.run(`
          INSERT INTO item_extras (id, menu_item_id, name, price)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price
        `, [finalId, menu_item_id, name, price]);
      } else if (type === 'addon') {
        await db.run(`
          INSERT INTO item_addons (id, menu_item_id, name, price)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price
        `, [finalId, menu_item_id, name, price]);
      }
      
      res.json({ message: "Menu option saved successfully", id: finalId });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * KITCHEN ORDERS (KDS)
   */
  router.get("/kitchen-orders/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const orders = await db.all("SELECT * FROM kitchen_orders WHERE tenant_id = ? ORDER BY created_at DESC", [req.params.tenantId]);
      res.json(orders || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/kitchen-orders/status", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      const { id, status } = req.body;
      await db.run("UPDATE kitchen_orders SET status = ? WHERE id = ?", [status, id]);
      res.json({ message: "Kitchen order status updated" });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * GLOBAL SETTINGS & AI CONFIG
   */
  router.post("/settings", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { 
        tenant_id, country, currency, country_code, phone_number,
        whatsapp_number, smtp_host, smtp_port, smtp_user, smtp_pass, logo_url,
        opening_time, closing_time, facebook_url, instagram_url, min_order_value,
        latitude, longitude, delivery_base_fee, delivery_per_km_fee, delivery_max_distance,
        currency_symbol
      } = req.body;
      
      await db.run(`
        INSERT INTO tenant_settings (
          tenant_id, country, currency, country_code, phone_number, whatsapp_number, 
          smtp_host, smtp_port, smtp_user, smtp_pass, logo_url,
          opening_time, closing_time, facebook_url, instagram_url, min_order_value,
          latitude, longitude, delivery_base_fee, delivery_per_km_fee, delivery_max_distance,
          currency_symbol
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET 
          country=excluded.country, 
          currency=excluded.currency, 
          country_code=excluded.country_code, 
          phone_number=excluded.phone_number, 
          whatsapp_number=excluded.whatsapp_number, 
          smtp_host=excluded.smtp_host, 
          smtp_port=excluded.smtp_port, 
          smtp_user=excluded.smtp_user, 
          smtp_pass=excluded.smtp_pass, 
          logo_url=excluded.logo_url,
          opening_time=excluded.opening_time,
          closing_time=excluded.closing_time,
          facebook_url=excluded.facebook_url,
          instagram_url=excluded.instagram_url,
          min_order_value=excluded.min_order_value,
          latitude=excluded.latitude,
          longitude=excluded.longitude,
          delivery_base_fee=excluded.delivery_base_fee,
          delivery_per_km_fee=excluded.delivery_per_km_fee,
          delivery_max_distance=excluded.delivery_max_distance,
          currency_symbol=excluded.currency_symbol
      `, [
        tenant_id, country, currency, country_code, phone_number, whatsapp_number, 
        smtp_host, smtp_port, smtp_user, smtp_pass, logo_url,
        opening_time, closing_time, facebook_url, instagram_url, Number(min_order_value || 0),
        latitude != null ? Number(latitude) : null, longitude != null ? Number(longitude) : null,
        Number(delivery_base_fee || 0), Number(delivery_per_km_fee || 0), Number(delivery_max_distance || 0),
        currency_symbol || '$'
      ]);
      
      res.json({ message: "Settings updated" });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/ai-config", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const { tenant_id, custom_instructions, identity_prompt, operational_rules, auto_upselling, reservation_confirmation, loyalty_rewards } = req.body;
      await db.run(
        "UPDATE ai_config SET custom_instructions = ?, identity_prompt = ?, operational_rules = ?, auto_upselling = ?, reservation_confirmation = ?, loyalty_rewards = ? WHERE tenant_id = ?",
        [custom_instructions, identity_prompt, operational_rules, auto_upselling ? 1 : 0, reservation_confirmation ? 1 : 0, loyalty_rewards ? 1 : 0, tenant_id]
      );
      res.json({ message: "AI configuration updated" });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/settings/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const settings = await db.get("SELECT * FROM tenant_settings WHERE tenant_id = ?", [req.params.tenantId]);
      res.json(settings || {});
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post("/ai-assist", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { text, action } = req.body;
      const { generateAIContent } = await import("../services/aiService.js");
      
      let subPrompt = "Improve grammar, punctuation, clarity and professionalism while maintaining conversational WhatsApp tone.";
      if (action === 'translate') {
        subPrompt = "Translate this to proper English if it is Spanish, or proper Spanish if it is English. Keep the tone natural.";
      } else if (action === 'shorter') {
        subPrompt = "Rewrite to be much more concise and direct.";
      }

      const systemPrompt = `You are a writing assistant. ${subPrompt} Provide ONLY the refined text string. No intro, no quote marks.`;
      const result = await generateAIContent(text, systemPrompt);
      res.json({ refined: result.text });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * BUSINESS REPORTS
   */
  router.get("/reports/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const tenantId = req.params.tenantId;
      const period = req.query.period as string || "week";

      let dateFilter = "";
      // Translate SQLite datetime functions safely, OR assume DBWrapper translation
      // To prevent collision, keeping close to original
      if (period === "today") dateFilter = "AND DATE(po.created_at) = CURRENT_DATE";
      else if (period === "week") dateFilter = "AND po.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'";
      else if (period === "month") dateFilter = "AND po.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'";

      const summary = await db.get(`
        SELECT COALESCE(SUM(total), 0) as totalSales, COUNT(*) as totalOrders 
        FROM pos_orders po WHERE tenant_id = ? ${dateFilter}
      `, [tenantId]);

      const summaryVal = summary as any;
      const avgTicket = summaryVal.totalOrders > 0 ? summaryVal.totalSales / summaryVal.totalOrders : 0;

      const waOrders = await db.get(`
        SELECT COUNT(*) as cnt FROM pos_orders po 
        WHERE tenant_id = ? AND table_number = 'WhatsApp' ${dateFilter}
      `, [tenantId]);

      const salesByDay = await db.all(`
        SELECT DATE(po.created_at) as day, 
               COALESCE(SUM(total), 0) as total,
               COUNT(*) as orders
        FROM pos_orders po WHERE tenant_id = ? ${dateFilter}
        GROUP BY DATE(po.created_at) ORDER BY day ASC
      `, [tenantId]);

      const topProducts = await db.all(`
        SELECT mi.name, SUM(poi.quantity) as quantity
        FROM pos_order_items poi
        JOIN pos_orders po ON poi.order_id = po.id
        LEFT JOIN menu_items mi ON poi.menu_item_id = mi.id
        WHERE po.tenant_id = ? ${dateFilter}
        GROUP BY mi.name, poi.menu_item_id ORDER BY quantity DESC LIMIT 10
      `, [tenantId]);

      const channelData = await db.all(`
        SELECT 
          CASE 
            WHEN table_number = 'WhatsApp' THEN 'WhatsApp'
            WHEN table_number LIKE 'Llevar%' THEN 'Para Llevar'
            ELSE 'En Mesa'
          END as channel,
          COALESCE(SUM(total), 0) as total
        FROM pos_orders po WHERE tenant_id = ? ${dateFilter}
        GROUP BY channel
      `, [tenantId]);

      res.json({
        totalSales: summaryVal.totalSales,
        totalOrders: summaryVal.totalOrders,
        avgTicket,
        whatsappOrders: (waOrders as any)?.cnt || 0,
        salesByDay: salesByDay || [],
        topProducts: topProducts || [],
        salesByChannel: (channelData || []).map((c: any) => ({ name: c.channel, value: c.total })),
      });
    } catch (e) {
      logger.error({ err: e }, "[reports]");
      res.status(500).json({ error: String(e) });
    }
  });

  /**
   * DELIVERIES & DISPATCHING (COURIER MANAGEMENT)
   */
  router.get("/drivers/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const drivers = await db.all("SELECT * FROM delivery_drivers WHERE tenant_id = ? ORDER BY created_at DESC", [req.params.tenantId]);
      res.json(drivers || []);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.post("/drivers", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      const { tenant_id, name, phone, pin, id } = req.body;
      if (id) {
        await db.run("UPDATE delivery_drivers SET name = ?, phone = ?, pin = ? WHERE id = ? AND tenant_id = ?", [name, phone, pin, id, tenant_id]);
      } else {
        const newId = "drv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
        await db.run("INSERT INTO delivery_drivers (id, tenant_id, name, phone, pin) VALUES (?, ?, ?, ?, ?)", [newId, tenant_id, name, phone, pin]);
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.patch("/drivers/:id/availability", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      const { is_available } = req.body;
      await db.run("UPDATE delivery_drivers SET is_available = ? WHERE id = ?", [is_available ? 1 : 0, req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.get("/delivery-assignments/:tenantId", authenticateToken, verifyTenantAccess, async (req: AuthRequest, res) => {
    try {
      const db = getDb();
      const assignments = await db.all(`
        SELECT da.*, dd.name as driver_name, dd.phone as driver_phone
        FROM delivery_assignments da
        LEFT JOIN delivery_drivers dd ON da.driver_id = dd.id
        WHERE da.tenant_id = ? AND da.status != 'delivered'
        ORDER BY da.created_at DESC
      `, [req.params.tenantId]);
      res.json(assignments || []);
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.post("/delivery-assignments/assign", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      const { assignment_id, driver_id } = req.body;
      const dToken = crypto.randomBytes(16).toString('hex');
      const cToken = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

      await db.run(`
        UPDATE delivery_assignments 
        SET driver_id = ?, status = 'assigned', assigned_at = ?, 
            driver_token = ?, customer_token = ?, expires_at = ? 
        WHERE id = ?
      `, [driver_id, new Date().toISOString(), dToken, cToken, expiresAt, assignment_id]);
      
      res.json({ success: true, driver_token: dToken, customer_token: cToken });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.post("/delivery-assignments/auto-assign", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      const { assignment_id, tenant_id } = req.body;
      const driver = await db.get(`
        SELECT dd.id, dd.name,
          (SELECT COUNT(*) FROM delivery_assignments da WHERE da.driver_id = dd.id AND da.status IN ('assigned', 'picked_up')) as active_count
        FROM delivery_drivers dd
        WHERE dd.tenant_id = ? AND dd.is_available = 1 AND dd.status = 'active'
        ORDER BY active_count ASC
        LIMIT 1
      `, [tenant_id]);

      if (!driver) return res.status(400).json({ error: "No hay repartidores disponibles" });

      const dToken = crypto.randomBytes(16).toString('hex');
      const cToken = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); 

      await db.run(`
        UPDATE delivery_assignments 
        SET driver_id = ?, status = 'assigned', assigned_at = ?, 
            driver_token = ?, customer_token = ?, expires_at = ? 
        WHERE id = ?
      `, [(driver as any).id, new Date().toISOString(), dToken, cToken, expiresAt, assignment_id]);
      
      res.json({ success: true, driver_name: (driver as any).name, driver_token: dToken, customer_token: cToken });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  router.patch("/delivery-assignments/:id/status", authenticateToken, async (req, res) => {
    try {
      const db = getDb();
      const { status } = req.body;
      const now = new Date().toISOString();
      
      const assignment = await db.get("SELECT * FROM delivery_assignments WHERE id = ?", [req.params.id]);
      const asn = assignment as any;
      
      if (status === "picked_up") {
        await db.run("UPDATE delivery_assignments SET status = 'picked_up', picked_up_at = ? WHERE id = ?", [now, req.params.id]);
        
        if (asn?.customer_phone && asn?.tenant_id) {
          try {
            await sendWhatsAppNotification(asn.tenant_id, asn.customer_phone, 
              `🛵 ¡Tu repartidor ya recogió tu pedido y va en camino! Estará contigo pronto.`);
          } catch (e) { logger.warn({ err: e }, "[Delivery] Could not send pickup notification"); }
        }
      } else if (status === "delivered") {
        await db.run("UPDATE delivery_assignments SET status = 'delivered', delivered_at = ? WHERE id = ?", [now, req.params.id]);
        if (asn?.driver_id) {
          await db.run("UPDATE delivery_drivers SET total_deliveries = total_deliveries + 1 WHERE id = ?", [asn.driver_id]);
        }
        
        if (asn?.customer_phone && asn?.tenant_id) {
          try {
            await sendWhatsAppNotification(asn.tenant_id, asn.customer_phone, 
              `✅ ¡Tu pedido ha sido entregado! Gracias por tu compra. ¡Esperamos verte pronto! ⭐`);
          } catch (e) { logger.warn({ err: e }, "[Delivery] Could not send delivery notification"); }
        }
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  return router;
}

/**
 * STANDALONE DASHBOARD DATA AGGREGATOR HANDLER
 * Extracted to support legacy root binding /api/tenant-dashboard/:id
 */
export async function handleTenantDashboard(req: AuthRequest, res: express.Response) {
  try {
    const db = getDb();
    const tenantId = req.params.tenantId;

    const tenantInfo = await db.get("SELECT id, name, status, plan, mrr, bg_color, init_letters, trial_ends_at, subscription_status FROM tenants WHERE id = ?", [tenantId]);
    const settings = await db.get("SELECT * FROM tenant_settings WHERE tenant_id = ?", [tenantId]) || {};
    const metrics = await db.get("SELECT * FROM metrics WHERE tenant_id = ?", [tenantId]);
    const categories = await db.all("SELECT * FROM categories WHERE tenant_id = ? ORDER BY name ASC", [tenantId]);
    const menuItems = await db.all("SELECT * FROM menu_items WHERE tenant_id = ?", [tenantId]);
    const aiConfig = await db.get("SELECT * FROM ai_config WHERE tenant_id = ?", [tenantId]);
    const aiLogs = await db.all("SELECT * FROM ai_logs WHERE tenant_id = ? ORDER BY id ASC", [tenantId]);
    const activeOrders = await db.all(`
      SELECT o.*, 
             (SELECT COUNT(*) FROM pos_order_items WHERE order_id = o.id) as item_count
      FROM pos_orders o 
      WHERE o.tenant_id = ? AND o.status != 'closed' 
      ORDER BY o.created_at DESC
    `, [tenantId]);

    if (!tenantInfo) return res.status(404).json({error: "Tenant not found"});

    res.json({
      tenant: tenantInfo,
      settings: settings || {},
      metrics: metrics || { today_sales: 0, ai_orders_count: 0, automation_rate: 0 },
      categories: categories || [],
      menuItems: menuItems || [],
      aiConfig: aiConfig || { identity_prompt: '', custom_instructions: '' },
      aiLogs: aiLogs || [],
      activeOrders: activeOrders || []
    });
  } catch (e) {
    logger.error({ err: e, tenantId }, "[handleTenantDashboard] Error fetching dashboard data");
    res.status(500).json({error: String(e)});
  }
}
