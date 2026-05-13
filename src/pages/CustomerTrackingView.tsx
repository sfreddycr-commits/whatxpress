import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Loader2, Bike, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';



// Create custom custom bike icon for moving driver
const bikeIcon = L.divIcon({
  html: `<div style="background-color: #109e38; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
  </div>`,
  className: 'custom-div-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const homeIcon = L.divIcon({
  html: `<div style="background-color: #ef4444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>`,
  className: 'custom-div-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Fit map bounds component
function ChangeView({ center, bounds }: any) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds[0] && bounds[1]) {
       map.fitBounds(bounds, { padding: [50, 50] });
    } else if (center) {
       map.setView(center, 16);
    }
  }, [bounds, center, map]);
  return null;
}

export default function CustomerTrackingView() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const pollLocation = async () => {
    try {
      const res = await fetch(`/api/public/track/customer/${token}`);
      if (!res.ok) throw new Error("Link expirado.");
      const data = await res.json();
      setAssignment(data);
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    pollLocation();
    const interval = setInterval(pollLocation, 8000); // Poll every 8 sec
    return () => clearInterval(interval);
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="w-12 h-12 text-[#109e38] animate-spin mb-4" />
      <p className="font-bold text-slate-600">Cargando Mapa de Seguimiento...</p>
    </div>
  );

  if (error || assignment?.status === 'delivered') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
           <Bike className="w-10 h-10 text-[#109e38]" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">¡Pedido Entregado!</h2>
        <p className="text-slate-500">Disfruta de tu comida. ¡Gracias por tu preferencia!</p>
      </div>
    );
  }

  const driverPos: [number, number] | null = assignment.current_lat ? [assignment.current_lat, assignment.current_lng] : null;
  const customerPos: [number, number] | null = assignment.customer_lat ? [assignment.customer_lat, assignment.customer_lng] : null;
  
  // Default view center if only one exists
  const defaultCenter: [number, number] = customerPos || driverPos || [0,0];
  
  // Build bounds array properly
  let bounds: any = null;
  if (driverPos && customerPos) {
      bounds = [driverPos, customerPos];
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden relative">
      
      {/* Top Info Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] bg-white rounded-2xl shadow-xl p-4 border border-slate-100 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="relative">
               <div className="w-12 h-12 bg-[#109e38] rounded-full flex items-center justify-center">
                  <Bike className="w-6 h-6 text-white" />
               </div>
               <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full animate-pulse"></div>
            </div>
            <div>
               <h3 className="font-black text-slate-900">¡Tu pedido viene en camino!</h3>
               <p className="text-xs font-medium text-slate-500">Repartidor: <span className="font-bold text-slate-800">{assignment.driver_name}</span></p>
            </div>
         </div>
         <div className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600 uppercase tracking-wider">
            {assignment.status === 'assigned' ? 'Esperando' : 'En Ruta'}
         </div>
      </div>

      {/* Full Map Container */}
      <div className="flex-1 relative">
        <MapContainer 
          center={defaultCenter} 
          zoom={15} 
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ChangeView center={defaultCenter} bounds={bounds} />
          
          {customerPos && (
             <Marker position={customerPos} icon={homeIcon}>
                <Popup>Tu Ubicación</Popup>
             </Marker>
          )}
          
          {driverPos && (
             <Marker position={driverPos} icon={bikeIcon}>
                <Popup>Repartidor Aquí</Popup>
             </Marker>
          )}
        </MapContainer>
      </div>

      {/* Bottom status card */}
      <div className="bg-white p-6 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)] rounded-t-3xl border-t border-slate-100 z-[1000]">
         <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
               <div className={`h-full bg-[#109e38] transition-all duration-500 ${assignment.status === 'assigned' ? 'w-1/3' : 'w-2/3'}`}></div>
            </div>
            <span className="text-sm font-black text-[#109e38]">{assignment.status === 'assigned' ? '33%' : '66%'}</span>
         </div>
         <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 mt-1">
               <MapPin className="w-4 h-4" />
            </div>
            <div>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Destino de entrega</span>
               <span className="text-sm font-bold text-slate-800">Aproximadamente {assignment.distance_km || '?'} km de distancia</span>
            </div>
         </div>
      </div>

    </div>
  );
}
