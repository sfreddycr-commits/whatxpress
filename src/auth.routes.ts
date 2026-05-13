import express from 'express';
import { getDb } from '../db.js';
import { AuthService } from '../services/authService.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router = express.Router();

// Lazy instantiate auth service when needed (or instantiate it once)
let authServiceInstance: AuthService | null = null;
function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService(getDb());
  }
  return authServiceInstance;
}

/**
 * @route   POST /api/auth/register
 * @desc    Registers a new primary user
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email y password son requeridos' });
      return;
    }
    const auth = getAuthService();
    const result = await auth.register(name, email, password, phone || '');
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Standard administrative user login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email y password son requeridos' });
      return;
    }
    const auth = getAuthService();
    const result = await auth.login(email, password);
    res.json(result);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

/**
 * @route   POST /api/auth/driver-login
 * @desc    Authenticates logistic drivers via ephemeral PIN validation
 */
router.post("/driver-login", async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      res.status(400).json({ error: 'Teléfono y PIN son requeridos' });
      return;
    }
    
    const db = getDb();
    const driver = await db.get("SELECT * FROM delivery_drivers WHERE phone = ? AND pin = ? AND status = 'active'", [phone.trim(), pin.trim()]);
    
    if (!driver) {
      res.status(401).json({ error: 'Credenciales inválidas o repartidor inactivo' });
      return;
    }
    
    const jwtLib = await import('jsonwebtoken');
    const token = jwtLib.default.sign(
      { driverId: driver.id, tenantId: driver.tenant_id, role: 'driver' }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      token, 
      driver: { id: driver.id, name: driver.name, phone: driver.phone, tenant_id: driver.tenant_id }, 
      role: 'driver' 
    });
  } catch (e: any) {
    logger.error({ err: e, phone }, "[driver-login] Error during driver authentication");
    res.status(500).json({ error: e.message });
  }
});

/**
 * @route   POST /api/public/register
 * @desc    Alternative public self-service registration flow (Legacy or specific landing)
 * NOTE: This endpoint technically serves a 'public' domain, but fits structurally within auth processing.
 * Keeping its exact legacy business logic untouched.
 */
export async function registerPublicAlternative(req: express.Request, res: express.Response) {
  try {
    const db = getDb();
    const { name, email, password } = req.body;
    const tenantId = "tenant_" + Math.random().toString(36).substr(2, 9);
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);
    
    const colors = [
      'bg-red-100 text-red-600',
      'bg-blue-100 text-blue-600',
      'bg-green-100 text-green-600',
      'bg-orange-100 text-orange-600',
      'bg-purple-100 text-purple-600'
    ];
    const bgColor = colors[Math.floor(Math.random() * colors.length)];
    const initLetters = (name || "RT").substring(0, 2).toUpperCase();

    await db.run(
      "INSERT INTO tenants (id, name, status, plan, mrr, bg_color, init_letters, trial_ends_at, subscription_status, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [tenantId, name, 'Active', 'Pro', 0, bgColor, initLetters, trialEndDate.toISOString(), 'trialing', password]
    );

    await db.run(
      "INSERT INTO tenant_settings (tenant_id, country, currency, country_code, phone_number, whatsapp_number, smtp_host, smtp_port, smtp_user, smtp_pass, logo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [tenantId, 'MX', 'MXN', '+52', '', '', '', 587, '', '', '']
    );

    // Create defaults for new tenant
    await db.run("INSERT INTO metrics (tenant_id, today_sales, ai_orders_count, automation_rate, active_tables, total_tables, pending_deliveries, attention_deliveries) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [tenantId, 0, 0, 0, 0, 0, 0, 0]);
    
    const welcomeMsg = `Soy el agente virtual de ${name || "nuestro restaurante"}. ¡Gracias por comunicarte a ${name || "nuestro restaurante"}!`;
    await db.run("INSERT INTO ai_config (tenant_id, custom_instructions, identity_prompt, auto_upselling, reservation_confirmation, loyalty_rewards) VALUES (?, ?, ?, ?, ?, ?)",
      [tenantId, 'Always be polite and helpful. Welcome the customer to our restaurant.', welcomeMsg, 1, 1, 0]);

    res.json({ success: true, tenantId });
  } catch (e) {
    logger.error({ err: e }, "[public-register]");
    res.status(500).json({ error: String(e) });
  }
}

export default router;
