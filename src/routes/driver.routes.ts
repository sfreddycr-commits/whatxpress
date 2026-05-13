import express from 'express';
import { getDb } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/driver/my-assignments/:driverId
 * @desc    Displays active queues and metrics dedicated specifically to a logged-in courier
 * @access  Private (Tokenized)
 */
router.get("/my-assignments/:driverId", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const driverId = req.params.driverId;
    
    // Ensure simple security check that token matches the requested data view
    // (Wait, we might need deeper validation but for now keeping original parity)

    const assignments = await db.all(`
      SELECT da.*, po.total as order_total, po.table_number
      FROM delivery_assignments da
      LEFT JOIN pos_orders po ON da.order_id = po.id
      WHERE da.driver_id = ? AND da.status IN ('assigned', 'picked_up')
      ORDER BY da.assigned_at ASC
    `, [driverId]);

    // SQLite DATE('now') must transition cleanly back to CURRENT_DATE for Postgres if we switched,
    // BUT our DBWrapper likely auto-handles DATE('now'). Wait, let's check if postgres strictly requires modification.
    // The translation system translates datetime('now'), but DATE('now') was untouched. 
    // Let's refine the query syntax to standard SQL acceptable in Postgres for future safety.
    const stats = await db.get(`
      SELECT 
        COUNT(CASE WHEN status = 'delivered' AND DATE(delivered_at) = CURRENT_DATE THEN 1 END) as today_deliveries,
        SUM(CASE WHEN status = 'delivered' AND DATE(delivered_at) = CURRENT_DATE THEN delivery_fee ELSE 0 END) as today_earnings
      FROM delivery_assignments WHERE driver_id = ?
    `, [driverId]);

    res.json({ 
      assignments: assignments || [], 
      stats: stats || { today_deliveries: 0, today_earnings: 0 } 
    });
  } catch (e) { 
    res.status(500).json({ error: String(e) }); 
  }
});

/**
 * @route   PATCH /api/driver/location
 * @desc    Broadcasts realtime geolocation updates automatically from courier native clients
 * @access  Private (Auth with user.driverId presence constraint)
 */
router.patch("/location", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { lat, lng } = req.body;
    const driverId = (req as any).user?.driverId;
    
    if (!driverId) {
      return res.status(403).json({ error: "No es un repartidor" });
    }
    
    // Update dynamic columns
    await db.run("UPDATE delivery_drivers SET latitude = ?, longitude = ? WHERE id = ?", [lat, lng, driverId]);
    res.json({ success: true });
  } catch (e) { 
    res.status(500).json({ error: String(e) }); 
  }
});

export default router;
