import React, { useState, useEffect } from "react";
import { Menu, Loader2, CheckCircle2, Save } from "lucide-react";

interface SettingsViewProps {
  setIsSidebarOpen: (v: boolean) => void;
  settings: any;
  tenant: any;
  refreshDashboard: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ setIsSidebarOpen, settings, tenant, refreshDashboard }) => {
  const [settingsForm, setSettingsForm] = useState<any>({});
  const [taxForm, setTaxForm] = useState<any>({ name: "", tax_rate: 0 });
  const [dbTaxes, setDbTaxes] = useState<any[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const tenantId = localStorage.getItem("tenantId") || "tenant_1";
  const token = localStorage.getItem("token") || "";

  // Initialize form when incoming settings change
  useEffect(() => {
    if (settings) {
      setSettingsForm(settings);
    }
  }, [settings]);

  // Fetch taxes data independently for fully decoupled experience
  const fetchTaxes = async () => {
    try {
      const res = await fetch(`/api/tenant/taxes/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDbTaxes(Array.isArray(data) ? data : []);
        
        const activeTax = (data || []).find((t: any) => t.status === "Active");
        if (activeTax) {
          setTaxForm({ name: activeTax.name, tax_rate: activeTax.tax_rate });
        }
      }
    } catch (e) {
      console.error("Failed to load taxes", e);
    }
  };

  useEffect(() => {
    fetchTaxes();
  }, [tenantId]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await fetch("/api/tenant/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...settingsForm, tenant_id: tenantId }),
      });
      refreshDashboard();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveTax = async () => {
    try {
      const activeTaxId = dbTaxes.find((t: any) => t.status === "Active")?.id;
      await fetch("/api/tenant/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: taxForm.name,
          tax_rate: taxForm.tax_rate,
          id: activeTaxId
        }),
      });
      fetchTaxes(); // Reload locally
      refreshDashboard();
    } catch (e) {
      console.error(e);
    }
  };

  const activeTax = dbTaxes.find((t: any) => t.status === "Active");

  return (
    <form onSubmit={handleUpdateSettings} className="flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button type="button" onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden">
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Configuración</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Personaliza los ajustes de tu restaurante.</p>
          </div>
          <button
            type="submit"
            disabled={isSavingSettings}
            className="ml-auto h-10 px-6 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isSavingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {isSavingSettings ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>

        <div className="space-y-8">
          {/* General Settings */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase">Información General</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">País</label>
                  <input
                    value={settingsForm.country || ""}
                    onChange={e => setSettingsForm({ ...settingsForm, country: e.target.value })}
                    placeholder="Ej: Costa Rica"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#109e38]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Moneda</label>
                  <input
                    value={settingsForm.currency || ""}
                    onChange={e => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                    placeholder="Ej: CRC"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#109e38]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Símbolo de Moneda</label>
                  <input
                    value={settingsForm.currency_symbol || ""}
                    onChange={e => setSettingsForm({ ...settingsForm, currency_symbol: e.target.value })}
                    placeholder="Ej: ₡ o $"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#109e38]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Código de País</label>
                  <input
                    value={settingsForm.country_code || ""}
                    onChange={e => setSettingsForm({ ...settingsForm, country_code: e.target.value })}
                    placeholder="+506"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#109e38]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Teléfono</label>
                  <input
                    value={settingsForm.phone_number || ""}
                    onChange={e => setSettingsForm({ ...settingsForm, phone_number: e.target.value })}
                    placeholder="8888-8888"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#109e38]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tax Settings */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase">Configuración de Impuestos</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nombre del Impuesto</label>
                  <input
                    value={taxForm.name || ""}
                    onChange={e => setTaxForm({ ...taxForm, name: e.target.value })}
                    placeholder="Ej: IVA"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#109e38]"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tasa (%)</label>
                  <input
                    type="number"
                    value={taxForm.tax_rate || ""}
                    onChange={e => setTaxForm({ ...taxForm, tax_rate: Number(e.target.value) })}
                    placeholder="13"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#109e38]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveTax}
                  className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
              {activeTax && (
                <div className="text-xs text-slate-400 font-medium">
                  Impuesto activo: {activeTax.name} ({activeTax.tax_rate}%)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
