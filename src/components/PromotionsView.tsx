import React, { useState } from "react";
import { Menu, Plus, Trash2, Sparkles } from "lucide-react";

interface Props {
  tenantId: string;
  token: string;
  dbCoupons: any[];
  refreshDashboard: () => void;
  setIsSidebarOpen: (v: boolean) => void;
}

export const PromotionsView: React.FC<Props> = ({
  tenantId,
  token,
  dbCoupons,
  refreshDashboard,
  setIsSidebarOpen,
}) => {
  const [couponForm, setCouponForm] = useState({
    name: "",
    code: "",
    discount: 0,
    discount_type: "Percentage",
    start_date: "",
    end_date: "",
    minimum_order: 0,
  });

  const handleSaveCoupon = async () => {
    await fetch("/api/tenant/coupons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ ...couponForm, tenant_id: tenantId }),
    });
    setCouponForm({
      name: "",
      code: "",
      discount: 0,
      discount_type: "Percentage",
      start_date: "",
      end_date: "",
      minimum_order: 0,
    });
    refreshDashboard();
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!window.confirm("¿Eliminar este cupón?")) return;
    await fetch(`/api/tenant/coupons/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    refreshDashboard();
  };

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden">
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Promociones y Cupones</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Crea y gestiona descuentos para tus clientes.</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase">Nuevo Cupón</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nombre</label>
                <input
                  type="text"
                  value={couponForm.name}
                  onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })}
                  placeholder="Ej: Verano 2026"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Código</label>
                <input
                  type="text"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="Ej: VERANO20"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono uppercase focus:outline-none focus:border-[#e91e63]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Descuento</label>
                <input
                  type="number"
                  value={couponForm.discount || ""}
                  onChange={(e) => setCouponForm({ ...couponForm, discount: Number(e.target.value) })}
                  placeholder="Ej: 20"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tipo</label>
                <select
                  value={couponForm.discount_type}
                  onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63]"
                >
                  <option value="Percentage">Porcentaje (%)</option>
                  <option value="Fixed">Monto Fijo ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Pedido Mínimo ($)</label>
                <input
                  type="number"
                  value={couponForm.minimum_order || ""}
                  onChange={(e) => setCouponForm({ ...couponForm, minimum_order: Number(e.target.value) })}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63]"
                />
              </div>
              <button
                onClick={handleSaveCoupon}
                className="w-full h-12 bg-[#e91e63] hover:bg-[#d81b60] text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-[#e91e63]/20"
              >
                Crear Cupón
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase">Cupones Activos ({dbCoupons.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {dbCoupons.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400 font-medium">
                  No hay cupones creados aún.
                </div>
              ) : (
                dbCoupons.map((c: any) => (
                  <div key={c.id} className="p-5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900">
                        {c.name}{" "}
                        <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded ml-2">
                          {c.code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {c.discount_type === "Percentage" ? c.discount + "%" : "$" + c.discount} de descuento
                        {c.minimum_order > 0 && ` • mín. $${c.minimum_order}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCoupon(c.id)}
                      className="text-xs font-bold text-red-500 hover:text-red-700 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Eliminar
                    </button>
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
