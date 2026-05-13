import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger.js";
import { JWT_SECRET } from "../middleware/auth.js";

// Constants to prevent esbuild from stripping string literals
const WS_EVENT_MESSAGE = "message";
const WS_EVENT_CLOSE = "close";
const WS_EVENT_ERROR = "error";
const WS_EVENT_CONNECTION = "connection";
const WS_EVENT_KITCHEN_UPDATED = "kitchen_orders_updated";
const WS_EVENT_CONNECTED = "connected";
const WS_MSG_AUTH = "auth";

export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });
  const tenantSockets = new Map<string, Set<WebSocket>>();

  wss.on(WS_EVENT_CONNECTION, (ws: WebSocket) => {
    let tenantId: string | null = null;
    
    ws.on(WS_EVENT_MESSAGE, (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === WS_MSG_AUTH && msg.tenantId && msg.token) {
          try {
            const decoded = jwt.verify(msg.token, JWT_SECRET) as any;
            const tokenTenantId = decoded.tenant_id || decoded.id;
            if (tokenTenantId !== msg.tenantId) {
              ws.send(JSON.stringify({ type: "error", message: "Tenant ID mismatch" }));
              ws.close();
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
        // ignore malformed messages
      }
    });
    
    ws.on(WS_EVENT_CLOSE, () => {
      if (tenantId && tenantSockets.has(tenantId)) {
        tenantSockets.get(tenantId)!.delete(ws);
        if (tenantSockets.get(tenantId)!.size === 0) {
          tenantSockets.delete(tenantId);
        }
        logger.info({ tenantId }, "[WS] Tenant disconnected from KDS");
      }
    });
    
    ws.on(WS_EVENT_ERROR, () => {
      // ws.onclose will fire after this
    });
  });

  function broadcastToTenant(tenantId: string, event: object) {
    if (tenantSockets.has(tenantId)) {
      const payload = JSON.stringify(event);
      tenantSockets.get(tenantId)!.forEach(s => {
        try { s.send(payload); } catch {}
      });
    }
  }

  return { wss, tenantSockets, broadcastToTenant };
}
