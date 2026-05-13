import { useState, useEffect, useCallback, useRef } from "react";
import type { TenantDashboardData, POSOrder } from "../types";

export interface DashboardData extends TenantDashboardData {
  //额外字段由hook补充
}

export interface UseDashboardDataReturn {
  dashboardData: DashboardData | null;
  loading: boolean;
  loadError: string | null;
  refreshDashboard: () => void;
  dbTables: any[];
  tenantId: string;
  token: string;
}

export function useDashboardData(): UseDashboardDataReturn {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dbTables, setDbTables] = useState<any[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevOrdersRef = useRef<string[]>([]);

  const tenantId = localStorage.getItem("tenantId") || "";
  const token = localStorage.getItem("token") || "";

  const playNotification = useCallback(() => {
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQoAQpTS6bJvFhFKj9XssHkcCE2U1+y0dR8OUJHV7bR5IBFSl9jttXoiE1Wa2O62eiMUWKHY7rl7JRZbp9nvuXwnGV+n2vG6fCkZY6za871/Lxtlrtz1vH8vGmav3/e9gDEbZ7Hg+L+BNxxos+P5v4I4Hm214vq/gjoearbj+r+DPB9rt+T6v4Q9H2y35Pu/hT4gbbjl+7+GPyFtuOb7v4c/IW245/u/iD9id");
      audio.volume = 0.4;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!tenantId || !token) return;
    try {
      const res = await fetch(`/api/tenant-dashboard/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DashboardData = await res.json();
      setDashboardData(data);
      setLoadError(null);

      // 检测新订单
      const currentOrderIds = (data.activeOrders || []).map((o: POSOrder) => o.id);
      const prev = prevOrdersRef.current;
      if (prev.length > 0 && currentOrderIds.length > prev.length) {
        const newIds = currentOrderIds.filter((id: string) => !prev.includes(id));
        if (newIds.length > 0) playNotification();
      }
      prevOrdersRef.current = currentOrderIds;
    } catch (err: any) {
      setLoadError(err.message);
    }
  }, [tenantId, token, playNotification]);

  useEffect(() => {
    if (!tenantId || !token) {
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    refreshDashboard().finally(() => setLoading(false));

    // Cargar mesas
    fetch(`/api/tenant/tables/${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setDbTables(Array.isArray(data) ? data : []))
      .catch(() => setDbTables([]));

    // Auto-refresh cada 30s
    intervalRef.current = setInterval(refreshDashboard, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tenantId, token, refreshDashboard]);

  return { dashboardData, loading, loadError, refreshDashboard, dbTables, tenantId, token };
}

