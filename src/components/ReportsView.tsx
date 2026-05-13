import React, { useState, useEffect, useCallback } from "react";
import { Menu, Calendar, TrendingUp, DollarSign, ShoppingBag, Utensils, Users, Bike } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts";

interface ReportsViewProps {
  setIsSidebarOpen: (v: boolean) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ setIsSidebarOpen }) => {
  const tenantId = localStorage.getItem("tenantId") || "";
  const token = localStorage.getItem("token") || "";

  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/reports/${tenantId}?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tenantId, token, period]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const COLORS = ["#109e38", "#3b82f6", "#f59e0b", "#e91e63", "#a855f7", "#10b981"];

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center"><div className="w-10 h-10 border-4 border-slate-100 border-t-[#109e38] rounded-full animate-spin" /></div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden"><Menu className="w-6 h-6" /></button>
          <div><h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Reportes de Ventas</h1><p className="text-sm text-slate-500 font-medium mt-1">Analiza el rendimiento de tu restaurante.</p></div>
        </div>
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200">
          <button onClick={() => setPeriod("today")} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${period === "today" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Hoy</button>
          <button onClick={() => setPeriod("week")} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${period === "week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Semana</button>
          <button onClick={() => setPeriod("month")} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${period === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Mes</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3"><DollarSign className="w-5 h-5 text-green-600" /><span className="text-[10px] font-black text-slate-400 uppercase">Ventas Totales</span></div>
          <div className="text-2xl font-black text-slate-900">${(data.totalSales || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3"><ShoppingBag className="w-5 h-5 text-blue-600" /><span className="text-[10px] font-black text-slate-400 uppercase">Total Órdenes</span></div>
          <div className="text-2xl font-black text-slate-900">{data.totalOrders || 0}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-5 h-5 text-amber-600" /><span className="text-[10px] font-black text-slate-400 uppercase">Ticket Promedio</span></div>
          <div className="text-2xl font-black text-slate-900">${(data.avgTicket || 0).toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3"><Bike className="w-5 h-5 text-purple-600" /><span className="text-[10px] font-black text-slate-400 uppercase">Órdenes WhatsApp</span></div>
          <div className="text-2xl font-black text-slate-900">{data.whatsappOrders || 0}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Over Time */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6">Ventas por Día</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesByDay || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#109e38" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#109e38" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10, fontWeight: 700 }} stroke="#94a3b8" tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Ventas"]} />
                <Area type="monotone" dataKey="total" stroke="#109e38" strokeWidth={3} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6">Productos Más Vendidos</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data.topProducts || []).slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#94a3b8" width={80} />
                <Tooltip />
                <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by Channel */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6">Ventas por Canal</h3>
          <div style={{ height: 260 }} className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.salesByChannel || []} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" nameKey="name">
                  {(data.salesByChannel || []).map((_: any, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {(data.salesByChannel || []).map((c: any, idx: number) => (
              <div key={c.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-[10px] font-bold text-slate-500">{c.name}: ${c.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Orders Over Time */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6">Órdenes por Día</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.salesByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10, fontWeight: 700 }} stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#e91e63" strokeWidth={3} dot={{ fill: "#e91e63", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
