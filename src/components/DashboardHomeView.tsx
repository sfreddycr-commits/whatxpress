import React, { useState, useEffect } from "react";
import { Menu, Bot, DollarSign, UtensilsCrossed, TruckIcon, Activity, TrendingUp, Bike } from "lucide-react";

interface Props {
  metrics: any;
  activeOrders: any[];
  menuItems: any[];
  tenant: any;
  currencySymbol?: string;
  dbTables: any[];
  tenantId: string;
  token: string;
  refreshDashboard: () => void;
  setIsSidebarOpen: (v: boolean) => void;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-50 text-blue-600 border-blue-100",
  preparing: "bg-orange-50 text-orange-600 border-orange-100",
  ready: "bg-green-50 text-green-600 border-green-100",
  delivered: "bg-slate-50 text-slate-500 border-slate-100",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Entrante",
  preparing: "En Cocina",
  ready: "Por Despachar",
  delivered: "Entregado",
};

export const DashboardHomeView: React.FC<Props> = ({
  metrics,
  activeOrders,
  menuItems,
  tenant,
  tenantId,
  token,
  refreshDashboard,
  setIsSidebarOpen,
  currencySymbol = "$",
}) => {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const today = new Date().toLocaleDateString("es-CR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const currency = currencySymbol;

  const topItems = [...(menuItems || [])]
    .sort((a: any, b: any) => (b.orders_today || 0) - (a.orders_today || 0))
    .slice(0, 5);

  const ordersByStatus = (status: string) =>
    (activeOrders || []).filter((o: any) => o.status === status);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="p-4 sm:p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {greeting}, {tenant?.name?.split(" ")[0] || "Admin"}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase">
                  Live
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium capitalize">{today}</p>
            </div>
          </div>
          <button
            onClick={refreshDashboard}
            className="h-9 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
          >
            <Activity className="w-3 h-3" />
            Actualizar
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Ventas Hoy
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {currency}
                  {(metrics?.today_sales || 0).toLocaleString("es-CR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center text-xs font-semibold text-green-500">
              <TrendingUp className="w-3 h-3 mr-1" />
              Automatizado
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Pedidos AI
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {metrics?.ai_orders_count || 0}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center text-xs font-semibold text-blue-600">
              {metrics?.automation_rate || 0}% automation rate
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Mesas Activas
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {metrics?.active_tables || 0}
                  <span className="text-lg text-slate-400">
                    /{metrics?.total_tables || 0}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{
                  width: `${
                    metrics?.total_tables
                      ? ((metrics?.active_tables || 0) / metrics.total_tables) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Deliveries Pendientes
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {metrics?.pending_deliveries || 0}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Bike className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center text-xs font-semibold text-orange-600">
              {metrics?.attention_deliveries || 0} requieren atención
            </div>
          </div>
        </div>

        {/* Kanban de Pedidos */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-900">Pedidos Activos</h3>
            <span className="text-xs font-bold text-slate-400">
              {(activeOrders || []).length} pedidos
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {["open", "preparing", "ready", "delivered"].map((status) => (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      status === "open"
                        ? "bg-blue-400"
                        : status === "preparing"
                        ? "bg-orange-400"
                        : status === "ready"
                        ? "bg-green-400"
                        : "bg-slate-300"
                    }`}
                  />
                  <span className="text-xs font-black text-slate-600 uppercase">
                    {STATUS_LABELS[status] || status}
                  </span>
                  <span className="ml-auto text-xs font-black text-slate-400">
                    {ordersByStatus(status).length}
                  </span>
                </div>
                <div className="space-y-2">
                  {ordersByStatus(status).length === 0 ? (
                    <div className="text-center py-6 text-[10px] font-bold text-slate-300">
                      Sin pedidos
                    </div>
                  ) : (
                    ordersByStatus(status).map((order: any) => (
                      <div
                        key={order.id}
                        className="bg-slate-50 rounded-xl p-3 border border-slate-100"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-black text-slate-800">
                            #{order.id.slice(-4)}
                          </span>
                          <span className="text-xs font-black text-[#109e38]">
                            {currency}
                            {order.total?.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Mesa {order.table_number || "—"}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(order.created_at).toLocaleTimeString("es-CR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Selling + Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900">Ventas Recientes</h3>
              <button className="text-blue-600 text-sm font-semibold hover:text-blue-700 flex items-center gap-1">
                Ver Reporte <TrendingUp className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center min-h-[240px]">
              <Activity className="w-8 h-8 text-slate-300 mb-2" />
              <span className="text-sm font-semibold text-slate-400">
                Próximamente: gráfico de ventas
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <h3 className="text-lg font-black text-slate-900 mb-6">Top Platillos</h3>
            <div className="space-y-4">
              {topItems.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 font-medium">
                  Sin datos aún
                </div>
              ) : (
                topItems.map((item: any, i: number) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      {item.image_url && (
                        <img
                          src={item.image_url.split(',')[0]}
                          referrerPolicy="no-referrer"
                          alt={item.name}
                          className="w-12 h-12 rounded-lg object-cover shadow-sm"
                        />
                      )}
                      <div>
                        <div className="text-sm font-bold text-slate-900">{item.name}</div>
                        <div className="text-xs font-medium text-slate-500 mt-0.5">
                          {item.orders_today || 0} orders hoy
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-black text-slate-900">
                      {currency}
                      {(item.price * (item.orders_today || 0)).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};