import React from "react";
import { Menu, Plus, Sparkles } from "lucide-react";

interface VariantsViewProps {
  setIsSidebarOpen: (v: boolean) => void;
  token: string;
  menuItems: any[];
  selectedMenuItemForOptions: any;
  setSelectedMenuItemForOptions: (v: any) => void;
  menuItemOptions: any;
  setMenuItemOptions: (v: any) => void;
  newOptionForm: any;
  setNewOptionForm: (v: any) => void;
  refreshDashboard: () => void;
}

export const VariantsView: React.FC<VariantsViewProps> = ({ setIsSidebarOpen, token, menuItems, selectedMenuItemForOptions, setSelectedMenuItemForOptions, menuItemOptions, setMenuItemOptions, newOptionForm, setNewOptionForm, refreshDashboard }) => {
  const handleSelectMenuItem = async (item: any) => {
    setSelectedMenuItemForOptions(item);
    const res = await fetch(`/api/tenant/menu-options/${item.id}`);
    const data = await res.json();
    setMenuItemOptions(data || { attributes: [], extras: [], addons: [] });
  };

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuItemForOptions) return;
    await fetch("/api/tenant/menu-options", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: newOptionForm.type, menu_item_id: selectedMenuItemForOptions.id, name: newOptionForm.name, price: Number(newOptionForm.price || 0), options: newOptionForm.options }),
    });
    setNewOptionForm({ type: "attribute", name: "", options: "", price: "" });
    refreshDashboard();
  };

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-50">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden"><Menu className="w-6 h-6" /></button>
        <div><h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Variantes y Extras</h1><p className="text-sm text-slate-500 font-medium mt-1">Configura tamaños, extras y acompañamientos para cada platillo.</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Platillos</h3>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {menuItems.map((item: any) => (
                <button key={item.id} onClick={() => handleSelectMenuItem(item)} className={`w-full text-left p-3 rounded-xl text-sm font-bold transition-all ${selectedMenuItemForOptions?.id === item.id ? "bg-[#e91e63]/10 text-[#e91e63]" : "hover:bg-slate-50 text-slate-700"}`}>{item.name}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          {selectedMenuItemForOptions ? (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-black text-slate-900 uppercase mb-4">Añadir Opción para: {selectedMenuItemForOptions.name}</h3>
                <form onSubmit={handleAddOption} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tipo</label><select value={newOptionForm.type} onChange={e => setNewOptionForm({...newOptionForm, type: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63]"><option value="attribute">Atributo (Tamaño)</option><option value="extra">Extra</option><option value="addon">Acompañamiento</option></select></div>
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nombre</label><input value={newOptionForm.name} onChange={e => setNewOptionForm({...newOptionForm, name: e.target.value})} placeholder="Ej: Grande" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63]" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Precio Adicional ($)</label><input type="number" step="0.01" value={newOptionForm.price} onChange={e => setNewOptionForm({...newOptionForm, price: e.target.value})} placeholder="1.50" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63]" /></div>
                    <div className="flex items-end"><button type="submit" className="w-full h-10 bg-[#e91e63] hover:bg-[#d81b60] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Agregar</button></div>
                  </div>
                </form>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-black text-slate-900 uppercase mb-4">Opciones Actuales</h3>
                <div className="space-y-4">
                  {["attributes", "extras", "addons"].map((type) => (
                    <div key={type}>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">{type === "attributes" ? "Atributos" : type === "extras" ? "Extras" : "Acompañamientos"}</h4>
                      <div className="space-y-1">
                        {!menuItemOptions[type] || menuItemOptions[type].length === 0 ? (
                          <p className="text-xs text-slate-400 p-2">Sin opciones</p>
                        ) : menuItemOptions[type].map((opt: any) => (
                          <div key={opt.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 text-xs"><span className="font-bold text-slate-700">{opt.name}</span><span className="font-black text-[#109e38]">+${opt.price}</span></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center text-slate-400"><Sparkles className="w-12 h-12 mb-3 mx-auto opacity-20 animate-pulse" /><span className="text-sm font-bold">Selecciona un platillo para configurar sus variantes y extras</span></div>
          )}
        </div>
      </div>
    </div>
  );
};
