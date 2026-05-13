import { useState, useEffect } from "react";
import { Loader2, QrCode, ShieldCheck, Unplug } from "lucide-react";

export function WhatsAppConnector({ tenantId }: { tenantId: string }) {
  const [status, setStatus] = useState<string>("checking...");
  const [qrCode, setQrCode] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/whatsapp/status/${tenantId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        if (data.status === 'qr_ready') {
          setQrCode(data.qr);
        } else {
          setQrCode(null);
        }
      }
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const connect = async () => {
    setStatus("connecting");
    try {
      const token = localStorage.getItem("token") || "";
      await fetch(`/api/whatsapp/connect/${tenantId}`, { 
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      checkStatus();
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  };

  const disconnect = async () => {
    setStatus("disconnecting");
    try {
      const token = localStorage.getItem("token") || "";
      await fetch(`/api/whatsapp/disconnect/${tenantId}`, { 
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      checkStatus();
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-xl border-2 border-slate-100 bg-slate-50">
      <div className="flex-1">
        {status === "connected" ? (
          <div>
            <div className="flex items-center gap-2 text-green-600 font-bold mb-2">
              <ShieldCheck className="w-5 h-5" /> Active Connection
            </div>
            <p className="text-sm text-slate-500 font-medium mb-4">
              Your autonomous agent is now live and responding to messages on WhatsApp. All actions will be logged in the simulator and your POS.
            </p>
            <button 
              onClick={disconnect}
              className="px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
            >
              <Unplug className="w-4 h-4" /> Disconnect
            </button>
          </div>
        ) : status === "qr_ready" ? (
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-bold mb-2">
              <QrCode className="w-5 h-5" /> Link WhatsApp Account
            </div>
            <p className="text-sm text-slate-500 font-medium mb-4">
              Open WhatsApp on your phone, go to Linked Devices, and scan this QR code to connect your assistant.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-2">
              <QrCode className="w-5 h-5" /> Setup WhatsApp Integration
            </div>
            <p className="text-sm text-slate-500 font-medium mb-4">
              Initialize a new session to generate a QR code.
            </p>
            <button 
              onClick={connect}
              disabled={status === "connecting"}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {status === "connecting" && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === "connecting" ? "Initializing..." : "Generate QR Code"}
            </button>
          </div>
        )}
      </div>

      {status === "qr_ready" && qrCode && (
        <div className="shrink-0 p-3 bg-white rounded-xl shadow-sm border border-slate-200">
          <img src={qrCode} alt="WhatsApp QR Code" className="w-40 h-40" />
        </div>
      )}
    </div>
  );
}
