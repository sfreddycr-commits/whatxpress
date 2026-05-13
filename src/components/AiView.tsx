import React, { useState, useEffect } from "react";
import { Menu, Save } from "lucide-react";
import { WhatsAppConnector } from "./WhatsAppConnector";

interface AiViewProps {
  setIsSidebarOpen: (v: boolean) => void;
  aiConfig: any;
  refreshDashboard: () => void;
}

export const AiView: React.FC<AiViewProps> = ({ setIsSidebarOpen, aiConfig, refreshDashboard }) => {
  const [aiConfigForm, setAiConfigForm] = useState<any>({});

  useEffect(() => {
    if (aiConfig) {
      setAiConfigForm(aiConfig);
    }
  }, [aiConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tenantId = localStorage.getItem("tenantId") || "";
    const token = localStorage.getItem("token") || "";
    await fetch("/api/tenant/ai-config", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...aiConfigForm, tenant_id: tenantId }),
    });
    refreshDashboard();
  };

  return (
    <form onSubmit={handleSave} className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="p-4 sm:p-8 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden"><Menu className="w-6 h-6" /></button>
          <div className="flex-1"><h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Configuración de IA</h1><p className="text-sm text-slate-500 font-medium mt-1">Personaliza el comportamiento del agente de WhatsApp.</p></div>
          <button type="submit" className="h-10 px-6 bg-[#e91e63] hover:bg-[#d81b60] text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"><Save className="w-4 h-4" /> Guardar Configuración</button>
        </div>
      </div>
      <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-3xl space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-black text-slate-900 uppercase text-sm">Identidad del Bot</h3>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Prompt de Identidad</label>
              <textarea value={aiConfigForm.identity_prompt || ""} onChange={e => setAiConfigForm({...aiConfigForm, identity_prompt: e.target.value})} placeholder="Eres un asistente virtual para..." className="w-full h-24 p-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63] resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Instrucciones Personalizadas</label>
              <textarea value={aiConfigForm.custom_instructions || ""} onChange={e => setAiConfigForm({...aiConfigForm, custom_instructions: e.target.value})} placeholder="Instrucciones específicas para el bot..." className="w-full h-24 p-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63] resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Reglas Operacionales</label>
              <textarea value={aiConfigForm.operational_rules || ""} onChange={e => setAiConfigForm({...aiConfigForm, operational_rules: e.target.value})} placeholder="Reglas de negocio..." className="w-full h-24 p-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#e91e63] resize-none" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-black text-slate-900 uppercase text-sm">Funcionalidades</h3>
            <div className="space-y-3">
              {[
                { key: "auto_upselling", label: "Auto-Upselling", desc: "El bot sugiere productos adicionales automáticamente" },
                { key: "reservation_confirmation", label: "Confirmación de Reservas", desc: "Confirma reservas automáticamente por WhatsApp" },
                { key: "loyalty_rewards", label: "Programa de Lealtad", desc: "Gestiona puntos y recompensas para clientes frecuentes" },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                  <input type="checkbox" checked={!!aiConfigForm[key]} onChange={e => setAiConfigForm({...aiConfigForm, [key]: e.target.checked})} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#e91e63] focus:ring-[#e91e63]" />
                  <div><div className="text-sm font-bold text-slate-900">{label}</div><div className="text-xs text-slate-400">{desc}</div></div>
                </label>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-black text-slate-900 uppercase text-sm">Conexión de WhatsApp</h3>
            <WhatsAppConnector tenantId={localStorage.getItem("tenantId") || ""} />
          </div>
        </div>
      </div>
    </form>
  );
};
