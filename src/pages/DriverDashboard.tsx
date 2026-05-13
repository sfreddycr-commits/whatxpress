import React, { useState, useEffect, useCallback } from "react";
import { Bike, Package, CheckCircle2, MapPin, Clock, Phone, Navigation, LogOut, ChevronRight } from "lucide-react";

interface DriverDashboardProps {
  driverId: string;
  driverName: string;
  token: string;
  onLogout: () => void;
}

export default function DriverDashboard({ driverId, driverName, token, onLogout }: DriverDashboardProps) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [stats, setStats] = useState({ today_deliveries: 0, today_earnings: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/driver/my-assignments/${driverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
        setStats(data.stats || { today_deliveries: 0, today_earnings: 0 });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [driverId, token]);

  const [permissionState, setPermissionState] = useState<PermissionState | "unsupported" | "loading">("loading");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Check initial permission state via direct fast detection
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionState("unsupported");
      return;
    }
    
    // Immediate test to verify if browser ALREADY allows it
    navigator.geolocation.getCurrentPosition(
      () => setPermissionState("granted"),
      (err) => {
        // Not allowed yet or explicit block
        setPermissionState(err.code === 1 ? "denied" : "prompt");
      },
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 60000 }
    );

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        result.onchange = () => setPermissionState(result.state);
      }).catch(() => {});
    }
  }, []);

  // Request permission explicitly via user gesture
  const requestLocationPermission = () => {
    if (!navigator.geolocation) return;
    setPermissionState("loading"); // show loading spinner
    navigator.geolocation.getCurrentPosition(
      () => setPermissionState("granted"),
      (err) => {
        console.error("User denied or error:", err);
        setPermissionState(err.code === 1 ? "denied" : "prompt");
      },
      { enableHighAccuracy: true }
    );
  };

  // Start tracking only if granted
  useEffect(() => {
    if (permissionState !== "granted" || !navigator.geolocation) return;

    const updateLocation = async (lat: number, lng: number) => {
      try {
        await fetch("/api/driver/location", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat, lng }),
        });
      } catch (e) { console.error("Error updating location", e); }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => console.error("GPS Watch error:", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [permissionState, token]);

  const handleUpdateStatus = async (assignmentId: string, newStatus: string) => {
    setUpdatingId(assignmentId);
    try {
      await fetch(`/api/tenant/delivery-assignments/${assignmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const openMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  if (permissionState === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  const pendingAssignments = assignments.filter(a => a.status === "assigned");
  const inTransit = assignments.filter(a => a.status === "picked_up");

  if (permissionState === "prompt" || permissionState === "denied") {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 border-4 border-slate-700 shadow-2xl">
          <MapPin className={`w-10 h-10 ${permissionState === "denied" ? "text-red-500" : "text-green-500 animate-bounce"}`} />
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-3">
          {permissionState === "denied" ? "GPS Bloqueado" : "Activar GPS"}
        </h1>
        <p className="text-slate-400 text-sm mb-8 max-w-[280px]">
          {permissionState === "denied" 
            ? "Has denegado el acceso al GPS. Para recibir pedidos debes habilitarlo manualmente en la configuración de tu navegador y recargar." 
            : "Para trabajar como repartidor y recibir pedidos, necesitamos acceso a tu ubicación en tiempo real."}
        </p>
        {permissionState === "prompt" && (
          <button 
            onClick={requestLocationPermission}
            className="w-full max-w-[280px] h-14 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Navigation className="w-5 h-5" /> Permitir Acceso
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans relative">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-green-500/20">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider">Repartidor</h1>
              <p className="text-[10px] text-slate-400 font-bold">{driverName}</p>
            </div>
          </div>
          <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-3 gap-3 p-5">
        <div className="bg-slate-800 rounded-2xl p-4 text-center border border-slate-700">
          <div className="text-2xl font-black text-green-400">{stats.today_deliveries || 0}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Entregas Hoy</div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-4 text-center border border-slate-700">
          <div className="text-2xl font-black text-amber-400">${(stats.today_earnings || 0).toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ganado Hoy</div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-4 text-center border border-slate-700">
          <div className="text-2xl font-black text-blue-400">{pendingAssignments.length + inTransit.length}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Pendientes</div>
        </div>
      </div>

      {/* ─── In Transit (picked up, on the way) ─── */}
      {inTransit.length > 0 && (
        <div className="px-5 mb-6">
          <h2 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> En Camino ({inTransit.length})
          </h2>
          <div className="space-y-4">
            {inTransit.map((a) => (
              <div key={a.id} className="bg-gradient-to-br from-amber-900/30 to-slate-800 rounded-2xl border border-amber-700/30 p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-black text-amber-400 uppercase">Pedido #{a.order_id?.slice(-8)}</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {a.distance_km ? `📍 ${a.distance_km} km` : ""} {a.delivery_fee ? `• $${Number(a.delivery_fee).toFixed(2)} envío` : ""}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black uppercase">En Camino</span>
                </div>

                {a.order_total && (
                  <div className="text-sm font-bold text-white">Total: ${Number(a.order_total).toFixed(2)}</div>
                )}

                <div className="flex gap-3">
                  {a.customer_lat && a.customer_lng && (
                    <button
                      onClick={() => openMaps(a.customer_lat, a.customer_lng)}
                      className="flex-1 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Navigation className="w-4 h-4" /> Abrir Mapa
                    </button>
                  )}
                  {a.customer_phone && (
                    <a
                      href={`tel:${a.customer_phone}`}
                      className="h-12 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </div>

                <button
                  onClick={() => handleUpdateStatus(a.id, "delivered")}
                  disabled={updatingId === a.id}
                  className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5" /> Marcar como Entregado
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Pending Assignments (not yet picked up) ─── */}
      <div className="px-5 pb-20">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Por Recoger ({pendingAssignments.length})
        </h2>
        {pendingAssignments.length === 0 && inTransit.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
            <Bike className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-black text-slate-500 uppercase tracking-wider">Sin entregas pendientes</h3>
            <p className="text-sm text-slate-600 mt-2">Te notificaremos cuando se te asigne un pedido.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingAssignments.map((a) => (
              <div key={a.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-black text-blue-400 uppercase">Pedido #{a.order_id?.slice(-8)}</div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                      {a.distance_km ? <span>📍 {a.distance_km} km</span> : null}
                      {a.delivery_fee ? <span>• ${Number(a.delivery_fee).toFixed(2)} envío</span> : null}
                      {a.assigned_at && <span>• <Clock className="w-3 h-3 inline" /> {new Date(a.assigned_at).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-black uppercase">Asignado</span>
                </div>

                {a.order_total && (
                  <div className="text-sm font-bold text-white">Total del pedido: ${Number(a.order_total).toFixed(2)}</div>
                )}

                <button
                  onClick={() => handleUpdateStatus(a.id, "picked_up")}
                  disabled={updatingId === a.id}
                  className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Package className="w-5 h-5" /> Recogido de Cocina
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
