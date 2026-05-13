import React, { useState } from "react";
import { Menu, Plus } from "lucide-react";

interface Props {
  tenantId: string;
  token: string;
  waiters: any[];
  refreshDashboard: () => void;
  setIsSidebarOpen: (v: boolean) => void;
}

export const StaffView: React.FC<Props> = ({
  tenantId,
  token,
  waiters,
  refreshDashboard,
  setIsSidebarOpen,
}) => {
  const [waiterForm, setWaiterForm] = useState({ name: "", pin: "", status: "active" });

  const handleSaveWaiter = async () => {
    if (!waiterForm.name || !waiterForm.pin) return;
    await fetch("/api/tenant/waiters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ ...waiterForm, tenant_id: tenantId }),
    });
    setWaiterForm({ name: "", pin: "", status: "active" });
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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Gestión de Meseros y Personal</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Registra personal, asigna códigos PIN para terminales móviles y monitorea su rendimiento.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase">Nuevo Mesero / Personal</h3>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Ej: Carlos Mendoza"
                  value={waiterForm.name}
                  onChange={(e) => setWaiterForm({ ...waiterForm, name: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-[#109e38]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">PIN de Acceso (4 dígitos)</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Ej: 1234"
                  value={waiterForm.pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setWaiterForm({ ...waiterForm, pin: val });
                  }}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-black tracking-widest focus:outline-none focus:border-[#109e38]"
                />
              </div>
              <button
                onClick={handleSaveWaiter}
                disabled={!waiterForm.name || waiterForm.pin.length < 4}
                className="w-full h-12 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-[#109e38]/20 disabled:opacity-50"
              >
                Registrar Mesero
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase">Meseros Registrados ({waiters.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {waiters.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400 font-medium">
                  No hay meseros registrados aún.
                </div>
              ) : (
                waiters.map((w: any) => (
                  <div key={w.id} className="p-5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900">{w.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">PIN: {w.pin} • Estado: {w.status}</div>
                    </div>
                    <span className={"px-3 py-1 rounded-full text-[10px] font-black uppercase " + (w.status === "active" ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-400")}>
                      {w.status}
                    </span>
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
