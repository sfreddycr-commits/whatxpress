import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, ArrowRight, Star, Zap, Building2, Sparkles, UtensilsCrossed } from "lucide-react";
import { t, getLang, setLang, Language } from "../lib/i18n";

const rawText: Record<Language, any> = {
  es: {
    badge: "7 dias de prueba gratis en Pro",
    title: "Planes que crecen con tu restaurante",
    subtitle: "Desde tu primer pedido hasta multiples sucursales. Sin contratos, sin sorpresas.",
    popular: "Mas Popular",
    ctaTrial: "Prueba Gratis 7 Dias",
    ctaStart: "Comenzar",
    ctaContact: "Contactar Ventas",
    compare: { title: "Comparacion de Funcionalidades", feature: "Funcionalidad", starter: "Starter", pro: "Pro", enterprise: "Enterprise" },
    table: ["Pedidos por WhatsApp AI","POS Punto de Venta","KDS Cocina en tiempo real","Menu digital con QR","Delivery con zonas","Gestion de meseros","Promociones y cupones","Reportes avanzados","Multi-sucursal","API acceso","Soporte dedicado"],
    faq: [
      { q: "Puedo cambiar de plan despues?", a: "Si, puedes hacer upgrade o downgrade en cualquier momento desde tu dashboard. Los cambios aplican al siguiente ciclo de facturacion." },
      { q: "Hay contratos de permanencia?", a: "No. Todos los planes son mes a mes. Cancela cuando quieras sin penalizacion." },
      { q: "Que metodos de pago aceptan?", a: "Aceptamos PayPal. Proximamente tarjetas de credito/debito." },
      { q: "Cuanto dura la prueba gratuita?", a: "7 dias con acceso completo a todas las funciones Pro. Sin compromiso, sin tarjeta requerida." }
    ],
    cta: { title: "Listo para transformar tu restaurante?", desc: "Prueba Pro gratis por 7 dias. Sin tarjeta, sin compromiso.", btn: "Comenzar Prueba Gratis" },
    footer: "Restaurant OS",
    login: "Iniciar Sesion",
    loading: "Cargando planes..."
  },
  en: {
    badge: "7-day free Pro trial",
    title: "Plans that grow with your restaurant",
    subtitle: "From your first order to multiple locations. No contracts, no surprises.",
    popular: "Most Popular",
    ctaTrial: "7-Day Free Trial",
    ctaStart: "Get Started",
    ctaContact: "Contact Sales",
    compare: { title: "Feature Comparison", feature: "Feature", starter: "Starter", pro: "Pro", enterprise: "Enterprise" },
    table: ["WhatsApp AI Orders","POS Point of Sale","KDS Kitchen Display","QR Digital Menu","Delivery with Zones","Waiter Management","Promotions & Coupons","Advanced Reports","Multi-location","API Access","Dedicated Support"],
    faq: [
      { q: "Can I change plans later?", a: "Yes, you can upgrade or downgrade anytime from your dashboard. Changes apply to the next billing cycle." },
      { q: "Are there long-term contracts?", a: "No. All plans are month-to-month. Cancel anytime with no penalty." },
      { q: "What payment methods are accepted?", a: "We accept PayPal. Credit/debit cards coming soon." },
      { q: "How long is the free trial?", a: "7 days with full access to all Pro features. No commitment, no card required." }
    ],
    cta: { title: "Ready to transform your restaurant?", desc: "Try Pro free for 7 days. No card, no commitment.", btn: "Start Free Trial" },
    footer: "Restaurant OS",
    login: "Log In",
    loading: "Loading plans..."
  }
};

const featuresByPlan: Record<string, { name: string; included: boolean }[]> = {
  Starter: [{name:"Menu QR",included:true},{name:"POS",included:true},{name:"50 pedidos/mes",included:true},{name:"Meseros",included:true},{name:"Soporte email",included:true},{name:"WhatsApp AI",included:false},{name:"KDS Cocina",included:false},{name:"Delivery",included:false},{name:"Cupones",included:false},{name:"Reportes",included:false}],
  Professional: [{name:"Menu QR",included:true},{name:"POS",included:true},{name:"Ilimitado",included:true},{name:"Meseros",included:true},{name:"Soporte prioritario",included:true},{name:"WhatsApp AI",included:true},{name:"KDS Cocina",included:true},{name:"Delivery",included:true},{name:"Cupones",included:true},{name:"Reportes",included:true}],
  default: [{name:"Menu QR",included:true},{name:"POS",included:true},{name:"Meseros",included:true},{name:"WhatsApp AI",included:true},{name:"KDS Cocina",included:true}]
};
function planIcon(name: string) { return name.includes("Pro") || name.includes("Professional") ? Sparkles : name.includes("Enterprise") ? Building2 : Zap; }

export default function PricingPage() {
  const [lang, setLangState] = useState<Language>(getLang());
  const tr = rawText[lang] || rawText.es;
  const hl = (l: Language) => { setLang(l); setLangState(l); };
  const nav = useNavigate();
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/api/public/plans").then(r => r.json()).then(d => { setDbPlans(d||[]); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const checkMatrix = [[false,true,true],[true,true,true],[false,true,true],[true,true,true],[false,true,true],[true,true,true],[false,true,true],[false,true,true],[false,false,true],[false,false,true],[false,false,true]];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200"><div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between"><button onClick={() => nav("/")} className="flex items-center gap-2"><UtensilsCrossed className="w-6 h-6 text-[#109e38]" /><span className="font-bold text-lg text-slate-900">What<span className="text-[#109e38]">xpress</span></span></button><div className="flex items-center gap-3"><div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 border border-slate-200"><button onClick={() => hl('es')} className={"px-2.5 py-1.5 rounded-full text-xs font-bold transition-all "+(lang==='es'?'bg-white shadow-sm':'text-slate-400')}>ES</button><button onClick={() => hl('en')} className={"px-2.5 py-1.5 rounded-full text-xs font-bold transition-all "+(lang==='en'?'bg-white shadow-sm':'text-slate-400')}>EN</button></div><button onClick={() => nav("/login")} className="h-10 px-5 bg-[#109e38] text-white rounded-xl font-bold text-sm hover:bg-[#0d842e] transition-colors">{tr.login}</button></div></div></header>

      <section className="py-12 sm:py-20 px-4 text-center"><div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-bold text-[#109e38] mb-6"><Star className="w-3.5 h-3.5 fill-[#109e38]" /> {tr.badge}</div><h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight max-w-2xl mx-auto leading-tight">{tr.title}</h1><p className="text-slate-500 text-sm sm:text-base max-w-lg mx-auto mt-4">{tr.subtitle}</p></section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {loading ? <div className="text-center py-12"><div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-[#109e38] rounded-full mx-auto mb-3" /><p className="text-sm text-slate-400 font-medium">{tr.loading}</p></div> :
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(dbPlans.length > 0 ? dbPlans : [{id:"f1",name:"Starter",price:29,features:[],is_popular:false},{id:"f2",name:"Pro",price:99,features:[],is_popular:true}]).map((plan: any) => {
            const Icon = planIcon(plan.name||"");
            const isPro = !!plan.is_popular;
            const feats = featuresByPlan[plan.name] || featuresByPlan["default"];
            const pPrice = plan.price;
            const pPeriod = plan.interval || "mes";
            return (
            <div key={plan.id||plan.name} className={"relative rounded-3xl border shadow-sm overflow-hidden flex flex-col " + (isPro ? "bg-[#109e38] border-[#109e38] text-white" : "bg-white border-slate-200")}>
              {isPro && <div className="absolute top-0 right-0 bg-white text-[#109e38] text-[10px] font-black uppercase px-4 py-1.5 rounded-bl-2xl tracking-wider">{tr.popular}</div>}
              <div className="p-6 sm:p-8 flex-1 flex flex-col">
                <div className={"w-12 h-12 rounded-2xl flex items-center justify-center mb-5 " + (isPro ? "bg-white/20 text-white" : "bg-green-50 text-[#109e38]")}><Icon size={24} /></div>
                <h3 className="text-lg font-black uppercase tracking-tight">{plan.name}</h3>
                <div className="mt-3 mb-2">{pPrice != null ? <div className="flex items-baseline gap-1"><span className="text-4xl font-black">${pPrice}</span><span className={"text-sm font-medium " + (isPro ? "text-green-100" : "text-slate-400")}>/{pPeriod}</span></div> : <span className="text-2xl font-black">Personalizado</span>}</div>
                <p className={"text-sm mb-6 " + (isPro ? "text-green-100" : "text-slate-500")}>{Array.isArray(plan.features) ? plan.features.slice(0,3).join(", ")+"..." : ""}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {feats.map((f, i) => (
                    <li key={i} className="flex items-start gap-3">{f.included ? <Check className={"w-4 h-4 mt-0.5 shrink-0 " + (isPro ? "text-green-200" : "text-green-500")} /> : <X className={"w-4 h-4 mt-0.5 shrink-0 " + (isPro ? "text-white/30" : "text-slate-300")} />}<span className={"text-sm font-medium " + (f.included ? (isPro ? "text-green-50" : "text-slate-700") : (isPro ? "text-white/40" : "text-slate-400"))}>{f.name}</span></li>
                  ))}
                </ul>
                <button onClick={() => nav("/login")} className={"w-full h-12 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all " + (isPro ? "bg-white text-[#109e38] hover:bg-green-50" : "bg-slate-900 text-white hover:bg-slate-800")}>{isPro ? tr.ctaTrial : tr.ctaStart} <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
            );
          })}
        </div>}
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16"><h2 className="text-2xl font-black text-slate-900 text-center mb-8">{tr.compare.title}</h2><div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-100"><th className="text-left p-4 font-black text-slate-400 uppercase text-xs tracking-wider">{tr.compare.feature}</th><th className="text-center p-4 font-black text-slate-400 uppercase text-xs tracking-wider">{tr.compare.starter}</th><th className="text-center p-4 font-black text-[#109e38] uppercase text-xs tracking-wider bg-green-50/50">{tr.compare.pro}</th><th className="text-center p-4 font-black text-slate-400 uppercase text-xs tracking-wider">{tr.compare.enterprise}</th></tr></thead><tbody className="divide-y divide-slate-50">{tr.table.map((row: string, i: number) => <tr key={i} className="hover:bg-slate-50"><td className="p-4 font-medium text-slate-700">{row}</td>{[1,2,3].map(col => <td key={col} className={"text-center p-4 "+(col===2?"bg-green-50/30":"")}>{checkMatrix[i]&&checkMatrix[i][col-1]?<Check className="w-5 h-5 text-green-500 mx-auto" />:<X className="w-5 h-5 text-slate-300 mx-auto" />}</td>)}</tr>)}</tbody></table></div></div></section>

      <section className="max-w-2xl mx-auto px-4 sm:px-6 pb-20"><h2 className="text-2xl font-black text-slate-900 text-center mb-8">FAQ</h2><div className="space-y-3">{tr.faq.map((faq: any, i: number) => <details key={i} className="group bg-white rounded-2xl border border-slate-200 shadow-sm"><summary className="p-5 font-bold text-slate-900 cursor-pointer list-none flex items-center justify-between">{faq.q}<span className="text-slate-400 group-open:rotate-45 transition-transform text-lg ml-4">+</span></summary><p className="px-5 pb-5 text-sm text-slate-500">{faq.a}</p></details>)}</div></section>

      <section className="bg-[#109e38] py-16 px-4 text-center text-white"><h2 className="text-2xl sm:text-3xl font-black mb-3">{tr.cta.title}</h2><p className="text-green-100 mb-6 max-w-md mx-auto text-sm">{tr.cta.desc}</p><button onClick={() => nav("/login")} className="inline-flex items-center gap-2 h-14 px-8 bg-white text-[#109e38] rounded-2xl font-black text-sm hover:bg-green-50 transition-all shadow-lg">{tr.cta.btn} <ArrowRight className="w-4 h-4" /></button></section>

      <footer className="bg-white border-t border-slate-200 py-8 px-4 text-center"><p className="text-xs text-slate-400">WhatXpress &mdash; {tr.footer} | {new Date().getFullYear()}</p></footer>
    </div>
  );
}
