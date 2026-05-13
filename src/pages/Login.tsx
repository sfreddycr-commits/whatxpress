import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UtensilsCrossed, Mail, Lock, ArrowRight, Bot, Eye, EyeOff, Globe, Bike, Phone, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import { t, getLang, setLang, Language } from "../lib/i18n";

const text: Record<Language, any> = {
  es: {
    welcome: "Bienvenido de nuevo",
    subtitle: "Ingresa a tu panel de control",
    email: "Correo Electronico",
    emailPlaceholder: "tu@restaurante.com",
    password: "Contrasena",
    forgot: "Olvidaste tu contrasena?",
    login: "Iniciar Sesion",
    noAccount: "No tienes cuenta?",
    start: "Comenzar prueba gratis",
    errorEmpty: "Ingresa tu correo y contrasena.",
    errorAuth: "Credenciales invalidas. Verifica e intenta de nuevo.",
    errorGeneral: "Error de conexion. Intenta de nuevo.",
    backToLanding: "Volver al inicio"
  },
  en: {
    welcome: "Welcome back",
    subtitle: "Sign in to your dashboard",
    email: "Email",
    emailPlaceholder: "you@restaurant.com",
    password: "Password",
    forgot: "Forgot your password?",
    login: "Sign In",
    noAccount: "Don't have an account?",
    start: "Start free trial",
    errorEmpty: "Please enter your email and password.",
    errorAuth: "Invalid credentials. Check and try again.",
    errorGeneral: "Connection error. Please try again.",
    backToLanding: "Back to home"
  }
};

export default function Login() {
  const [lang, setLangState] = useState<Language>(getLang());
  const tr = text[lang] || text.es;
  const handleSetLang = (l: Language) => { setLang(l); setLangState(l); };

  const [identifier, setIdentifier] = useState("");
  const [credential, setCredential] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUnifiedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier || !credential) { setError("Por favor ingresa tus credenciales."); return; }
    setLoading(true);

    try {
      // Intent 1: Intentar como Restaurante / Administrador
      const resRest = await fetch("/api/auth/login", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ email: identifier.trim(), password: credential }) 
      });

      if (resRest.ok) {
        const data = await resRest.json();
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.user.role);
        localStorage.setItem("tenantId", data.user.tenant_id || "");
        
        if (data.user.role?.toLowerCase() === "super_admin") {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
        return;
      }

      // Intent 2: Si falla el anterior, intentar como Repartidor
      const resDriver = await fetch("/api/auth/driver-login", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ phone: identifier.trim(), pin: credential }) 
      });

      if (resDriver.ok) {
        const data = await resDriver.json();
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", "driver");
        localStorage.setItem("driverId", data.driver.id);
        localStorage.setItem("driverName", data.driver.name);
        localStorage.setItem("tenantId", data.driver.tenant_id);
        navigate("/driver");
        return;
      }

      // Si ambos fallaron
      setError("Credenciales incorrectas. No encontramos tu usuario.");
    } catch (err) { 
      setError("Ocurrió un problema al conectar con el servidor."); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex flex-col">
      <header className="h-16 flex items-center px-4 sm:px-6 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2">
          <UtensilsCrossed className="w-6 h-6 text-[#109e38]" />
          <span className="font-extrabold text-lg tracking-tight">What<span className="text-[#109e38]">Xpress</span></span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5 border border-slate-200">
            <button onClick={() => handleSetLang("es")} className={"px-2.5 py-1.5 rounded-full text-xs font-bold transition-all " + (lang==="es"?"bg-white shadow-sm":"text-slate-400")}>ES</button>
            <button onClick={() => handleSetLang("en")} className={"px-2.5 py-1.5 rounded-full text-xs font-bold transition-all " + (lang==="en"?"bg-white shadow-sm":"text-slate-400")}>EN</button>
          </div>
          <Link to="/" className="text-sm font-medium text-slate-400 hover:text-slate-600 ml-2">{tr.backToLanding}</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_#109e380a,_transparent_70%)] pointer-events-none" />
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/50 p-6 sm:p-10 relative">
            
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-green-50 text-[#109e38]">
                <Globe size={28} />
              </div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Acceso Universal</h1>
              <p className="text-sm text-slate-500 mt-1">Ingresa tus datos para acceder a tu panel.</p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold text-center">
                {error}
              </motion.div>
            )}

            <form onSubmit={handleUnifiedLogin} className="space-y-5 mb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Email o Teléfono</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="tu@correo.com / 88888888" 
                    value={identifier} 
                    onChange={(e) => setIdentifier(e.target.value)} 
                    className="block w-full pl-11 pr-4 h-12 border-2 border-slate-100 rounded-xl text-sm bg-slate-50 placeholder:text-slate-400 focus:bg-white focus:border-[#109e38] outline-none transition-all font-semibold" 
                    required 
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Contraseña o PIN</label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={credential} 
                    onChange={(e) => setCredential(e.target.value)} 
                    className="block w-full pl-11 pr-12 h-12 border-2 border-slate-100 rounded-xl text-sm bg-slate-50 placeholder:text-slate-400 focus:bg-white focus:border-[#109e38] outline-none transition-all font-semibold" 
                    required 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-[#109e38]/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? "Autenticando..." : "Ingresar Ahora"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="text-center border-t border-slate-100 pt-6">
              <p className="text-sm text-slate-400">{tr.noAccount} <Link to="/" onClick={() => { const e = document.createElement("a"); e.href = "https://whatxpress.com"; e.click(); }} className="font-bold text-[#109e38] hover:underline">{tr.start}</Link></p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}