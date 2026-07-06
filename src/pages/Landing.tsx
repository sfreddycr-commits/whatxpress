import React, { useState, useEffect } from 'react';
import { Bot, UtensilsCrossed, ArrowRight, MessageSquare, Smartphone, CheckCircle, ChefHat, PlayCircle, BarChart3, Users, Menu, X as CloseIcon, Loader2, Bike, QrCode, Sparkles, Percent, CreditCard, Bell, Shield, Globe, TrendingUp, Star, Clock, Zap, Store } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { t, getLang, setLang, Language } from "../lib/i18n";

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 p-6 animate-pulse">
      <div className="h-5 bg-slate-200 rounded w-20 mb-3" />
      <div className="h-8 bg-slate-200 rounded w-16 mb-2" />
      <div className="h-3 bg-slate-200 rounded w-32 mb-4" />
      <div className="space-y-2 mb-6">
        <div className="h-3 bg-slate-100 rounded w-28" />
        <div className="h-3 bg-slate-100 rounded w-28" />
        <div className="h-3 bg-slate-100 rounded w-28" />
      </div>
      <div className="h-10 bg-slate-200 rounded w-full" />
    </div>
  );
}


export default function Landing() {
  const [lang, setLangState] = useState<Language>(getLang());
  const tr = t(lang);

  const handleSetLang = (l: Language) => {
    setLang(l);
    setLangState(l);
  };

  const [email, setEmail] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', password: '', phone: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/public/plans")
      .then(res => res.json())
      .then(data => { setDbPlans(data || []); setPlansLoading(false); })
      .catch(() => setPlansLoading(false));
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerifyingPhone) {
      if (!regForm.phone) { alert(tr.modal.errorPhone); return; }
      setIsVerifyingPhone(true);
      return;
    }
    if (verificationCode !== '1234') { alert(tr.modal.errorCode); return; }
    setIsRegistering(true);
    try {
      const res = await fetch('/api/public/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, ...regForm }) });
      const data = await res.json();
      if (data.success) { localStorage.setItem("tenantId", data.tenantId); localStorage.setItem("role", "tenant"); window.location.href = '/dashboard'; }
      else { alert(tr.modal.errorReg + ": " + (data.error || "Desconocido")); }
    } catch (err) { console.error(err); alert(tr.modal.errorReg); }
    finally { setIsRegistering(false); }
  };

  const iconMap: Record<string, React.ElementType> = {
    bot: Bot, store: Store, chef: ChefHat, qr: QrCode, bike: Bike, users: Users,
    percent: Percent, star: Star, chart: BarChart3, card: CreditCard, globe: Globe, bell: Bell
  };
  const featureIcons = [Bot, Store, ChefHat, QrCode, Bike, Users, Percent, Star, BarChart3, CreditCard, Globe, Bell];
  const trustIcons = [Shield, Clock, Zap, TrendingUp];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#109e38] flex items-center justify-center text-white shadow-lg shadow-[#109e38]/20"><UtensilsCrossed size={18} /></div>
            <span className="font-extrabold text-xl tracking-tight">What<span className="text-[#109e38]">xpress</span></span>
          </div>
          <div className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">{tr.nav.features}</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">{tr.nav.how}</a>
            <a href="/pricing" className="hover:text-[#109e38] transition-colors">{tr.nav.pricing}</a>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-full p-0.5 border border-slate-200">
              <button onClick={() => handleSetLang('es')} className={"px-2.5 py-1.5 rounded-full text-xs font-bold transition-all " + (lang === 'es' ? 'bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600')}>ES</button>
              <button onClick={() => handleSetLang('en')} className={"px-2.5 py-1.5 rounded-full text-xs font-bold transition-all " + (lang === 'en' ? 'bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600')}>EN</button>
            </div>
            <a href="/login" className="text-sm font-bold text-slate-600 hover:text-slate-900 hidden sm:block">{tr.nav.login}</a>
            <button onClick={() => setShowRegisterModal(true)} className="h-10 px-5 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl font-bold text-sm transition-colors shadow-sm">{tr.nav.start}</button>
            <button className="lg:hidden p-2 text-slate-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? <CloseIcon size={20} /> : <Menu size={20} />}</button>
          </div>
        </div>
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="lg:hidden bg-white border-b border-slate-100 overflow-hidden">
              <div className="flex flex-col p-5 space-y-3 font-semibold text-slate-600">
                <a href="#features" onClick={() => setIsMenuOpen(false)} className="py-2">{tr.nav.features}</a>
                <a href="#how-it-works" onClick={() => setIsMenuOpen(false)} className="py-2">{tr.nav.how}</a>
                <a href="/pricing" onClick={() => setIsMenuOpen(false)} className="py-2 text-[#109e38]">{tr.nav.pricing}</a>
                <a href="/login" onClick={() => setIsMenuOpen(false)} className="py-2 text-[#109e38] font-bold">Iniciar sesión</a>
                <div className="flex gap-2 pt-2"><button onClick={() => { handleSetLang('es'); setIsMenuOpen(false); }} className={"px-3 py-1 rounded-lg text-xs font-bold " + (lang==='es'?'bg-slate-100':'')}>ES</button><button onClick={() => { handleSetLang('en'); setIsMenuOpen(false); }} className={"px-3 py-1 rounded-lg text-xs font-bold " + (lang==='en'?'bg-slate-100':'')}>EN</button></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO */}
      <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(16,158,56,0.08),transparent)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#109e38]/10 text-[#109e38] font-bold text-xs sm:text-sm mb-6 border border-[#109e38]/20">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#109e38] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#109e38]" /></span>
              {tr.hero.badge}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.08] mb-5">
              {tr.hero.line1}<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#109e38] to-[#2ccb5a]">{tr.hero.highlight}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-base sm:text-lg text-slate-500 max-w-xl mx-auto mb-8 leading-relaxed">{tr.hero.desc}</motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="relative w-full sm:w-72"><input type="email" placeholder={tr.hero.email} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-12 px-5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#109e38]/20 focus:border-[#109e38]" /></div>
              <button onClick={() => setShowRegisterModal(true)} className="h-12 px-8 w-full sm:w-auto bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl font-bold text-sm shadow-lg shadow-[#109e38]/20 flex items-center justify-center gap-2 transition-all">{tr.hero.cta} <ArrowRight className="w-4 h-4" /></button>
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-xs text-slate-400 mt-4">{tr.hero.trialNote}</motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto mt-12 pt-8 border-t border-slate-100">
              {tr.hero.stats.map((s: any, i: number) => (<div key={i} className="text-center"><div className="text-xl sm:text-2xl font-black text-slate-900">{s.value}</div><div className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</div></div>))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 sm:py-28 bg-white" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight">{tr.features.title}</h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto">{tr.features.subtitle}</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {tr.features.items.map((f: any, i: number) => {
              const FC = featureIcons[i];
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="group bg-slate-50 hover:bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-green-600 bg-green-50"><FC size={20} /></div>
                  <h3 className="font-bold text-slate-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 sm:py-28 bg-slate-50" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight">{tr.how.title}</h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto">{tr.how.subtitle}</p>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {tr.how.steps.map((s: any, i: number) => {
              const SI = [Globe, MessageSquare, TrendingUp][i];
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#109e38] mx-auto mb-5"><SI size={28} /></div>
                  <div className="text-xs font-black text-slate-300 mb-2">{s.step}</div>
                  <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-500">{s.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* POWER SECTION */}
      <section className="py-20 sm:py-28 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,158,56,0.2),transparent_60%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-green-300 font-bold text-xs border border-white/10 mb-6"><Zap size={14} /> {tr.power.badge}</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-6 tracking-tight leading-tight">{tr.power.titleLine1}<br/><span className="text-[#2ccb5a]">{tr.power.titleHighlight}</span></h2>
              <ul className="space-y-4 mb-8">
                {tr.power.bullets.map((item: string, i: number) => (<li key={i} className="flex items-start gap-3 text-slate-300 text-sm"><CheckCircle className="w-4 h-4 text-[#2ccb5a] mt-0.5 shrink-0" />{item}</li>))}
              </ul>
              <button onClick={() => setShowRegisterModal(true)} className="h-12 px-8 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl font-bold text-sm shadow-lg inline-flex items-center gap-2 transition-all">{tr.power.cta} <ArrowRight className="w-4 h-4" /></button>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-slate-800 rounded-3xl border border-slate-700 p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                <div className="w-8 h-8 rounded-full bg-[#109e38] flex items-center justify-center"><Bot size={14} className="text-white" /></div>
                <div><div className="text-sm font-bold">WhatXpress IA</div><div className="text-[10px] text-green-400">{lang==='es'?'en linea':'online'}</div></div>
              </div>
              <div className="space-y-3">
                {tr.power.chat.map((m: any, i: number) => (
                  <div key={i} className={"p-3 rounded-2xl text-sm max-w-[85%] " + (m.from === "bot" ? "bg-[#109e38]/20 text-green-100 ml-auto rounded-br-sm" : "bg-slate-700 text-slate-200 rounded-bl-sm")}>{m.text}</div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight">{tr.pricing.title}</h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto mb-12">{tr.pricing.subtitle}</p>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto mb-10">
            {plansLoading ? [1,2,3].map(i => <SkeletonCard key={i} />) : (
              
              (dbPlans.length > 0 ? dbPlans : [{ id:"f1", name:"Starter", price:29, features:[], is_popular:false }, { id:"f2", name:"Professional", price:99, features:[], is_popular:true }]).map((p: any, i: number) => {
                const isPopular = !!p.is_popular;
                const priceDisplay = p.price ? "$" + p.price : "Custom";
                const features = Array.isArray(p.features) ? p.features : [];
                return (
              <motion.div key={p.id||i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className={"relative rounded-2xl border p-6 text-left " + (isPopular ? "bg-[#109e38] border-[#109e38] text-white shadow-xl shadow-[#109e38]/20" : "bg-white border-slate-200")}>
                {isPopular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-[#109e38] text-[10px] font-black rounded-full uppercase tracking-wider">{tr.pricing.popular}</div>}
                <h3 className="font-black text-lg mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-1"><span className="text-3xl font-black">{priceDisplay}</span>{p.price && <span className={"text-sm font-medium " + (isPopular ? "text-green-100" : "text-slate-400")}>/{p.interval || "mes"}</span>}</div>
                <p className={"text-xs mb-4 " + (isPopular ? "text-green-100" : "text-slate-500")}>{features.slice(0,3).join(", ")}...</p>
                <ul className="space-y-2 mb-6">{features.map((f: string, j: number) => (<li key={j} className="flex items-center gap-2 text-xs"><CheckCircle className="w-3.5 h-3.5 shrink-0" />{f}</li>))}</ul>
                <button onClick={() => setShowRegisterModal(true)} className={"w-full h-10 rounded-xl font-bold text-sm transition-all " + (isPopular ? "bg-white text-[#109e38] hover:bg-green-50" : "bg-slate-900 text-white hover:bg-slate-800")}>{isPopular ? tr.pricing.cta.popular : tr.pricing.cta.normal}</button>
              </motion.div>
              )})
            )}
          </div>
          <Link to="/pricing" className="text-[#109e38] font-bold text-sm hover:underline inline-flex items-center gap-1">{tr.pricing.compare} <ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
      </section>

      {/* TRUST */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {tr.trust.items.map((t: any, i: number) => {
              const TI = trustIcons[i];
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center p-6">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#109e38] mx-auto mb-4"><TI size={22} /></div>
                  <h3 className="font-bold text-slate-900 mb-2">{t.title}</h3>
                  <p className="text-sm text-slate-500">{t.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-[#109e38] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.2),transparent_60%)]" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 tracking-tight">{tr.cta.title}</h2>
            <p className="text-green-100 text-base sm:text-lg max-w-lg mx-auto mb-8">{tr.cta.desc}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => setShowRegisterModal(true)} className="h-14 px-10 bg-white text-[#109e38] rounded-2xl font-bold text-base shadow-xl hover:bg-green-50 transition-all w-full sm:w-auto flex items-center justify-center gap-2">{tr.cta.primary} <ArrowRight className="w-4 h-4" /></button>
              <Link to="/pricing" className="h-14 px-8 border-2 border-white/30 text-white rounded-2xl font-bold text-base hover:bg-white/10 transition-all w-full sm:w-auto flex items-center justify-center">{tr.cta.secondary}</Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2"><UtensilsCrossed size={18} className="text-[#109e38]" /><span className="font-bold text-white">What<span className="text-[#109e38]">xpress</span></span></div>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/pricing" className="hover:text-white transition-colors">{tr.footer.pricing}</Link>
              <a href="/login" className="hover:text-white transition-colors">{tr.footer.login}</a>
              <a href="mailto:hola@whatxpress.com" className="hover:text-white transition-colors">{tr.footer.contact}</a>
            </div>
            <p className="text-xs">&copy; 2026 {tr.footer.copy}</p>
          </div>
        </div>
      </footer>

      {/* REGISTRATION MODAL */}
      <AnimatePresence>
        {showRegisterModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowRegisterModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl p-6 sm:p-10 w-full max-w-md relative z-10 shadow-2xl">
              <div className="mb-6"><div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-[#109e38] mb-4"><ChefHat size={24} /></div><h3 className="text-2xl font-black text-slate-900 mb-1">{tr.modal.title}</h3><p className="text-sm text-slate-500">{tr.modal.subtitle}</p></div>
              <form className="space-y-4" onSubmit={handleRegister}>
                {!isVerifyingPhone ? (<>
                  <div><label className="text-xs font-bold text-slate-400 uppercase">{tr.modal.nameLabel}</label><input required placeholder={tr.modal.namePlaceholder} value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm mt-1.5 focus:outline-none focus:border-[#109e38]" /></div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase">{tr.modal.phoneLabel}</label><input required type="tel" placeholder={tr.modal.phonePlaceholder} value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm mt-1.5 focus:outline-none focus:border-[#109e38]" /></div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase">{tr.modal.emailLabel}</label><input required type="email" placeholder={tr.modal.emailPlaceholder} value={email} onChange={e => setEmail(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm mt-1.5 focus:outline-none focus:border-[#109e38]" /></div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase">{tr.modal.passLabel}</label><input required type="password" placeholder={tr.modal.passPlaceholder} value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm mt-1.5 focus:outline-none focus:border-[#109e38]" /></div>
                </>) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-2xl text-green-800 text-sm border border-green-100">{tr.modal.codeSent} <b>{regForm.phone}</b>. ({tr.modal.codeTest})</div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase">{tr.modal.codeLabel}</label><input required placeholder="----" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} maxLength={4} className="w-full h-14 px-4 rounded-xl border border-slate-200 bg-slate-50 text-2xl tracking-[0.5em] text-center font-bold mt-1.5 focus:outline-none focus:border-[#109e38]" /></div>
                  </div>
                )}
                <button disabled={isRegistering} className="w-full h-14 rounded-2xl bg-[#109e38] hover:bg-[#0d842e] text-white font-black text-base shadow-lg shadow-[#109e38]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70">{isRegistering ? <Loader2 className="animate-spin" size={20} /> : (isVerifyingPhone ? tr.modal.verify : tr.modal.submit)}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
