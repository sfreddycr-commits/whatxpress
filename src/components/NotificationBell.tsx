import React, { useState, useEffect, useCallback } from "react";
import { Bell, X, DollarSign, AlertTriangle, Info, Check, ShoppingBag } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

const typeIcons: Record<string, { icon: React.ElementType; color: string }> = {
  payment: { icon: DollarSign, color: "text-green-600 bg-green-50" },
  order: { icon: ShoppingBag, color: "text-blue-600 bg-blue-50" },
  alert: { icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  system: { icon: Info, color: "text-slate-600 bg-slate-50" },
  trial: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(() => {
    const tenantId = localStorage.getItem("tenantId") || "";
    const token = localStorage.getItem("token") || "";
    fetch("/api/tenant/notifications/" + tenantId, {
      headers: { Authorization: "Bearer " + token }
    })
      .then(res => res.json())
      .then(data => {
        setNotifications(data || []);
        setUnreadCount(data.filter((n: Notification) => !n.read).length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    const token = localStorage.getItem("token") || "";
    try {
      await fetch("/api/tenant/notifications/" + id + "/read", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token }
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  const markAllRead = async () => {
    const tenantId = localStorage.getItem("tenantId") || "";
    const token = localStorage.getItem("token") || "";
    try {
      await fetch("/api/tenant/notifications/" + tenantId + "/read-all", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Ahora";
    if (diffMin < 60) return diffMin + "min";
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + "h";
    return d.toLocaleDateString("es-CR", { month: "short", day: "numeric" });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shadow-sm"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-40" />
          <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                Notificaciones
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold">
                    {unreadCount} nueva{unreadCount !== 1 ? "s" : ""}
                  </span>
                )}
              </h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[10px] font-bold text-[#109e38] hover:underline">
                    Marcar todo leido
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No hay notificaciones</p>
                </div>
              ) : (
                notifications.map(n => {
                  const iconConfig = typeIcons[n.type] || typeIcons.info;
                  return (
                    <div
                      key={n.id}
                      onClick={() => { if (!n.read) markAsRead(n.id); if (n.link) window.location.href = n.link; }}
                      className={"flex gap-3 p-4 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 " + (!n.read ? "bg-blue-50/30" : "")}
                    >
                      <div className={"w-9 h-9 rounded-xl flex items-center justify-center shrink-0 " + iconConfig.color}>
                        <iconConfig.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 truncate">{n.title}</span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <span className="text-[10px] text-slate-400 font-medium mt-1 block">{formatTime(n.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
