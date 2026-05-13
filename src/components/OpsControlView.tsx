import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Clock, CheckCircle, Bike, ChefHat, AlertCircle, ChevronRight, Receipt, Printer, CreditCard, Link, Share, Loader2, RefreshCw } from 'lucide-react';

interface OpsControlViewProps {
  setIsSidebarOpen: (v: boolean) => void;
  metrics: any;
  refreshDashboard: () => void;
}

export const OpsControlView: React.FC<OpsControlViewProps> = ({ setIsSidebarOpen, metrics, refreshDashboard }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const tenantId = localStorage.getItem("tenantId");
  const token = localStorage.getItem("token");

  const fetchOps = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/tenant/ops-control/${tenantId}`, {
         headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
         const data = await res.json();
         setOrders(data);
      }
    } catch (e) {}
    setLoading(false);
  }, [tenantId, token]);

  useEffect(() => {
    fetchOps();
    const interval = setInterval(fetchOps, 15000); // auto-refresh every 15s
    return () => clearInterval(interval);
  }, [fetchOps]);

  // --- CLASSIFICATION LOGIC ---
  // 1. Nuevas / Entrantes: Recién creadas, sin trabajo en cocina avanzado
  const colNuevas = orders.filter(o => {
     return (o.total_items === 0 || o.ready_items === 0) && (!o.delivery_status || o.delivery_status === 'pending') && o.table_number !== 'Llevar';
  });

  // 2. En Cocina: Tienen ítems preparándose
  const colCocina = orders.filter(o => {
     return o.total_items > 0 && o.ready_items < o.total_items && o.ready_items > 0;
  });

  // 3. Listos / Despacho: Comida terminada Y es para Delivery o espera de entrega local
  const colDespacho = orders.filter(o => {
      const isReadyInKitchen = o.total_items > 0 && o.ready_items === o.total_items;
      const isSimpleDelivery = o.table_number === 'Llevar' && (!o.delivery_status || o.delivery_status === 'pending');
      return (isReadyInKitchen || isSimpleDelivery) && (!o.delivery_status || o.delivery_status === 'pending');
  });

  // 4. En Calle / Ruta: El motorizado ya la tiene asignada
  const colRuta = orders.filter(o => {
     return o.delivery_status === 'assigned' || o.delivery_status === 'picked_up';
  });

  // Helper to classify remaining edge cases into sensible defaults if filters miss any
  const shownIds = new Set([...colNuevas, ...colCocina, ...colDespacho, ...colRuta].map(x => x.id));
  const rest = orders.filter(o => !shownIds.has(o.id));
  // Inject any orphans back into Col 1 
  const finalCol1 = [...colNuevas, ...rest];

  const renderCard = (order: any) => {
     const isDelivery = order.table_number === 'Llevar';
     const timeAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
     
     return (
       <div key={order.id} className="group bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden">
          {/* Highlight edge based on urgency */}
          <div className={`absolute top-0 left-0 w-1 h-full ${timeAgo > 30 ? 'bg-red-500' : 'bg-orange-400'}`}></div>
          
          <div className="flex justify-between items-start pl-2">
             <div>
                <div className="flex items-center gap-2">
                   <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${isDelivery ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                      {isDelivery ? 'Domicilio 🛵' : `Mesa ${order.table_number}`}
                   </span>
                   <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo}m</span>
                </div>
                <h4 className="font-black text-slate-900 mt-1 text-sm">Orden #{order.id.slice(-5).toUpperCase()}</h4>
             </div>
             <div className="font-black text-slate-900 text-sm">${order.total?.toFixed(2)}</div>
          </div>

          {/* Progress / Stats */}
          {order.total_items > 0 && (
             <div className="pl-2 space-y-1.5">
                 <div className="flex justify-between text-[10px] font-bold text-slate-500">
                     <span>Cocina</span>
                     <span>{order.ready_items}/{order.total_items} listos</span>
                 </div>
                 <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(order.ready_items / order.total_items) * 100}%` }}></div>
                 </div>
             </div>
          )}

          {/* Action Buttons inside Card */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 pl-2">
             {order.delivery_id && !order.driver_id && (
                <span className="w-full text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-1 rounded text-center flex items-center justify-center gap-1">
                   <AlertCircle className="w-3 h-3" /> Asignar Chofer en pestaña Envíos
                </span>
             )}
             
             {order.driver_name && (
                <div className="w-full flex items-center gap-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                   <div className="w-6 h-6 bg-[#109e38] rounded-full flex items-center justify-center text-white font-bold">{order.driver_name[0]}</div>
                   <div className="flex-1">
                      <div className="font-black text-slate-700">{order.driver_name}</div>
                      <div className="text-slate-400 uppercase tracking-wider">{order.delivery_status === 'picked_up' ? 'En camino' : 'Asignado'}</div>
                   </div>
                </div>
             )}

             {order.driver_token && (
                <button 
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/t/${order.customer_token}`); alert("Enlace copiado"); }}
                  className="h-7 px-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1"
                >
                   <Share className="w-3 h-3" /> Link Cliente
                </button>
             )}
          </div>
       </div>
     );
  };

  const Column = ({ title, icon: Icon, items, colorClass }: any) => (
     <div className="flex-1 min-w-[280px] max-w-[350px] flex flex-col h-full bg-slate-100/40 rounded-2xl overflow-hidden border border-slate-200/50">
        <div className={`p-4 border-b border-slate-200 flex justify-between items-center bg-white`}>
           <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorClass}`}>
                 <Icon className="w-4 h-4" />
              </div>
              <h3 className="font-black text-slate-900 uppercase text-xs tracking-wider">{title}</h3>
           </div>
           <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-black text-slate-500">{items.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-300">
           {items.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl mt-2">
                 <CheckCircle className="w-6 h-6 mb-2 opacity-20" />
                 <span className="text-xs font-bold opacity-50">Sin órdenes</span>
              </div>
           ) : (
              items.map(renderCard)
           )}
        </div>
     </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 h-full">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
         <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden"><Menu className="w-6 h-6" /></button>
            <div>
               <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase">
                  <div className="w-2 h-2 rounded-full bg-[#109e38] animate-pulse"></div>
                  Centro de Operaciones
               </h1>
               <p className="text-xs text-slate-500 font-medium mt-0.5">Monitoreo en tiempo real de todo el flujo de tu restaurante.</p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <button onClick={fetchOps} className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-all border border-slate-200">
               {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            </button>
         </div>
      </div>

      {/* Kanban Container - Horizontal scrolling wrapper */}
      <div className="flex-1 overflow-x-auto p-6 flex items-start gap-6 h-[calc(100vh-140px)] min-h-0">
         
         <Column 
           title="Entrante / Local" 
           icon={Receipt} 
           items={finalCol1} 
           colorClass="bg-blue-100 text-blue-600"
         />
         
         <Column 
           title="En Cocina" 
           icon={ChefHat} 
           items={colCocina} 
           colorClass="bg-orange-100 text-orange-600"
         />
         
         <Column 
           title="Por Despachar" 
           icon={BoxIcon} 
           items={colDespacho} 
           colorClass="bg-purple-100 text-purple-600"
         />
         
         <Column 
           title="En Ruta" 
           icon={Bike} 
           items={colRuta} 
           colorClass="bg-[#e6f6ea] text-[#109e38]"
         />

      </div>
    </div>
  );
};

// Missing Box icon from Lucide inline wrapper
const BoxIcon = ({ className }: any) => (
   <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
);
