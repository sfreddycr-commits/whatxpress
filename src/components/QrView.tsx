import React, { useState } from "react";
import { Menu, Plus, Trash2, QrCode, Sparkles, Users, Printer, UtensilsCrossed } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  tenantId: string;
  token: string;
  dbTables: any[];
  refreshDashboard: () => void;
  setIsSidebarOpen: (v: boolean) => void;
}

export const QrView: React.FC<Props> = ({
  tenantId,
  token,
  dbTables,
  refreshDashboard,
  setIsSidebarOpen,
}) => {
  const [newTableNumber, setNewTableNumber] = useState("");
  const [tableCapacity, setTableCapacity] = useState("4");
  const baseUrl = window.location.origin;

  const addTable = async () => {
    if (!newTableNumber.trim()) return;
    await fetch("/api/tenant/tables", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        table_number: newTableNumber,
        capacity: Number(tableCapacity),
      }),
    });
    setNewTableNumber("");
    refreshDashboard();
  };

  const deleteTable = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta mesa?")) return;
    await fetch(`/api/tenant/tables/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    refreshDashboard();
  };

  const handlePrint = () => window.print();

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-50 relative">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; width: 100%; background: white; }
          .no-print { display: none !important; }
          .print-break { page-break-inside: avoid; break-inside: avoid; margin-bottom: 30px; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }
        }
      ` }} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 no-print">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden">
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Gestión de Mesas</h1>
            <p className="text-xs text-slate-500 font-bold tracking-wide mt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-orange-500" />
              Códigos QR auto-generados para pedidos automáticos.
            </p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          disabled={dbTables.length === 0}
          className="h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-black shadow-lg shadow-slate-900/10 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" /> Imprimir QR Codes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#109e38]" /> Nueva Mesa
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5">Número / Identificador</label>
                <input
                  type="text"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="Ej: 1, Terraza, Bar 2"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border-2 border-slate-100 text-sm font-bold text-slate-700 placeholder-slate-300 focus:bg-white focus:border-[#109e38] transition-all outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5">Capacidad</label>
                <input
                  type="number"
                  value={tableCapacity}
                  onChange={(e) => setTableCapacity(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border-2 border-slate-100 text-sm font-bold text-slate-700 focus:bg-white focus:border-[#109e38] transition-all outline-none"
                />
              </div>
              <button
                onClick={addTable}
                disabled={!newTableNumber.trim()}
                className="w-full h-12 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl text-sm font-black uppercase tracking-wider shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Crear Mesa <QrCode className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-3xl p-6">
            <h4 className="text-xs font-black text-green-900 uppercase mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> ¿Cómo Funciona?
            </h4>
            <p className="text-xs text-green-800 leading-relaxed font-medium">
              Al crear una mesa, el sistema genera un enlace inteligente. Cuando el cliente escanea el código con su celular, el menú se abre automáticamente precargado con su número de mesa.
            </p>
          </div>
        </div>

        {/* QR Grid */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-6 min-h-[500px]">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-sm font-black text-slate-900">Total Mesas Activas ({dbTables.length})</h3>
            </div>
            {dbTables.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-slate-300">
                  <QrCode className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-slate-500">No hay mesas registradas aún.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {dbTables.map((t: any) => {
                  const qrUrl = `${baseUrl}/order/${tenantId}?table=${encodeURIComponent(t.table_number)}`;
                  return (
                    <div
                      key={t.id}
                      className="group relative bg-white border-2 border-slate-100 rounded-3xl p-5 flex flex-col items-center transition-all hover:border-[#109e38]/30 hover:shadow-xl hover:shadow-slate-200/40 hover:-translate-y-1 overflow-hidden"
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTable(t.id); }}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-sm border border-red-100 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="w-full text-center mb-4">
                        <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest inline-block">
                          Mesa #{t.table_number}
                        </span>
                        <div className="text-[10px] font-bold text-slate-400 mt-2 flex items-center justify-center gap-1">
                          <Users className="w-3 h-3" /> {t.capacity || 4} Personas
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-2xl border-2 border-slate-50 shadow-inner">
                        <QRCodeSVG value={qrUrl} size={120} level="H" includeMargin={false} />
                      </div>
                      <p className="text-[9px] text-slate-400 mt-4 break-all font-mono opacity-60 text-center line-clamp-1">
                        {qrUrl}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print Section */}
      <div id="print-section" className="hidden print:block p-10 bg-white">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-slate-900">Códigos QR de Pedidos</h1>
          <p className="text-sm text-slate-500 font-bold">WhatXpress Digital Engine</p>
        </div>
        <div className="grid grid-cols-2 gap-10">
          {dbTables.map((t: any) => {
            const qrUrl = `${baseUrl}/order/${tenantId}?table=${encodeURIComponent(t.table_number)}`;
            return (
              <div
                key={`print-${t.id}`}
                className="print-break flex flex-col items-center justify-center p-8 border-4 border-slate-900 rounded-3xl bg-white aspect-[3/4]"
              >
                <UtensilsCrossed className="w-8 h-8 text-[#109e38] mb-4" />
                <h2 className="text-xl font-black text-slate-900 tracking-widest uppercase mb-1">ESCANEA Y ORDENA</h2>
                <p className="text-sm text-slate-600 font-bold mb-6">Desde tu propio celular</p>
                <div className="p-4 border-2 border-slate-100 rounded-xl bg-white mb-6 shadow-sm">
                  <QRCodeSVG value={qrUrl} size={180} level="H" includeMargin={true} />
                </div>
                <div className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xl font-black tracking-wider uppercase">
                  MESA #{t.table_number}
                </div>
                <p className="text-xs text-slate-400 font-bold mt-8">Powered by WhatXpress</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};