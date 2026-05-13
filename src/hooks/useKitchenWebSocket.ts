import { useEffect, useRef, useState, useCallback } from "react";

interface KitchenOrderItem {
  menu_item_id: string;
  quantity: number;
  price: number;
}

interface KitchenOrderEvent {
  type: "kitchen_orders_updated";
  orderId: string;
  tableNumber: string;
  items: KitchenOrderItem[];
}

interface ConnectedEvent {
  type: "connected";
  tenantId: string;
}

type WSEvent = KitchenOrderEvent | ConnectedEvent;

export function useKitchenWebSocket(tenantId: string | null) {
  const [lastEvent, setLastEvent] = useState<KitchenOrderEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const clearEvent = useCallback(() => setLastEvent(null), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    function connect() {
      if (!mountedRef.current) return;
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        const token = localStorage.getItem("token");
        ws.send(JSON.stringify({ type: "auth", tenantId, token }));
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data) as WSEvent;
          if (data.type === "kitchen_orders_updated") {
            setLastEvent(data);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        // ws.onclose will fire after this
      };
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [tenantId]);

  return { lastEvent, clearEvent, isConnected };
}
