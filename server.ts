import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as http from "http";
import fs from "fs";
import multer from "multer";

// Internal Engine
import { initDb } from "./src/db.js";
import { initWhatsAppConnections } from "./src/services/whatsappService.js";
import { startAPIKeyHealthChecker } from "./src/services/aiService.js";
import { setupWebSocket } from "./src/services/websocketServer.js";
import { logger } from "./src/lib/logger.js";
import { requireAdmin, authenticateToken, verifyTenantAccess } from "./src/middleware/auth.js";

// Modular Domain Routers
import authRoutes from "./src/routes/auth.routes.js";
import publicRoutes from "./src/routes/public.routes.js";
import driverRoutes from "./src/routes/driver.routes.js";
import whatsappRoutes from "./src/routes/whatsapp.routes.js";
import adminRoutes, { getTenantsList } from "./src/routes/admin.routes.js";
import integrationsRoutes from "./src/routes/integrations.routes.js";
import { createTenantRouter, handleTenantDashboard } from "./src/routes/tenant.routes.js";

async function startServer() {
  logger.info("⚡ Starting WhatXpress Modular Backend Core...");

  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const httpServer = http.createServer(app);

  // Enable trust proxy so express-rate-limit detects true client IPs behind Nginx
  app.set('trust proxy', 1);

  // 1. Setup Real-time Gateway
  const { tenantSockets, broadcastToTenant } = setupWebSocket(httpServer);

  // 2. Initialize Global Cache/DB Instance Singleton
  const db = await initDb();
  logger.info("🗄️ Main Database Registry online.");

  // 3. Activate background self-healing tasks
  startAPIKeyHealthChecker();

  // ─── GLOBAL SECURITY SHIELD ───
  app.use(helmet({
    crossOriginEmbedderPolicy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true },
    contentSecurityPolicy: false, // Let nginx handle complex policies
  }));

  app.use(cors({
    origin: [
      "https://whatxpress.com",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
  }));

  // ─── TRAFFIC CONTROL LIMITERS ───
  const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });

  app.use("/api/auth", authLimiter);
  app.use("/api/public", publicLimiter);
  app.use("/api/admin", apiLimiter);
  app.use("/api/tenant", apiLimiter);
  
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

  // ─── DOMAIN ROUTER REGISTRATION ───
  
  // Platform Health Check
  app.get("/api/health", async (req, res) => {
    try {
      await db.all("SELECT 1");
      res.json({ status: "ok", engine: "v2-modular" });
    } catch (e) {
      res.status(500).json({ status: "error", details: String(e) });
    }
  });

  // Legacy Multi-tenant root list accessor
  app.get("/api/tenants", requireAdmin, getTenantsList);

  // Legacy Alias compatibility shim
  app.get("/api/tenant-dashboard/:tenantId", authenticateToken, verifyTenantAccess, handleTenantDashboard as any);

  // Registered Feature Modules
  app.use("/api/auth", authRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/driver", driverRoutes);
  app.use("/api/whatsapp", whatsappRoutes);
  app.use("/api/admin", adminRoutes);
  
  // Shared Integrations (Cron, Simulator, Webhooks)
  app.use("/api", integrationsRoutes);

  // File Upload System setup
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, uploadDir); },
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, unique + path.extname(file.originalname));
    }
  });
  const uploader = multer({ storage });
  
  // Expose files publicly
  app.use("/uploads", express.static(uploadDir));
  
  // API Route to perform upload
  app.post("/api/upload", uploader.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // The Dynamic Tenant Operations Sub-Network (Injects Active WebSockets bridge)
  app.use("/api/tenant", createTenantRouter(broadcastToTenant));

  // ─── STATIC CONTENT AND SPA DELIVERY ───
  if (process.env.NODE_ENV !== "production") {
    logger.info("🛠 Running in dynamic development proxy mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    logger.info("🚀 Provisioning optimized production build delivery...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // ─── SYSTEM EXECUTE ───
  httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info({ port: PORT, mode: process.env.NODE_ENV }, "🚀 Platform Core Fully Loaded & Listening!");
    
    // Post-boot WhatsApp hydration
    initWhatsAppConnections().catch(err => logger.error({ err }, "[Startup] Pre-loading WhatsApp pools failed."));
  });
}

// BOOTSTRAP SYSTEM
startServer().catch(err => {
  console.error("CRITICAL BACKEND STARTUP FAILURE:", err);
  process.exit(1);
});
