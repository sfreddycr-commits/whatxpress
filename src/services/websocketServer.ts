import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger.js";
import { JWT_SECRET } from "../middleware/auth.js";

const WS_EVENT_MESSAGE = "message";
const WS_EVENT_CLOSE = "close";
const WS_EVENT_ERROR = "error";
const WS_EVENT_CONNECTION = "connection";
const WS_EVENT_KITCHEN_UPDATED = "kitchen_orders_updated";
const WS_EVENT_CONNECTED = "connected";
const WS_MSG_AUTH = "auth";
const WS_EVENT_PING = "ping";
const WS_EVENT_PONG = "pong";

const MAX_MESSAGE_SIZE = 64 * 1024; // 64 KB
const MAX_CONNECTIONS_PER_TENANT = 20;
const HEARTBEAT_INTERVAL_MS = 30_000;
const CLIENT_TIMEOUT_MS = 35_000;
const AUTH_TIMEOUT_MS = 10_000;

const ALLOWED_ORIGINS = (process.env.WS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({
    server,
    maxPayload: MAX_MESSAGE_SIZE,
  });

  const tenantSockets = new Map<string, Set<WebSocket>>();
  const pendingAuth = new WeakSet<WebSocket>();

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any)._isAlive === false) {
        logger.warn("[WS] Terminating unresponsive client");
        return ws.terminate();
      }
      (ws as any)._isAlive = false;
      try { ws.ping(); } catch {}
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(interval));

  wss.on(WS_EVENT_CONNECTION, (ws: WebSocket, req: http.IncomingMessage) => {
    // ── Origin validation ──
    if (ALLOWED_ORIGINS.length > 0) {
      const origin = req.headers.origin || "";
      if (!ALLOWED_ORIGINS.includes(origin)) {
        logger.warn({ origin }, "[WS] Rejected connection from unauthorized origin");
        ws.close(4003, "Unauthorized origin");
        return;
      }
    }

    (ws as any)._isAlive = true;
    ws.on("pong", () => { (ws as any)._isAlive = true; });

    let tenantId: string | null = null;

    // ── Auth timeout: must authenticate within 10s ──
    pendingAuth.add(ws);
    const authTimer = setTimeout(() => {
      if (pendingAuth.has(ws)) {
        logger.warn("[WS] Client failed to authenticate in time");
        ws.close(4001, "Auth timeout");
      }
    }, AUTH_TIMEOUT_MS);

    ws.on(WS_EVENT_MESSAGE, (data) => {
      try {
        const raw = data.toString();
        if (raw.length > MAX_MESSAGE_SIZE) {
          ws.close(4002, "Message too large");
          return;
        }

        const msg = JSON.parse(raw);

        if (msg.type === WS_MSG_AUTH && msg.tenantId && msg.token) {
          clearTimeout(authTimer);
          pendingAuth.delete(ws);

          try {
            const decoded = jwt.verify(msg.token, JWT_SECRET) as any;
            const tokenTenantId = decoded.tenant_id || decoded.id;

            if (tokenTenantId !== msg.tenantId) {
              ws.send(JSON.stringify({ type: "error", message: "Tenant ID mismatch" }));
              ws.close();
              return;
            }

            // ── Max connections per tenant ──
            const existing = tenantSockets.get(msg.tenantId);
            if (existing && existing.size >= MAX_CONNECTIONS_PER_TENANT) {
              logger.warn({ tenantId: msg.tenantId }, "[WS] Tenant exceeded max connections");
              ws.send(JSON.stringify({ type: "error", message: "Max connections reached" }));
              ws.close(4004, "Too many connections");
              return;
            }

            tenantId = msg.tenantId;
            if (!tenantSockets.has(tenantId)) {
              tenantSockets.set(tenantId, new Set());
            }
            tenantSockets.get(tenantId)!.add(ws);
            ws.send(JSON.stringify({ type: WS_EVENT_CONNECTED, tenantId }));
            logger.info({ tenantId }, "[WS] Tenant connected to KDS");
          } catch {
            ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
            ws.close();
          }
        }
      } catch {
        // malformed JSON — ignore
      }
    });

    ws.on(WS_EVENT_CLOSE, () => {
      clearTimeout(authTimer);
      pendingAuth.delete(ws);
      if (tenantId && tenantSockets.has(tenantId)) {
        tenantSockets.get(tenantId)!.delete(ws);
        if (tenantSockets.get(tenantId)!.size === 0) {
          tenantSockets.delete(tenantId);
        }
        logger.info({ tenantId }, "[WS] Tenant disconnected from KDS");
      }
    });

    ws.on(WS_EVENT_ERROR, () => {});
  });

  function broadcastToTenant(tenantId: string, event: object) {
    if (tenantSockets.has(tenantId)) {
      const payload = JSON.stringify(event);
      tenantSockets.get(tenantId)!.forEach((s) => {
        try { s.send(payload); } catch {}
      });
    }
  }

  return { wss, tenantSockets, broadcastToTenant };
}
