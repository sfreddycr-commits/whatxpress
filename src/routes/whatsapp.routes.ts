import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { getWhatsAppStatus, connectWhatsApp, disconnectWhatsApp } from '../services/whatsappService.js';

const router = express.Router();

/**
 * @route   GET /api/whatsapp/status/:tenantId
 * @desc    Probes current runtime socket state (connected, scanned, closed)
 */
router.get("/status/:tenantId", authenticateToken, async (req: AuthRequest, res) => {
  const status = await getWhatsAppStatus(req.params.tenantId);
  res.json(status);
});

/**
 * @route   POST /api/whatsapp/connect/:tenantId
 * @desc    Spawns a multi-device connection watcher, or regenerates pairable QR string
 */
router.post("/connect/:tenantId", authenticateToken, async (req: AuthRequest, res) => {
  const status = await connectWhatsApp(req.params.tenantId);
  res.json(status);
});

/**
 * @route   POST /api/whatsapp/disconnect/:tenantId
 * @desc    Explicitly terminates socket stream and invalidates session folder persistence
 */
router.post("/disconnect/:tenantId", authenticateToken, async (req: AuthRequest, res) => {
  const status = await disconnectWhatsApp(req.params.tenantId);
  res.json(status);
});

/**
 * @route   POST /api/whatsapp/send/:tenantId
 * @desc    Enables manual outgoing message delivery from backend context to clients
 */
router.post("/send/:tenantId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: "phone y message requeridos" });
    }
    const normalized = phone.replace(/[\s\-]+/g, "").replace(/^\+/, "");
    const jid = normalized + "@s.whatsapp.net";
    
    const { sendWhatsAppNotification } = await import("../services/whatsappNotifier.js");
    const sent = await sendWhatsAppNotification(req.params.tenantId, jid, message);
    
    if (sent) { 
      res.json({ success: true }); 
    } else { 
      res.status(500).json({ error: "No se pudo enviar. Verifica que WhatsApp este conectado." }); 
    }
  } catch (error: any) { 
    res.status(500).json({ error: error.message }); 
  }
});

export default router;
