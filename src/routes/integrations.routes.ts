import express from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { logger } from '../lib/logger.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { generateAIContent } from '../services/aiService.js';
import { 
  sendTrialEndingEmail, 
  sendRenewedEmail, 
  sendWelcomeEmail, 
  sendReceiptEmail 
} from '../services/emailService.js';

const router = express.Router();

/**
 * CRON / AUTOMATION ENDPOINTS
 */
router.get("/cron/process-renewals", async (req, res) => {
  const cronKey = req.headers["x-cron-key"];
  if (!process.env.CRON_API_KEY || cronKey !== process.env.CRON_API_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const results = { renewed: 0, cancelled: 0, trialWarnings: 0, errors: [] as string[] };
  try {
    const db = getDb();
    const now = new Date();
    const nowISO = now.toISOString();

    // 1. Process expiring trials
    const trialTenants = await db.all(
      "SELECT t.id, t.name, t.trial_ends_at, u.email FROM tenants t JOIN user_tenants ut ON t.id = ut.tenant_id JOIN users u ON ut.user_id = u.id WHERE t.subscription_status = ? AND t.trial_ends_at IS NOT NULL",
      ["trialing"]
    );
    for (const t of trialTenants) {
      if (!(t as any).trial_ends_at) continue;
      const trialEnd = new Date((t as any).trial_ends_at);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 2 && daysLeft >= 0 && (t as any).email) {
        try {
          await sendTrialEndingEmail((t as any).email, (t as any).name, daysLeft);
          results.trialWarnings++;
        } catch (e: any) { results.errors.push("trial-" + (t as any).id + ": " + String(e)); }
      }
    }

    // 2. Process past period end subscriptions
    const expiredSubs = await db.all(
      "SELECT s.tenant_id, s.status, s.cancel_at_period_end, s.current_period_end, t.name, t.plan, u.email FROM subscriptions s JOIN tenants t ON s.tenant_id = t.id JOIN user_tenants ut ON t.id = ut.tenant_id JOIN users u ON ut.user_id = u.id WHERE s.status = ? AND s.current_period_end IS NOT NULL AND s.current_period_end < ?",
      ["active", nowISO]
    );
    for (const sub of expiredSubs) {
      const s = sub as any;
      if (s.cancel_at_period_end) {
        await db.run("UPDATE subscriptions SET status = ? WHERE tenant_id = ?", ["cancelled", s.tenant_id]);
        await db.run("UPDATE tenants SET subscription_status = ? WHERE id = ?", ["cancelled", s.tenant_id]);
        results.cancelled++;
      } else {
        const nextEnd = new Date(now);
        nextEnd.setDate(nextEnd.getDate() + 30);
        const nextEndISO = nextEnd.toISOString();
        await db.run(
          "UPDATE subscriptions SET current_period_start = ?, current_period_end = ?, status = ? WHERE tenant_id = ?",
          [nowISO, nextEndISO, "active", s.tenant_id]
        );
        await db.run("UPDATE tenants SET current_period_end = ? WHERE id = ?", [nextEndISO, s.tenant_id]);
        if (s.email) {
          try {
            await sendRenewedEmail(s.email, s.name, s.plan || "Pro", nextEnd.toLocaleDateString("es-CR"));
          } catch (e: any) { results.errors.push("renewal-" + s.tenant_id + ": " + String(e)); }
        }
        results.renewed++;
      }
    }

    // 3. Expire inactive trials
    await db.run(
      "UPDATE tenants SET subscription_status = ? WHERE subscription_status = ? AND trial_ends_at IS NOT NULL AND trial_ends_at < ?",
      ["expired", "trialing", nowISO]
    );

    res.json({ success: true, ...results });
  } catch (e: any) {
    logger.error({ err: e }, "[cron/renewals]");
    res.status(500).json({ error: String(e) });
  }
});

/**
 * WEBHOOK ENDPOINTS
 */
router.post("/webhooks/paypal", async (req, res) => {
  try {
    const db = getDb();
    const event = req.body;
    const validEvents = ["CHECKOUT.APPROVED", "PAYMENT.CAPTURE.COMPLETED", "BILLING.SUBSCRIPTION.CREATED"];
    if (!validEvents.includes(event.event_type)) {
      return res.json({ received: true });
    }
    
    const resource = event.resource;
    const tenantId = resource.custom_id;
    if (!tenantId) {
      return res.json({ received: true });
    }

    // Check for deduplication
    const existing = await db.get(
      "SELECT id FROM payment_transactions WHERE transaction_id = ?",
      [resource.id]
    );
    if (existing) {
      return res.json({ received: true, duplicate: true });
    }

    const amount = resource.amount?.value || resource.purchase_units?.[0]?.amount?.value || 0;
    const currency = resource.amount?.currency_code || "USD";
    const txId = crypto.randomUUID();
    
    await db.run(
      "INSERT INTO payment_transactions (id, tenant_id, gateway, type, amount, currency, status, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [txId, tenantId, "paypal", "payment", amount, currency, "completed", resource.id, new Date().toISOString()]
    );

    const tenant = await db.get("SELECT id, name, plan, subscription_status FROM tenants WHERE id = ?", [tenantId]);
    const userTenant = await db.get(
      "SELECT u.email, u.name FROM user_tenants ut JOIN users u ON ut.user_id = u.id WHERE ut.tenant_id = ? LIMIT 1",
      [tenantId]
    );

    const tnt = tenant as any;
    const usr = userTenant as any;
    
    const userEmail = usr?.email;
    const tenantName = tnt?.name || "Restaurante";
    const planName = tnt?.plan || "Pro";
    const nextPeriodEnd = new Date();
    nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);
    const wasTrial = tnt?.subscription_status === "trialing";

    await db.run(
      "UPDATE subscriptions SET status = ?, current_period_start = ?, current_period_end = ?, cancel_at_period_end = 0 WHERE tenant_id = ?",
      ["active", new Date().toISOString(), nextPeriodEnd.toISOString(), tenantId]
    );
    await db.run(
      "UPDATE tenants SET subscription_status = ?, current_period_end = ? WHERE id = ?",
      ["active", nextPeriodEnd.toISOString(), tenantId]
    );

    if (userEmail) {
      sendReceiptEmail(userEmail, tenantName, amount, currency, planName, resource.id).catch(() => {});
      if (wasTrial) {
        sendWelcomeEmail(userEmail, tenantName, planName).catch(() => {});
      }
    }

    try {
      await db.run(
        "INSERT INTO notifications (tenant_id, type, title, message, link, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        [
          tenantId,
          "payment",
          "Pago recibido - " + planName,
          "Se proceso un pago de $" + amount + " " + currency + " para el plan " + planName + ". Tu suscripcion esta activa.",
          "/dashboard"
        ]
      );
    } catch (e) { logger.error({ err: e }, "[notif/payment]"); }
    
    res.json({ received: true });
  } catch (e) {
    logger.error({ err: e }, "[paypal/webhook]");
    res.status(500).json({ error: String(e) });
  }
});

/**
 * SIMULATION / DEBUG ENDPOINTS
 */
router.post("/simulate/:tenantId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = getDb();
    const { message, image } = req.body;
    const tenantId = req.params.tenantId;

    const config = await db.get('SELECT * FROM ai_config WHERE tenant_id = ?', [tenantId]);
    const menuItems = await db.all('SELECT * FROM menu_items WHERE tenant_id = ?', [tenantId]);
    
    let menuText = menuItems.map((item: any) => `- ${item.name} ($${item.price})`).join('\n');
    const c = config as any;

    const systemInstruction = `You are an autonomous AI restaurant agent/seller for a restaurant. 
Behave like a natural human seller, not a strict robot. Engage the customer, be friendly, persuasive, and helpful.
IMPORTANT: You MUST respond in the EXACT same language that the customer speaks to you. If they speak Spanish, reply in Spanish. If English, reply in English. If any other language, reply in that language.
You can view images if provided. Use them to answer questions.

Identity & Personality:
${c?.identity_prompt || 'Be polite and helpful.'}

Operational Rules & Policies:
${c?.operational_rules || 'No special rules.'}

Here is the restaurant menu (real-time sync):
${menuText}

Custom instructions from the restaurant owner:
${c ? c.custom_instructions : ''}`;

    const response = await generateAIContent(message, systemInstruction, image);
    res.json({ reply: response.text, keyUsed: response.keyUsed });
  } catch (error: any) {
    logger.error({ err: error }, "[simulator]");
    res.status(500).json({ error: "Failed to generate AI response: " + error.message });
  }
});

export default router;
