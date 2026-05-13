import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Navigation, MessageSquare, CheckCircle, AlertTriangle, Bike, Loader2 } from 'lucide-react';

export default function DriverMicroPanel() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
    // Start tracking loop
    const trackInterval = setInterval(updateCurrentLocation, 10000); // every 10 seconds
    return () => clearInterval(trackInterval);
  }, [token]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/public/track/driver/${token}`);
      if (!res.ok) {
         const errData = await res.json();
         throw new Error(errData.error || "Enlace inválido.");
      }
      const data = await res.json();
      setAssignment(data);
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const updateCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
       fetch(`/api/public/track/driver/${token}/location`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
       }).catch(() => {}); // silent fail
    }, undefined, { enableHighAccuracy: true });
  };

  const handleAction = async (action: 'picked_up' | 'delivered') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/track/driver/${token}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        if (action === 'delivered') {
           setAssignment((prev: any) => ({ ...prev, status: 'delivered' }));
        } else {
           fetchData(); // refresh data for state updates
        }
      }
    } catch (e) {}
    setActionLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
    </div>
  );

  if (error || assignment?.status === 'delivered') {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
         <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
         </div>
         <h1 className="text-2xl font-black mb-2">¡Buen Trabajo!</h1>
         <p className="text-slate-400 text-sm">{error || "Esta entrega ha finalizado satisfactoriamente. El panel ya expiró."}</p>
       </div>
     );
  }

  const openMaps = () => {
     if (assignment.customer_lat && assignment.customer_lng) {
        // Open combined picker or default to waze/google
        const url = `https://www.google.com/maps/dir/?api=1&destination=${assignment.customer_lat},${assignment.customer_lng}`;
        window.open(url, '_blank');
     } else {
        alert("No hay coordenadas GPS guardadas.");
     }
  };

  const openWaze = () => {
    if (assignment.customer_lat && assignment.customer_lng) {
      window.open(`waze://?ll=${assignment.customer_lat},${assignment.customer_lng}&navigate=yes`, '_blank');
    }
  }

  const openWhatsApp = () => {
     if (assignment.customer_phone) {
        window.open(`https://wa.me/${assignment.customer_phone.replace(/\D/g, '')}?text=Hola, soy el repartidor de tu pedido.`, '_blank');
     }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col pb-10">
      {/* Sticky top status */}
      <div className="p-5 bg-slate-800 shadow-lg border-b border-slate-700 sticky top-0 z-10 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
               <Bike className="w-6 h-6 text-white" />
            </div>
            <div>
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Orden de Entrega</h2>
               <div className="font-black text-lg text-white">Mesa {assignment.table_number || "Llevar"}</div>
            </div>
         </div>
         <div className="text-right">
             <div className="text-2xl font-black text-orange-400">${assignment.order_total?.toFixed(2) || '0'}</div>
         </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 max-w-md mx-auto w-full pt-6">
         
         {assignment.status === 'assigned' && (
           <button 
             onClick={() => handleAction('picked_up')}
             disabled={actionLoading}
             className="w-full h-20 bg-blue-600 active:bg-blue-700 rounded-3xl flex items-center justify-center gap-4 font-black text-lg shadow-lg active:scale-95 transition-all mb-4 border-2 border-blue-400 shadow-blue-900/20"
           >
              {actionLoading ? <Loader2 className="animate-spin" /> : <Bike />}
              MARCAR RECOGIDO
           </button>
         )}

         <div className="grid grid-cols-2 gap-4">
            <button 
               onClick={openMaps}
               className="aspect-square bg-slate-800 rounded-3xl border border-slate-700 flex flex-col items-center justify-center gap-3 shadow-md active:bg-slate-700 transition-all active:scale-95"
            >
               <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Navigation className="w-7 h-7" />
               </div>
               <span className="font-bold text-sm">Abrir Maps</span>
            </button>

            <button 
               onClick={openWaze}
               className="aspect-square bg-slate-800 rounded-3xl border border-slate-700 flex flex-col items-center justify-center gap-3 shadow-md active:bg-slate-700 transition-all active:scale-95"
            >
               <div className="w-14 h-14 rounded-full bg-blue-400/20 flex items-center justify-center text-blue-400">
                  <img src="https://cdn-icons-png.flaticon.com/512/2111/2111728.png" className="w-7 h-7 invert opacity-70" alt="Waze" />
               </div>
               <span className="font-bold text-sm">Abrir Waze</span>
            </button>
         </div>

         <button 
            onClick={openWhatsApp}
            className="w-full py-6 bg-emerald-600 rounded-3xl flex items-center justify-center gap-4 font-bold text-lg shadow-lg active:bg-emerald-700 transition-all active:scale-95"
         >
            <MessageSquare className="w-6 h-6" />
            Chat con Cliente
         </button>

         <div className="mt-auto pt-10">
            <button 
              onClick={() => {
                 if (window.confirm("¿Confirmas que ya entregaste el pedido al cliente?")) {
                    handleAction('delivered');
                 }
              }}
              disabled={actionLoading}
              className="w-full py-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-[2rem] flex flex-col items-center justify-center gap-2 font-black text-xl shadow-2xl shadow-green-500/20 active:scale-95 transition-all border border-green-400"
            >
               <CheckCircle className="w-10 h-10" />
               CONFIRMAR ENTREGA
            </button>
         </div>

      </div>
    </div>
  );
}
