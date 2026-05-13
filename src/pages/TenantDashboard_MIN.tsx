import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function TenantDashboard_MIN() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashData, setDashData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const tenantId = localStorage.getItem("tenantId");
    console.log("[MIN] mount, token:", !!token, "tenantId:", tenantId);
    
    if (!token || !tenantId) {
      console.log("[MIN] No token/tenantId, redirect to login");
      navigate("/login");
      return;
    }

    fetch(`/api/tenant-dashboard/${tenantId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(r => {
        console.log("[MIN] API response status:", r.status);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(data => {
        console.log("[MIN] API success, data keys:", Object.keys(data));
        setDashData(data);
        setLoading(false);
      })
      .catch(err => {
        console.log("[MIN] API error:", err.message);
        setError(err.message);
        setLoading(false);
      });
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-[#109e38] animate-spin" />
        <span className="ml-3 text-slate-500">Cargando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-red-500 font-bold mb-2">ERROR: {error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[#109e38] text-white rounded-lg">
            Recargar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-3xl font-black text-slate-900">Dashboard Cargado!</h1>
      <p className="mt-2 text-slate-600">Tenant: {dashData?.tenant?.name}</p>
      <p className="mt-1 text-slate-600">Ventas hoy: ${dashData?.metrics?.today_sales}</p>
      <p className="mt-1 text-slate-600">Token presente: {!!localStorage.getItem("token")}</p>
      <p className="mt-1 text-slate-600">TenantId: {localStorage.getItem("tenantId")}</p>
    </div>
  );
}
