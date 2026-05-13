import React, { useState, useEffect, useCallback } from "react";
import { Menu, ShoppingBag, Bike, UtensilsCrossed, Save, MapPin, Plus, Users, ToggleLeft, ToggleRight, UserCheck, Zap, Link, Share } from "lucide-react";
import { LocationMapPicker } from "./LocationMapPicker";

// ─── DeliveryView ─────────────────────────────────────────────
interface DeliveryViewProps {
  setIsSidebarOpen: (v: boolean) => void;
  deliverySubTab: string;
  setDeliverySubTab: (v: string) => void;
  activeOrders: any[];
  dbDeliveryRules: any[];
  setDbDeliveryRules: (v: any[]) => void;
  refreshDashboard: () => void;
  settingsForm: any;
  setSettingsForm: (v: any) => void;
}

export const DeliveryView: React.FC<DeliveryViewProps> = ({
  setIsSidebarOpen, deliverySubTab, setDeliverySubTab, activeOrders,
  dbDeliveryRules, setDbDeliveryRules, refreshDashboard,
  settingsForm, setSettingsForm
}) => {
  const tenantId = localStorage.getItem("tenantId") || "";
  const token = localStorage.getItem("token") || "";

  const [drivers, setDrivers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [showDriverForm, setShowDriverForm] = useState(false);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/drivers/${tenantId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDrivers(await res.json());
    } catch (e) { console.error(e); }
  }, [tenantId, token]);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/delivery-assignments/${tenantId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAssignments(await res.json());
    } catch (e) { console.error(e); }
  }, [tenantId, token]);

  useEffect(() => {
    if (deliverySubTab === "drivers") {
      fetchDrivers();
      fetchAssignments();
    }
  }, [deliverySubTab, fetchDrivers, fetchAssignments]);

  const handleUpdateOrderStatus = async (id: string, status: string) => {
    await fetch(`/api/tenant/pos-orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    refreshDashboard();
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form));
    await fetch("/api/tenant/delivery-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...data, tenant_id: tenantId, max_distance: Number(data.max_distance), fee: Number(data.fee), min_order: Number(data.min_order) }),
    });
    form.reset();
    refreshDashboard();
  };

  const handleSaveLocation = async (lat: number, lng: number) => {
    const updatedSettings = { ...settingsForm, latitude: lat, longitude: lng, tenant_id: tenantId };
    setSettingsForm(updatedSettings);
    await fetch("/api/tenant/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(updatedSettings),
    });
  };

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const handleSaveDeliverySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const updatedSettings = { ...settingsForm, tenant_id: tenantId };
      await fetch("/api/tenant/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updatedSettings),
      });
      alert("Configuración de tarifas guardada.");
    } catch (e) { console.error(e); }
    finally { setIsSavingSettings(false); }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form));
    await fetch("/api/tenant/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenant_id: tenantId, name: data.driver_name, phone: data.driver_phone, pin: data.driver_pin }),
    });
    form.reset();
    setShowDriverForm(false);
    fetchDrivers();
  };

  const handleToggleDriver = async (driverId: string, currentAvailability: boolean) => {
    await fetch(`/api/tenant/drivers/${driverId}/availability`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_available: !currentAvailability }),
    });
    fetchDrivers();
  };

  const handleManualAssign = async (assignmentId: string, driverId: string) => {
    await fetch("/api/tenant/delivery-assignments/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ assignment_id: assignmentId, driver_id: driverId }),
    });
    fetchAssignments();
  };

  const handleAutoAssign = async (assignmentId: string) => {
    const res = await fetch("/api/tenant/delivery-assignments/auto-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ assignment_id: assignmentId, tenant_id: tenantId }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`✅ Asignado a ${data.driver_name}`);
    } else {
      const err = await res.json();
      alert(`❌ ${err.error}`);
    }
    fetchAssignments();
  };

  const availableDrivers = drivers.filter(d => d.is_available && d.status === "active");

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden"><Menu className="w-6 h-6" /></button>
          <div><h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Módulo de Envíos y Delivery</h1><p className="text-sm text-slate-500 font-medium mt-1">Pedidos, ubicación, zonas de tarifas y repartidores.</p></div>
        </div>
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
          <button onClick={() => setDeliverySubTab("orders")} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${deliverySubTab === "orders" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Pedidos</button>
          <button onClick={() => setDeliverySubTab("zones")} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${deliverySubTab === "zones" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Zonas</button>
          <button onClick={() => setDeliverySubTab("drivers")} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${deliverySubTab === "drivers" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>🛵 Repartidores</button>
        </div>
      </div>

      {/* ═══ TAB: Pedidos en Vivo ═══ */}
      {deliverySubTab === "orders" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {activeOrders.length === 0 ? (
            <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed"><ShoppingBag className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm font-bold">No hay órdenes activas</p></div>
          ) : activeOrders.map((order: any) => (
            <div key={order.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${order.table_number?.toLowerCase() === "whatsapp" ? "bg-green-100 text-green-600" : order.table_number?.toLowerCase()?.includes("llevar") ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                    {order.table_number?.toLowerCase() === "whatsapp" ? <Bike className="w-4 h-4" /> : <UtensilsCrossed className="w-4 h-4" />}
                  </div>
                  <div><div className="text-[10px] font-bold text-slate-400 uppercase">{order.table_number}</div><div className="text-xs font-black text-slate-900">#{order.id?.split("_").pop()?.slice(-6)}</div></div>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${order.status === "open" ? "bg-blue-50 text-blue-700" : order.status === "preparing" ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"}`}>{order.status === "open" ? "Recibido" : order.status === "preparing" ? "Preparando" : "Listo"}</span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="mb-5 space-y-2">{order.items?.map((item: any, idx: number) => (<div key={idx} className="flex justify-between items-center text-sm font-medium"><span className="text-slate-600">{item.name} <span className="font-bold text-slate-400">x{item.quantity}</span></span><span className="text-slate-900 font-bold">${(item.price * item.quantity).toFixed(2)}</span></div>))}</div>
                <div className="border-t border-slate-100 pt-4 flex justify-between items-center mb-5"><span className="text-xs text-slate-400 font-black uppercase">Total</span><span className="text-lg font-black text-slate-900">${order.total?.toFixed(2)}</span></div>
                <div className="grid grid-cols-1 gap-3 shrink-0">
                  {order.status === "open" && <button onClick={() => handleUpdateOrderStatus(order.id, "preparing")} className="h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold">Iniciar Preparación</button>}
                  {order.status === "preparing" && <button onClick={() => handleUpdateOrderStatus(order.id, "ready")} className="h-10 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl text-xs font-bold">Marcar como Listo</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ TAB: Tarifas por Kilómetro + Mapa ═══ */}
      {deliverySubTab === "zones" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Formulario de Tarifas */}
            <div className="lg:col-span-1">
              <form onSubmit={handleSaveDeliverySettings} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#109e38]/10 flex items-center justify-center text-[#109e38]"><Bike className="w-5 h-5" /></div>
                  <h3 className="font-black text-slate-900 uppercase text-sm tracking-wide">Tarifas de Envío</h3>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Costo Base (Mínimo)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">$</div>
                      <input 
                        type="number" step="0.01" required 
                        value={settingsForm.delivery_base_fee ?? ''}
                        onChange={(e) => setSettingsForm({...settingsForm, delivery_base_fee: e.target.value})}
                        className="w-full h-12 pl-8 pr-4 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-bold focus:bg-white focus:border-[#109e38] transition-all outline-none" 
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Cobro mínimo obligatorio por encender la moto.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Costo por Kilómetro</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">$</div>
                      <input 
                        type="number" step="0.01" required 
                        value={settingsForm.delivery_per_km_fee ?? ''}
                        onChange={(e) => setSettingsForm({...settingsForm, delivery_per_km_fee: e.target.value})}
                        className="w-full h-12 pl-8 pr-4 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-bold focus:bg-white focus:border-[#109e38] transition-all outline-none" 
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Se multiplica por la distancia recorrida.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Límite de Distancia (KM)</label>
                    <div className="relative">
                      <input 
                        type="number" step="0.1" required 
                        value={settingsForm.delivery_max_distance ?? ''}
                        onChange={(e) => setSettingsForm({...settingsForm, delivery_max_distance: e.target.value})}
                        className="w-full h-12 px-4 pr-12 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-bold focus:bg-white focus:border-[#109e38] transition-all outline-none" 
                      />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 font-bold text-xs">KM</div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">El bot rechazará entregas más lejanas que esto (0 = sin límite).</p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSavingSettings}
                    className="w-full h-12 bg-gradient-to-r from-[#109e38] to-[#0e8c31] hover:from-[#0d842e] hover:to-[#0b7328] text-white rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70"
                  >
                    <Save className="w-4 h-4" /> {isSavingSettings ? "Guardando..." : "Guardar Tarifas"}
                  </button>
                </div>
              </form>
            </div>

            {/* Mapa de Ubicación */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-black text-slate-900 uppercase flex items-center gap-2"><MapPin className="w-5 h-5 text-[#e91e63]" /> Ubicación de tu Restaurante</h3>
                  <p className="text-xs text-slate-400 mt-1">Esta es la ubicación 'Punto A'. El sistema calculará la ruta desde aquí.</p>
                </div>
                <div className="p-6 flex-1 min-h-[400px]">
                  <LocationMapPicker latitude={settingsForm.latitude} longitude={settingsForm.longitude} onLocationChange={handleSaveLocation} deliveryZones={[]} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: Repartidores ═══ */}
      {deliverySubTab === "drivers" && (
        <div className="space-y-8">
          {/* ─── Driver List ─── */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-900 uppercase flex items-center gap-2"><Users className="w-5 h-5 text-blue-600" /> Mis Repartidores ({drivers.length})</h3>
              <button onClick={() => setShowDriverForm(!showDriverForm)} className="h-9 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800"><Plus className="w-4 h-4" /> Agregar</button>
            </div>

            {showDriverForm && (
              <form onSubmit={handleAddDriver} className="p-6 bg-blue-50/50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nombre</label><input name="driver_name" required placeholder="Carlos" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Teléfono</label><input name="driver_phone" placeholder="+506 8888-8888" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">PIN de Acceso</label><input name="driver_pin" required placeholder="1234" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500" /></div>
                <button type="submit" className="h-10 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700">Guardar Repartidor</button>
              </form>
            )}

            <div className="divide-y divide-slate-100">
              {drivers.length === 0 ? (
                <div className="p-10 text-center text-slate-400"><Bike className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm font-bold">No tienes repartidores aún</p><p className="text-xs mt-1">Agrega repartidores para asignarles pedidos de delivery.</p></div>
              ) : drivers.map((d: any) => (
                <div key={d.id} className="p-5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${d.is_available ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                      {d.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{d.name}</div>
                      <div className="text-xs text-slate-400">{d.phone || "Sin teléfono"} • {d.total_deliveries || 0} entregas totales</div>
                    </div>
                  </div>
                  <button onClick={() => handleToggleDriver(d.id, !!d.is_available)} className="flex items-center gap-2">
                    {d.is_available ? <ToggleRight className="w-8 h-8 text-green-500" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                    <span className={`text-[10px] font-black uppercase ${d.is_available ? "text-green-600" : "text-slate-400"}`}>{d.is_available ? "Activo" : "Inactivo"}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Pending Delivery Assignments ─── */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-amber-600" /> Entregas Activas ({assignments.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {assignments.length === 0 ? (
                <div className="p-10 text-center text-slate-400"><ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm font-bold">Sin entregas pendientes</p></div>
              ) : assignments.map((a: any) => (
                <div key={a.id} className="p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-black text-slate-900">Pedido #{a.order_id?.slice(-8)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {a.distance_km ? `📍 ${a.distance_km}km` : ""} {a.delivery_fee ? `• $${Number(a.delivery_fee).toFixed(2)} envío` : ""}
                        {a.customer_phone ? ` • 📱 ${a.customer_phone}` : ""}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                      a.status === "pending" ? "bg-red-50 text-red-600" : a.status === "assigned" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                    }`}>{a.status === "pending" ? "Sin asignar" : a.status === "assigned" ? `→ ${a.driver_name}` : `🛵 ${a.driver_name}`}</span>
                  </div>

                  {a.status !== "pending" && a.driver_token && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-50">
                       <button 
                         onClick={() => {
                           const url = `${window.location.origin}/d/${a.driver_token}`;
                           navigator.clipboard.writeText(url).then(() => alert("¡Enlace para el Repartidor copiado al portapapeles!"));
                         }}
                         className="h-9 px-3 flex-1 bg-slate-900 hover:bg-black text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-colors"
                       >
                          <Link className="w-3.5 h-3.5" /> Enlace Repartidor
                       </button>
                       <button 
                         onClick={() => {
                           const url = `${window.location.origin}/t/${a.customer_token}`;
                           navigator.clipboard.writeText(url).then(() => alert("¡Enlace de Rastreo para el Cliente copiado!"));
                         }}
                         className="h-9 px-3 flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-colors"
                       >
                          <Share className="w-3.5 h-3.5" /> Enlace Cliente
                       </button>
                    </div>
                  )}
                  
                  {a.status === "pending" && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button onClick={() => handleAutoAssign(a.id)} className="h-10 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4" /> Auto-Asignar
                      </button>
                      {availableDrivers.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {availableDrivers.map(d => (
                            <button key={d.id} onClick={() => handleManualAssign(a.id, d.id)} className="h-10 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50">
                              <UserCheck className="w-4 h-4" /> {d.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
