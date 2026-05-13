import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import { MapPin, Check, Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default marker icon issue in bundled apps
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  deliveryZones?: Array<{ zone_name: string; max_distance: number; fee: number }>;
}

// Sub-component that handles map click events
function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Sub-component to recenter the map
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);
  return null;
}

// Color palette for delivery zone circles
const ZONE_COLORS = ["#e91e63", "#f59e0b", "#a855f7", "#3b82f6", "#10b981"];

export const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  latitude,
  longitude,
  onLocationChange,
  deliveryZones = [],
}) => {
  const [isLocating, setIsLocating] = useState(false);

  // Default to San José, Costa Rica if no coordinates saved
  const defaultLat = latitude || 9.9341;
  const defaultLng = longitude || -84.0875;
  const hasLocation = latitude !== null && longitude !== null;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationChange(pos.coords.latitude, pos.coords.longitude);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        console.error("Geolocation error:", err);
        // Fallback silently or just log error.
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-4 relative">

      {/* Instructions */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
        <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-blue-800">Ubica tu restaurante en el mapa</p>
          <p className="text-xs text-blue-600 mt-1">Toca el mapa donde está tu restaurante, o usa el botón para detectar tu ubicación actual.</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          className="h-10 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? "animate-pulse" : ""}`} />
          {isLocating ? "Detectando..." : "Usar mi ubicación actual"}
        </button>
        {hasLocation && (
          <div className="flex items-center gap-1.5 px-3 bg-green-50 rounded-xl border border-green-100">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-xs font-bold text-green-700">Ubicación guardada</span>
          </div>
        )}
      </div>

      {/* The Map */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: "350px" }}>
        <MapContainer
          center={[defaultLat, defaultLng]}
          zoom={hasLocation ? 14 : 12}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationChange={onLocationChange} />

          {hasLocation && (
            <>
              <RecenterMap lat={latitude!} lng={longitude!} />
              <Marker position={[latitude!, longitude!]} />

              {/* Draw delivery zone circles */}
              {deliveryZones
                .sort((a, b) => b.max_distance - a.max_distance) // largest first so smaller ones render on top
                .map((zone, idx) => (
                  <Circle
                    key={zone.zone_name + zone.max_distance}
                    center={[latitude!, longitude!]}
                    radius={zone.max_distance * 1000} // km to meters
                    pathOptions={{
                      color: ZONE_COLORS[idx % ZONE_COLORS.length],
                      fillColor: ZONE_COLORS[idx % ZONE_COLORS.length],
                      fillOpacity: 0.08,
                      weight: 2,
                      dashArray: "6 4",
                    }}
                  />
                ))}
            </>
          )}
        </MapContainer>
      </div>

      {/* Legend for delivery zones */}
      {hasLocation && deliveryZones.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {deliveryZones
            .sort((a, b) => a.max_distance - b.max_distance)
            .map((zone, idx) => (
               <div key={zone.zone_name} className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-2">
                <div
                  className="w-3 h-3 rounded-full border-2"
                  style={{ borderColor: ZONE_COLORS[idx % ZONE_COLORS.length], backgroundColor: ZONE_COLORS[idx % ZONE_COLORS.length] + "20" }}
                />
                <span className="text-[10px] font-bold text-slate-600">
                  {zone.zone_name} — {zone.max_distance}km — ${zone.fee}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Coordinate display */}
      {hasLocation && (
        <div className="text-[10px] text-slate-400 font-mono">
          📍 {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
        </div>
      )}
    </div>
  );
};

