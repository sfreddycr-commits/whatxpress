import React, { useState } from "react";
import { Menu, Loader2, Sparkles } from "lucide-react";

interface Props {
  tenantId: string;
  token: string;
  tenant: any;
  refreshDashboard: () => void;
  setIsSidebarOpen: (v: boolean) => void;
}

export const SubscriptionView: React.FC<Props> = ({
  tenantId,
  token,
  tenant,
  refreshDashboard,
  setIsSidebarOpen,
}) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [planDbFeatures, setPlanDbFeatures] = useState<string[]>([]);
  const [upgrading, setUpgrading] = useState(false);

  const trialEnds = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const now = new Date();
  const isTrialing = tenant?.subscription_status === "trialing";
  const isCanceling = tenant?.subscription_status === "canceling";
  const isPastDue = tenant?.subscription_status === "past_due";
  const daysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const periodEnd = tenant?.current_period_end ? new Date(tenant.current_period_end) : null;
  const planName = tenant?.plan || "Trial";
  const planPrice = planName === "Pro" ? 99 : planName === "Starter" ? 29 : 0;
  const currency = "$";

  React.useEffect(() => {
    fetch("/api/tenant/invoices/" + tenantId, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((res) => res.json())
      .then((data) => setInvoices(data || []))
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
  }, [tenantId, token]);

  React.useEffect(() => {
    fetch("/api/public/plans")
      .then((res) => res.json())
      .then((plans: any[]) => {
        const currentPlan = plans.find((p: any) => p.name === planName);
        if (currentPlan && Array.isArray(currentPlan.features)) {
          setPlanDbFeatures(currentPlan.features);
        }
      })
      .catch(() => {});
  }, [planName]);

  const handleUpgrade = async (plan: string) => {
    setUpgrading(true);
    try {
      await fetch("/api/tenant/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ tenant_id: tenantId, plan }),
      });
      refreshDashboard();
    } catch (e) {
      console.error(e);
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      const res = await fetch("/api/tenant/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCancelConfirm(false);
        refreshDashboard();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCanceling(false);
    }
  };

  const statusBadge = () => {
    if (isTrialing) return { label: "Prueba", color: "bg-blue-50 text-blue-600", icon: "⏳" };
    if (isCanceling) return { label: "Cancelando", color: "bg-orange-50 text-orange-600", icon: "⏰" };
    if (isPastDue) return { label: "Pago Pendiente", color: "bg-red-50 text-red-600", icon: "⚠️" };
    return { label: "Activo", color: "bg-green-50 text-green-600", icon: "✅" };
  };

  const badge = statusBadge();
  const canCancel = !isTrialing && !isCanceling;

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mi Suscripcion</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Gestiona tu plan, pagos y facturas.</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        {isTrialing && (
          <div className="bg-[#109e38] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl shadow-[#109e38]/20">
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-widest mb-3">
                    Periodo de Prueba
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black mb-2">
                    Quedan {daysLeft} dia{daysLeft !== 1 ? "s" : ""} de prueba
                  </h2>
                  <p className="text-green-50 font-medium opacity-90 text-sm max-w-md">
                    Estas disfrutando de todas las funciones Pro. Actualiza para mantener tu servicio sin interrupciones.
                  </p>
                </div>
                <button
                  onClick={() => handleUpgrade("Pro")}
                  disabled={upgrading}
                  className="h-14 px-6 bg-white text-[#109e38] rounded-2xl font-black text-sm hover:bg-green-50 transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto"
                >
                  {upgrading ? (
                    <Loader2 className="animate-spin w-4 h-4" />
                  ) : (
                    "Actualizar a Pro - $99/mes"
                  )}
                </button>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
          </div>
        )}

        {isPastDue && (
          <div className="bg-red-50 rounded-3xl p-6 border border-red-200">
            <div className="flex items-start gap-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-lg font-black text-red-800">Pago Pendiente</h3>
                <p className="text-sm text-red-600 mt-1">
                  Tu ultimo pago no pudo procesarse. Actualiza tu metodo de pago para reactivar el servicio.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Plan Actual</h3>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-[#109e38] shrink-0">
                  <Sparkles size={28} />
                </div>
                <div>
                  <div className="text-xl font-black text-slate-900">{planName}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={"inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase " + badge.color}>
                      {badge.icon} {badge.label}
                    </span>
                    {periodEnd && !isTrialing && (
                      <span className="text-xs text-slate-400">Renueva: {periodEnd.toLocaleDateString("es-CR")}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-slate-900">
                  {currency}
                  {planPrice}
                  <span className="text-sm font-medium text-slate-400">/mes</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-slate-100">
              {!isTrialing && planName !== "Pro" && (
                <button
                  onClick={() => handleUpgrade("Pro")}
                  disabled={upgrading}
                  className="flex-1 h-12 bg-[#109e38] text-white rounded-xl font-black text-sm hover:bg-[#0d842e] transition-colors flex items-center justify-center gap-2"
                >
                  {upgrading ? <Loader2 className="animate-spin w-4 h-4" /> : <><Sparkles className="w-4 h-4" /> Cambiar a Pro</>}
                </button>
              )}
              <button className="flex-1 h-12 border border-slate-200 bg-white text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors">
                Cambiar Metodo de Pago
              </button>
              {canCancel && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex-1 h-12 border border-red-200 bg-white text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors"
                >
                  Cancelar Plan
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Historial de Facturas</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {loadingInvoices ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="animate-spin w-5 h-5 text-slate-300" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">📄</span>
                </div>
                <p className="text-sm text-slate-400 font-medium">No hay facturas aun</p>
              </div>
            ) : (
              invoices.map((inv: any) => (
                <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-black">
                      {inv.status === "paid" ? "✅" : inv.status === "pending" ? "⏳" : "❌"}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {currency}
                        {inv.amount} {inv.currency}
                      </div>
                      <div className="text-xs text-slate-400">
                        {inv.created_at
                          ? new Date(inv.created_at).toLocaleDateString("es-CR", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "-"}{" "}
                        | {inv.status}
                      </div>
                    </div>
                  </div>
                  <button className="text-xs font-bold text-[#109e38] hover:underline">Descargar</button>
                </div>
              ))
            )}
          </div>
        </div>

        {planDbFeatures.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Funciones Incluidas</h3>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {planDbFeatures.map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-green-50 text-[#109e38] flex items-center justify-center text-xs font-black">✓</span>
                  <span className="text-slate-700 font-medium">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div onClick={() => setShowCancelConfirm(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-black text-slate-900">Confirmar Cancelacion</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-6">
                Estas a punto de cancelar tu suscripcion. Perderas acceso a todas las funciones premium al final del periodo de facturacion actual.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 h-12 border border-slate-200 bg-white text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  Mantener Plan
                </button>
                <button
                  onClick={handleCancel}
                  disabled={canceling}
                  className="flex-1 h-12 bg-red-500 text-white rounded-xl font-black text-sm hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  {canceling ? <Loader2 className="animate-spin w-4 h-4" /> : "Confirmar Cancelacion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};