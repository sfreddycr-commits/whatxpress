import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Store, 
  Activity, 
  CheckSquare, 
  Settings, 
  Search, 
  Bell, 
  Plus, 
  MoreVertical, 
  Check, 
  X, 
  TrendingUp,
  DollarSign,
  Users,
  Bot,
  UtensilsCrossed,
  Menu,
  Loader2,
  LogOut,
  Key,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Trash2,
  Info,
  CreditCard,
  Megaphone,
  Clock,
  MessageSquare,
  Cpu,
  Layers,
  Sparkles,
  ChevronRight,
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { WhatsAppConnector } from "../components/WhatsAppConnector";

const arrData = [
  { name: 'Jan', arr: 4000 },
  { name: 'Feb', arr: 5000 },
  { name: 'Mar', arr: 6000 },
  { name: 'Apr', arr: 8500 },
  { name: 'May', arr: 11000 },
  { name: 'Jun', arr: 18000 },
];

const dataAI = [
  { name: 'Mon', requests: 1200 },
  { name: 'Tue', requests: 1900 },
  { name: 'Wed', requests: 3000 },
  { name: 'Thu', requests: 4500 },
  { name: 'Fri', requests: 6000 },
  { name: 'Sat', requests: 6200 },
  { name: 'Sun', requests: 6500 },
];

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalData, setGlobalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apiPool, setApiPool] = useState<any[]>([]);
  const [newKey, setNewKey] = useState("");
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [testingSandbox, setTestingSandbox] = useState(false);
  const [testingLive, setTestingLive] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [liveResult, setLiveResult] = useState<any>(null);
  // New Dynamic AI Providers and Models state
  const [providers, setProviders] = useState<any[]>([]);
  const [activeProvider, setActiveProvider] = useState<any>(null);
  const [models, setModels] = useState<any[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isAddProviderOpen, setIsAddProviderOpen] = useState(false);
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);

  const [newProvider, setNewProvider] = useState({
    id: "",
    display_name: "",
    api_base_url: "",
    api_key: ""
  });

  const [newModel, setNewModel] = useState({
    model_id: "",
    name: "",
    description: "",
    max_output_tokens: "",
    context_window: ""
  });

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [simulatorLogs, setSimulatorLogs] = useState<any[]>([]);
  const [simulatorMessage, setSimulatorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const t = getToken();
    const headers: any = { 'Content-Type': 'application/json' };
    if (t) headers['Authorization'] = `Bearer ${t}`;

    Promise.all([
      fetch('/api/tenants', { headers }).then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/api-pool', { headers }).then(r => r.json()).catch(() => []),
      fetch('/api/admin/providers', { headers }).then(r => r.json()).catch(() => [])
    ]).then(([overview, pool, providersData]) => {
      setGlobalData(overview);
      setApiPool(Array.isArray(pool) ? pool : []);
      const provs = Array.isArray(providersData) ? providersData : [];
      setProviders(provs);
      if (provs.length > 0) {
        setActiveProvider(provs[0]);
      }
    }).catch(err => console.error("Error loading admin data:", err))
    .finally(() => setLoading(false));
  }, []);

  const refreshPool = () => {
    fetch('/api/admin/api-pool', {
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    })
      .then(res => res.json())
      .then(data => setApiPool(data));
  };

  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const headers = getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {};
      const res = await fetch('/api/admin/providers', { headers });
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
        if (data.length > 0) {
          if (!activeProvider) {
            setActiveProvider(data[0]);
          } else {
            const updatedActive = data.find((p: any) => p.id === activeProvider.id);
            if (updatedActive) {
              setActiveProvider(updatedActive);
            } else {
              setActiveProvider(data[0]);
            }
          }
        } else {
          setActiveProvider(null);
        }
      }
    } catch (e) {
      console.error("Error fetching providers:", e);
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    if (activeProvider) {
      setLoadingModels(true);
      fetch(`/api/admin/providers/${activeProvider.id}/models`, {
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
      })
        .then(res => res.json())
        .then(data => setModels(Array.isArray(data) ? data : []))
        .catch(err => console.error("Error loading models:", err))
        .finally(() => setLoadingModels(false));
    } else {
      setModels([]);
    }
  }, [activeProvider]);

  const handleToggleProviderActive = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}/toggle-active`, {
        method: "PATCH",
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
      });
      if (res.ok) {
        await fetchProviders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleModelActive = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/models/${id}/toggle-active`, {
        method: "PATCH",
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
      });
      if (res.ok && activeProvider) {
        const modelRes = await fetch(`/api/admin/providers/${activeProvider.id}/models`, {
          headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
        });
        const mData = await modelRes.json();
        setModels(Array.isArray(mData) ? mData : []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddProvider = async () => {
    if (!newProvider.id || !newProvider.display_name || !newProvider.api_base_url) return;
    try {
      const res = await fetch('/api/admin/providers', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() && { 'Authorization': `Bearer ${getToken()}` })
        },
        body: JSON.stringify(newProvider)
      });
      if (res.ok) {
        setNewProvider({ id: "", display_name: "", api_base_url: "", api_key: "" });
        setIsAddProviderOpen(false);
        await fetchProviders();
      } else {
        const error = await res.json();
        alert(error.error || "Error registering provider");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este proveedor y todos sus modelos?")) return;
    try {
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: "DELETE",
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
      });
      if (res.ok) {
        if (activeProvider && activeProvider.id === id) {
          setActiveProvider(null);
        }
        await fetchProviders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddModel = async () => {
    if (!activeProvider || !newModel.model_id || !newModel.name) return;
    try {
      const res = await fetch(`/api/admin/providers/${activeProvider.id}/models`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() && { 'Authorization': `Bearer ${getToken()}` })
        },
        body: JSON.stringify(newModel)
      });
      if (res.ok) {
        setNewModel({ model_id: "", name: "", description: "", max_output_tokens: "", context_window: "" });
        setIsAddModelOpen(false);
        const modelRes = await fetch(`/api/admin/providers/${activeProvider.id}/models`, {
          headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
        });
        const mData = await modelRes.json();
        setModels(Array.isArray(mData) ? mData : []);
      } else {
        const error = await res.json();
        alert(error.error || "Error adding model");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este modelo?")) return;
    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: "DELETE",
        headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
      });
      if (res.ok && activeProvider) {
        const modelRes = await fetch(`/api/admin/providers/${activeProvider.id}/models`, {
          headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
        });
        const mData = await modelRes.json();
        setModels(Array.isArray(mData) ? mData : []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddKey = async () => {
    if (!newKey.trim()) return;
    setIsAddingKey(true);
    try {
      const res = await fetch('/api/admin/api-pool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() && { 'Authorization': `Bearer ${getToken()}` })
        },
        body: JSON.stringify({ keyValue: newKey })
      });
      if (res.ok) {
        setNewKey("");
        refreshPool();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingKey(false);
    }
  };

  const handleDeleteKey = async (id: number) => {
    if (!confirm("Remove this API key?")) return;
    await fetch(`/api/admin/api-pool/${id}`, {
      method: 'DELETE',
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    refreshPool();
  };

  const handleResetKey = async (id: number) => {
    await fetch(`/api/admin/api-pool/${id}/reset`, {
      method: 'PATCH',
      headers: getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}
    });
    refreshPool();
  };

  const [savingSettings, setSavingSettings] = useState(false);
  const handleSaveSettings = async () => {
    if (!globalData || !globalData.settings) return;
    setSavingSettings(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grace_period_days: globalData.settings.grace_period_days,
          annual_discount_percent: globalData.settings.annual_discount_percent
        })
      });
      alert('Configuración guardada exitosamente');
    } catch (e) {
      console.error(e);
      alert('Error guardando configuración');
    } finally {
      setSavingSettings(false);
    }
  };

  const [savingPaypal, setSavingPaypal] = useState(false);
  const handleSavePaypal = async () => {
    const paypalConfig = globalData?.paymentGateways?.find((gw: any) => gw.id === 'gw_paypal');
    if (!paypalConfig) {
      alert('No se encontro configuracion de PayPal. Intenta recargar la pagina.');
      return;
    }
    console.log('[PAYPAL DEBUG] Saving:', JSON.stringify(paypalConfig));

    setSavingPaypal(true);
    try {
      const res = await fetch('/api/admin/payment-gateways', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() && { 'Authorization': `Bearer ${getToken()}` })
        },
        body: JSON.stringify(paypalConfig)
      });
      const data = await res.json();
      console.log('[PAYPAL DEBUG] Response:', JSON.stringify(data));
      if (!res.ok) {
        const err = await res.json();
        alert('Error: ' + (err.error || 'No se pudieron guardar las credenciales'));
        setSavingPaypal(false);
        return;
      }
      alert('Credenciales de PayPal guardadas exitosamente');
      alert('Credenciales de PayPal guardadas exitosamente');
    } catch (e) {
      console.error(e);
      alert('Error guardando credenciales de PayPal');
    } finally {
      setSavingPaypal(false);
    }
  };

  const handleSimulatorSend = async () => {
    if (!simulatorMessage.trim()) return;
    
    const userMsg = simulatorMessage;
    setSimulatorMessage("");
    setSimulatorLogs(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const res = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      setSimulatorLogs(prev => [...prev, { role: 'assistant', content: data.reply }]);
      // Refresh dashboard info after interacting
      refreshTenants();
      refreshPool();
    } catch (e) {
      console.error(e);
      setSimulatorLogs(prev => [...prev, { role: 'assistant', content: "Lo siento, hubo un error al procesar tu solicitud." }]);
    }
  };

  const handleLogout = () => {
    navigate("/login");
  };

  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newTenantForm, setNewTenantForm] = useState({ name: '', plan: 'Starter' });
  
  const refreshTenants = () => {
    const t = getToken();
    const headers: any = {};
    if (t) headers['Authorization'] = `Bearer ${t}`;
    fetch('/api/tenants', { headers })
      .then(res => res.json())
      .then(data => setGlobalData((prev: any) => ({ ...prev, tenants: data.tenants, metrics: data.metrics })));
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantForm.name) return;
    
    try {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7);

      await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `tenant_${Date.now()}`,
          name: newTenantForm.name,
          status: 'Active',
          plan: newTenantForm.plan,
          mrr: newTenantForm.plan === 'Starter' ? 29 : 99,
          bg_color: 'bg-blue-100 text-blue-600',
          init_letters: newTenantForm.name.substring(0, 2).toUpperCase(),
          trial_ends_at: trialEndDate.toISOString(),
          subscription_status: 'trialing',
          password: 'password123'
        })
      });
      setShowAddTenant(false);
      setNewTenantForm({ name: '', plan: 'Starter' });
      refreshTenants();
    } catch (e) {
      console.error(e);
      alert('Error creating tenant');
    }
  };

  const handleToggleTenantStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      await fetch(`/api/admin/tenants/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      refreshTenants();
    } catch (e) {
      console.error(e);
      alert('Error updating status');
    }
  };

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({ id: '', name: '', price: 0, interval: 'mo', max_orders: 1000, features: [''], is_popular: 0 });

  const handleCreateOrEditPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planForm,
          id: planForm.id || `plan_${Date.now()}`
        })
      });
      setShowPlanModal(false);
      refreshTenants(); // Re-fetch to get new plans
    } catch (e) {
      console.error(e);
      alert('Error guardando el plan');
    }
  };

  const openNewPlanModal = () => {
    setPlanForm({ id: '', name: '', price: 0, interval: 'mo', max_orders: 1000, features: ['Funcionalidad 1'], is_popular: 0 });
    setShowPlanModal(true);
  };

  const openEditPlanModal = (plan: any) => {
    setPlanForm({ 
      ...plan, 
      features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features 
    });
    setShowPlanModal(true);
  };

  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowForm, setFlowForm] = useState({ id: '', title: '', type: 'Email', status: 'Activo', color: 'slate', description: '' });

  const handleCreateOrEditFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/admin/communication-flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...flowForm,
          id: flowForm.id || `flow_${Date.now()}`
        })
      });
      setShowFlowModal(false);
      refreshTenants(); // Recarga la data global
    } catch (e) {
      console.error(e);
      alert('Error guardando el flujo');
    }
  };

  const handleDeleteFlow = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este flujo?')) return;
    try {
      await fetch(`/api/admin/communication-flows/${id}`, { method: 'DELETE' });
      refreshTenants();
    } catch (e) {
      console.error(e);
    }
  };

  const openNewFlowModal = () => {
    setFlowForm({ id: '', title: '', type: 'Email', status: 'Activo', color: 'slate', description: '' });
    setShowFlowModal(true);
  };

  const openEditFlowModal = (flow: any) => {
    setFlowForm(flow);
    setShowFlowModal(true);
  };

  const menuItems: any[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "tenants", label: "Tenants", icon: Store },
    { id: "api-pool", label: "Gestión APIs", icon: Key },
    { id: "billing", label: "Facturación y Planes", icon: CreditCard },
    { id: "payments", label: "Pasarela de Pagos", icon: DollarSign },
    { id: "communications", label: "Mensajería Auto", icon: Megaphone },
    { id: "whatsapp", label: "WhatsApp Sistema", icon: MessageSquare },
    { id: "agent", label: "Agente Asistente", icon: Bot },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <Link to="/" className="flex items-center gap-2">
          <UtensilsCrossed className="w-6 h-6 text-[#109e38]" />
          <div>
            <div className="font-bold text-lg tracking-tight text-slate-900 leading-none">What<span className="text-[#109e38]">xpress</span></div>
            <div className="text-[10px] uppercase font-bold text-slate-400 mt-1 tracking-wider">Super Admin</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {menuItems.map((item) => (
          <a
            key={item.id}
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab(item.id); setIsSidebarOpen(false); }}
            className={`flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
              activeTab === item.id 
                ? "bg-[#109e38] text-white shadow-md shadow-[#109e38]/20" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5" />
              {item.label}
            </div>
            {item.badge && (
              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeTab === item.id ? "bg-white text-[#109e38]" : "bg-red-500 text-white"
              }`}>
                {item.badge}
              </div>
            )}
          </a>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-2">
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-600">
           <LogOut className="w-4 h-4" /> Logout
        </button>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-slate-100">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
             <img src="https://i.pravatar.cc/150?img=11" alt="Admin" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">System Admin</div>
            <div className="text-xs font-medium text-slate-500 truncate">admin@whatxpress.com</div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white z-[101] shadow-2xl flex flex-col lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">Global Dashboard</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium tracking-tight truncate hidden xs:block">System metrics and tenants.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search..." className="h-10 pl-10 pr-4 rounded-full border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] w-48 xl:w-64 transition-all" />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500 border border-white"></span>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 text-[#109e38] animate-spin" />
          </div>
        ) : !globalData ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-slate-500">Failed to load system data.</p>
          </div>
        ) : (
        <div className="flex-1 p-4 sm:p-8">
          
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Metrics Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start mb-2">
                     <div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total ARR</div>
                       <div className="text-2xl font-black text-slate-900 tracking-tight">${globalData.metrics.totalARR.toLocaleString()}</div>
                     </div>
                     <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                       <DollarSign className="w-5 h-5" />
                     </div>
                   </div>
                   <div className="flex items-center text-[10px] font-semibold text-green-600 mt-2">
                     <TrendingUp className="w-3 h-3 mr-1" />
                     <span>+12.5% vs last month</span>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start mb-2">
                     <div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Tenants</div>
                       <div className="text-2xl font-black text-slate-900 tracking-tight">{globalData.metrics.activeTenants}</div>
                     </div>
                     <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                       <Store className="w-5 h-5" />
                     </div>
                   </div>
                   <div className="flex items-center text-[10px] font-semibold text-green-600 mt-2">
                     <TrendingUp className="w-3 h-3 mr-1" />
                     <span>+42 this week</span>
                   </div>
                </div>
                
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start mb-2">
                     <div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Users Reached</div>
                       <div className="text-2xl font-black text-slate-900 tracking-tight">${globalData?.metrics?.totalUsersReached?.toLocaleString() || 0}</div>
                     </div>
                     <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                       <Users className="w-5 h-5" />
                     </div>
                   </div>
                   <div className="flex items-center text-[10px] font-semibold text-green-600 mt-2">
                     <TrendingUp className="w-3 h-3 mr-1" />
                     <span>+18.2% vs last month</span>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start mb-2">
                     <div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">AI Orders</div>
                       <div className="text-2xl font-black text-slate-900 tracking-tight">{globalData.metrics.aiOrdersProcessed.toLocaleString()}</div>
                     </div>
                     <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                       <Bot className="w-5 h-5" />
                     </div>
                   </div>
                   <div className="flex items-center text-[10px] font-semibold text-green-600 mt-2">
                     <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                     <span>${globalData?.metrics?.avgAiSuccessRate?.toFixed(1) || 0}% Success Rate</span>
                   </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Revenue Growth (ARR)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={arrData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorArr" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#109e38" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#109e38" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `$${val/1000}k`} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value) => [`$${value}`, 'ARR']}
                        />
                        <Area type="monotone" dataKey="arr" stroke="#109e38" strokeWidth={3} fillOpacity={1} fill="url(#colorArr)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">AI Processing Requests</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataAI} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${val/1000}k`} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <RechartsTooltip 
                          cursor={{ fill: '#f1f5f9' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="requests" fill="#f97316" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              {/* Top Tenants and Health Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-slate-900">Top Tenants (MRR)</h2>
                      <button className="text-xs text-[#109e38] font-bold hover:underline" onClick={() => setActiveTab('tenants')}>View All</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                            <th className="px-6 py-3">Restaurant</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">MRR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {globalData.tenants.slice(0, 5).map((item: any, i: number) => {
                            const isSuspended = item.status === 'Suspended';
                            const statusCol = isSuspended ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200";
                            return (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${item.bg_color}`}>
                                    {item.init_letters}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 text-xs truncate">{item.name}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusCol}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-right text-xs font-bold text-slate-900">${item.mrr}</td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    </div>
                </div>
                
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col h-full">
                     <h3 className="text-sm font-bold text-slate-900 mb-4">Platform Health</h3>
                     <div className="space-y-3 flex-1 flex flex-col justify-center">
                       {(globalData?.platformHealth && globalData.platformHealth.length > 0 ? globalData.platformHealth : [
                         { name: "Core API", status: "Operational", sub: "99.99% Uptime", icon: "Activity", color: "green" },
                         { name: "WhatsApp Gateway", status: "Stable", sub: "12ms latency", icon: "MessageSquare", color: "green" },
                         { name: "AI Inference", status: "Operational", sub: "Normal Load", icon: "Bot", color: "green" },
                       ]).map((item: any, i: number) => (
                        <div key={i} className={`p-3 rounded-xl border flex items-center justify-between ${item.color === 'orange' ? 'border-orange-200 bg-orange-50' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center ${item.color === 'orange' ? 'bg-orange-200 text-orange-700' : 'bg-green-100 text-green-600'}`}>
                              <item.icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                              <div className="text-[10px] font-medium text-slate-500">{item.sub}</div>
                            </div>
                          </div>
                        </div>
                       ))}
                     </div>
                     <button className="w-full mt-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                       View Detailed Logs
                     </button>
                  </div>
              </div>
            </div>
          )}

          {activeTab === "tenants" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Tenants Directory</h2>
                  <p className="text-sm text-slate-500 font-medium">Manage all registered businesses and their subscriptions.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search tenants..." className="h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] w-64 transition-all" />
                  </div>
                  <button onClick={() => setShowAddTenant(true)} className="h-10 px-4 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl text-sm font-bold shadow-sm shadow-[#109e38]/20 transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add New
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          <th className="px-6 py-4">Tenant / Restaurant</th>
                          <th className="px-6 py-4">Status & Plan</th>
                          <th className="px-6 py-4">Usage (Orders)</th>
                          <th className="px-6 py-4 text-right">Revenue (MRR)</th>
                          <th className="px-6 py-4 text-center">Manage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {globalData.tenants.map((item: any, i: number) => {
                          const isSuspended = item.status === 'Suspended';
                          const statusCol = isSuspended ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200";
                          return (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${item.bg_color}`}>
                                  {item.init_letters}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 text-sm truncate">{item.name}</div>
                                  <div className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
                                    <Key className="w-3 h-3" /> {item.id}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col items-start gap-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCol}`}>
                                  {item.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>}
                                  {item.status === 'Suspended' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>}
                                  {item.status}
                                </span>
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{item.plan}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-2">
                                 <div className="w-full bg-slate-100 rounded-full h-1.5 max-w-[100px]">
                                   <div className="bg-[#109e38] h-1.5 rounded-full" style={{ width: `${item.automation_rate || 50}%`}}></div>
                                 </div>
                                 <span className="text-[10px] font-bold text-slate-500">{Math.floor(item.ai_orders_count || Math.random() * 1000 + 100)} / mo</span>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-sm font-black text-slate-900">${item.mrr}</div>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleToggleTenantStatus(item.id, item.status)} className={`p-2 rounded-lg transition-colors ${item.status === 'Active' ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-[#109e38] hover:bg-green-50'}`} title={item.status === 'Active' ? 'Suspend Tenant' : 'Activate Tenant'}>
                                    <Activity className="w-4 h-4" />
                                  </button>
                                  <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Settings">
                                    <Settings className="w-4 h-4" />
                                  </button>
                               </div>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <span className="text-[10px] sm:text-sm text-slate-500 font-medium">Showing {globalData.tenants.length} of {globalData.tenants.length}</span>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50" disabled>Previous</button>
                    <button className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50" disabled>Next</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "billing" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Facturación y Planes</h2>
                  <p className="text-sm text-slate-500 font-medium">Gestiona suscripciones, MRR, tiempos de gracia y límites.</p>
                </div>
                <button onClick={openNewPlanModal} className="h-10 px-4 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl text-sm font-bold shadow-sm shadow-[#109e38]/20 transition-all flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Crear Plan
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tiers Configuration */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900">Planes de Suscripción (Tiers)</h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {globalData?.plans?.map((plan: any) => (
                        <div key={plan.id} className={`border ${plan.is_popular ? 'border-[#109e38] bg-green-50/30' : 'border-slate-200'} rounded-xl p-4 relative`}>
                          {plan.is_popular ? <div className="absolute top-0 right-0 bg-[#109e38] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-xl">Popular</div> : null}
                          <div onClick={() => openEditPlanModal(plan)} className={`absolute ${plan.is_popular ? 'top-4 right-4 mt-4' : 'top-4 right-4'} text-slate-400 hover:text-[#109e38] cursor-pointer`}>
                            <Settings className="w-4 h-4" />
                          </div>
                          <h4 className={`font-bold ${plan.is_popular ? 'text-[#109e38]' : 'text-slate-900'}`}>{plan.name}</h4>
                          <div className="text-2xl font-black text-slate-900 mt-2">${plan.price}<span className="text-sm font-medium text-slate-500">/{plan.interval}</span></div>
                          <ul className="mt-4 space-y-2 text-xs text-slate-600">
                            {(JSON.parse(plan.features || '[]')).map((feature: string, idx: number) => (
                              <li key={idx} className="flex items-center gap-2"><Check className="w-3 h-3 text-[#109e38]" /> {feature}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Facturación y Tiempos de gracia */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-900">Control de Morosidad y Gracia</h3>
                      <button 
                        onClick={handleSaveSettings} 
                        disabled={savingSettings}
                        className="text-[#109e38] text-xs font-bold hover:underline disabled:opacity-50"
                      >
                        {savingSettings ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <div className="font-bold text-sm text-slate-900">Tiempo de Gracia por Impago</div>
                          <div className="text-xs text-slate-500 mt-1">Días antes de suspender el bot tras fallo de cobro.</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={globalData?.settings?.grace_period_days || 7} 
                            onChange={(e) => setGlobalData({...globalData, settings: {...globalData.settings, grace_period_days: parseInt(e.target.value)}})}
                            className="w-16 h-9 px-3 rounded-lg border border-slate-200 text-sm font-bold text-center" 
                          />
                          <span className="text-xs font-bold text-slate-500">días</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <div className="font-bold text-sm text-slate-900">Descuento Anual Global</div>
                          <div className="text-xs text-slate-500 mt-1">Porcentaje de descuento para planes anuales.</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={globalData?.settings?.annual_discount_percent || 20} 
                            onChange={(e) => setGlobalData({...globalData, settings: {...globalData.settings, annual_discount_percent: parseInt(e.target.value)}})}
                            className="w-16 h-9 px-3 rounded-lg border border-slate-200 text-sm font-bold text-center" 
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* We removed the pasarela block from here to put it in payments tab */}
                </div>

                {/* Resumen Invoices */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 bg-red-50/30">
                    <h3 className="text-sm font-bold text-red-900 mb-2">Facturas Fallidas</h3>
                    <div className="text-2xl font-black text-red-700">3 <span className="text-sm font-semibold">Cuentas en Gracia</span></div>
                    <button className="w-full mt-4 h-9 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 transition-colors">Gestionar Suspensión</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pasarela de Pagos (PayPal)</h2>
                  <p className="text-sm text-slate-500 font-medium">Configura tus credenciales para recibir pagos automáticos de los tenants.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-[#003087]/10 flex items-center justify-center">
                         <DollarSign className="w-4 h-4 text-[#003087]" />
                       </div>
                       <div>
                         <h3 className="text-sm font-bold text-slate-900">Credenciales PayPal REST API</h3>
                         <p className="text-[10px] text-slate-500 font-medium">Sandbox / Live Mode</p>
                       </div>
                    </div>
                    <button 
                       onClick={handleSavePaypal} 
                       disabled={savingPaypal}
                       className="text-[#109e38] text-xs font-bold hover:underline disabled:opacity-50 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 transition-colors"
                     >
                       {savingPaypal ? 'Guardando...' : 'Guardar'}
                     </button>
                  </div>
                  {(() => {
                      const gw = globalData?.paymentGateways?.find((g: any) => g.id === 'gw_paypal') || { is_sandbox: 1, is_active: 0, sandbox_client_id: '', sandbox_client_secret: '', live_client_id: '', live_client_secret: '' };
                      const setGw = (updater: any) => {
                        setGlobalData((prev: any) => ({
                          ...prev,
                          paymentGateways: prev.paymentGateways?.map((g: any) => g.id === 'gw_paypal' ? { ...g, ...updater } : g)
                        }));
                      };

                      return (
                        <div className="p-5 space-y-6">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={gw.is_active === 1}
                                onChange={(e) => setGw({ is_active: e.target.checked ? 1 : 0 })}
                                className="w-4 h-4 text-[#109e38] rounded border-slate-300 focus:ring-[#109e38]" 
                              />
                              <span className="text-sm font-bold text-slate-700">Habilitar PayPal en el sistema</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={gw.is_sandbox === 1}
                                onChange={(e) => setGw({ is_sandbox: e.target.checked ? 1 : 0 })}
                                className="w-4 h-4 text-orange-500 rounded border-slate-300 focus:ring-orange-500" 
                              />
                              <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">Modo Activo: Sandbox</span>
                            </label>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Sandbox Credentials */}
                            <div className="space-y-4 p-4 rounded-xl border border-orange-200 bg-orange-50/30">
                              <h4 className="text-sm font-bold text-orange-800">Credenciales Sandbox</h4>
                              <div>
                                <label className="block text-xs font-bold text-orange-900/70 mb-1">Sandbox Client ID</label>
                                <div className="relative">
                                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                                  <input 
                                    type="text" 
                                    value={gw.sandbox_client_id || ''}
                                    onChange={(e) => setGw({ sandbox_client_id: e.target.value })}
                                    placeholder="Ingresa tu Sandbox Client ID" 
                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-orange-200 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono bg-white" 
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-xs font-bold text-orange-900/70 mb-1">Sandbox Secret Key</label>
                                <div className="relative">
                                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                                  <input 
                                    type="password" 
                                    value={gw.sandbox_client_secret || ''}
                                    onChange={(e) => setGw({ sandbox_client_secret: e.target.value })}
                                    placeholder="Ingresa tu Sandbox Secret" 
                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-orange-200 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono bg-white" 
                                  />
                                </div>
                                <button
                                  onClick={async () => {
                                    setTestingSandbox(true);
                                    setSandboxResult(null);
                                    try {
                                      const res = await fetch('/api/admin/payment-gateways/test', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', ...(getToken() && { 'Authorization': `Bearer ${getToken()}` }) },
                                        body: JSON.stringify({ mode: 'sandbox', sandbox_client_id: gw.sandbox_client_id, sandbox_client_secret: gw.sandbox_client_secret })
                                      });
                                      const data = await res.json();
                                      setSandboxResult(data);
                                    } catch (e) {
                                      setSandboxResult({ success: false, error: String(e) });
                                    } finally {
                                      setTestingSandbox(false);
                                    }
                                  }}
                                  disabled={testingSandbox || !gw.sandbox_client_id || !gw.sandbox_client_secret}
                                  className="mt-2 w-full h-9 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                  {testingSandbox ? 'Probando...' : 'Probar Conexion Sandbox'}
                                </button>
                                {sandboxResult && (
                                  <div className={`mt-2 p-2 rounded-lg text-xs font-bold ${sandboxResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {sandboxResult.success ? '✓ ' + sandboxResult.message : '✗ ' + (sandboxResult.error || 'Error desconocido')}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Live Credentials */}
                            <div className="space-y-4 p-4 rounded-xl border border-green-200 bg-green-50/30">
                              <h4 className="text-sm font-bold text-green-800">Credenciales Live</h4>
                              <div>
                                <label className="block text-xs font-bold text-green-900/70 mb-1">Live Client ID</label>
                                <div className="relative">
                                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                                  <input 
                                    type="text" 
                                    value={gw.live_client_id || ''}
                                    onChange={(e) => setGw({ live_client_id: e.target.value })}
                                    placeholder="Ingresa tu Live Client ID" 
                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-green-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all font-mono bg-white" 
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-xs font-bold text-green-900/70 mb-1">Live Secret Key</label>
                                <div className="relative">
                                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                                  <input 
                                    type="password" 
                                    value={gw.live_client_secret || ''}
                                    onChange={(e) => setGw({ live_client_secret: e.target.value })}
                                    placeholder="Ingresa tu Live Secret" 
                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-green-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all font-mono bg-white" 
                                  />
                                </div>
                                <button
                                  onClick={async () => {
                                    setTestingLive(true);
                                    setLiveResult(null);
                                    try {
                                      const res = await fetch('/api/admin/payment-gateways/test', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', ...(getToken() && { 'Authorization': `Bearer ${getToken()}` }) },
                                        body: JSON.stringify({ mode: 'live', live_client_id: gw.live_client_id, live_client_secret: gw.live_client_secret })
                                      });
                                      const data = await res.json();
                                      setLiveResult(data);
                                    } catch (e) {
                                      setLiveResult({ success: false, error: String(e) });
                                    } finally {
                                      setTestingLive(false);
                                    }
                                  }}
                                  disabled={testingLive || !gw.live_client_id || !gw.live_client_secret}
                                  className="mt-2 w-full h-9 bg-[#003087] hover:bg-[#002060] disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                  {testingLive ? 'Probando...' : 'Probar Conexion Live'}
                                </button>
                                {liveResult && (
                                  <div className={`mt-2 p-2 rounded-lg text-xs font-bold ${liveResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {liveResult.success ? '✓ ' + liveResult.message : '✗ ' + (liveResult.error || 'Error desconocido')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                  })()}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-4">Registro de Pagos (PayPal)</h3>
                    <div className="space-y-3">
                      {globalData?.transactions && globalData.transactions.length > 0 ? (
                        globalData.transactions.map((tx: any, i: number) => {
                          const dateObj = new Date(tx.created_at);
                          const timeStr = isNaN(dateObj.getTime()) ? tx.created_at : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                  <DollarSign className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900">{tx.tenant_name || 'Tenant ' + tx.tenant_id.replace('tenant_', '')} renovado</div>
                                  <div className="text-[10px] text-slate-500">{tx.paypal_order_id || 'PAYID-XXX'} • {timeStr}</div>
                                </div>
                              </div>
                              <div className="text-xs font-black text-slate-900">+${Number(tx.amount).toFixed(2)}</div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center p-6 text-slate-400 text-xs font-semibold">
                          No hay transacciones registradas.
                        </div>
                      )}
                    </div>
                    <button className="w-full mt-4 h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Ver Registro Completo</button>
                  </div>

              </div>
            </div>
          )}

          {activeTab === "communications" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Flujos de Mensajería</h2>
                  <p className="text-sm text-slate-500 font-medium">Configura las notificaciones automáticas y alertas a tenants por email y WhatsApp.</p>
                </div>
                <button onClick={openNewFlowModal} className="h-10 px-4 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl text-sm font-bold shadow-sm shadow-[#109e38]/20 transition-all flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nuevo Flujo
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {globalData?.communicationFlows?.map((msg: any) => (
                  <div key={msg.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative group flex flex-col">
                     <div className="flex justify-between items-start mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${msg.color === 'green' ? 'bg-green-100 text-green-600' : msg.color === 'orange' ? 'bg-orange-100 text-orange-600' : msg.color === 'red' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                           <Megaphone className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${msg.color === 'green' ? 'bg-green-100 text-green-700' : msg.color === 'orange' ? 'bg-orange-100 text-orange-700' : msg.color === 'red' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{msg.status}</span>
                          <button onClick={() => handleDeleteFlow(msg.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                        </div>
                     </div>
                     <h3 className="font-bold text-slate-900 text-sm">{msg.title}</h3>
                     <p className="text-xs text-slate-500 mt-2 mb-4 leading-relaxed flex-1">{msg.description}</p>
                     <div className="flex items-center justify-between mt-auto">
                        <span className="text-[10px] font-bold text-slate-400 capitalize">{msg.type}</span>
                        <button onClick={() => openEditFlowModal(msg)} className="text-xs font-bold text-[#109e38] hover:underline opacity-0 group-hover:opacity-100 transition-opacity">Editar Flujo</button>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "api-pool" && (
            <div className="max-w-7xl mx-auto py-6 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Cpu className="w-6 h-6 text-[#109e38]" />
                    Orquestador de Proveedores de IA
                  </h2>
                  <p className="text-sm text-slate-500 font-medium">Configura múltiples proveedores de IA (Google Gemini, OpenAI, Groq, etc.) y define qué modelos están activos de forma dinámica.</p>
                </div>
                <button
                  onClick={() => setIsAddProviderOpen(true)}
                  className="h-10 px-4 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl text-sm font-bold shadow-sm shadow-[#109e38]/20 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Registrar Proveedor
                </button>
              </div>

              {/* Grid layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Providers List (Left Side - 5 columns) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-400" />
                        Proveedores ({providers.length})
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                      {providers.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm italic">
                          No hay proveedores registrados.
                        </div>
                      ) : (
                        providers.map((p) => {
                          const isActive = p.is_active === 1;
                          const isSelected = activeProvider?.id === p.id;
                          return (
                            <div
                              key={p.id}
                              onClick={() => setActiveProvider(p)}
                              className={`p-4 transition-all duration-200 cursor-pointer flex items-center justify-between group relative border-l-4 ${
                                isSelected 
                                  ? "bg-slate-50/80 border-l-[#109e38]" 
                                  : "border-l-transparent hover:bg-slate-50/30"
                              }`}
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-slate-900 text-sm truncate">{p.display_name}</h4>
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{p.id}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-1">{p.api_base_url}</p>
                              </div>
                              
                              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                {/* Toggle switch */}
                                <button
                                  onClick={() => handleToggleProviderActive(p.id)}
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    isActive ? "bg-[#109e38]" : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      isActive ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>

                                {/* Delete button for custom providers */}
                                {p.id !== 'gemini' && (
                                  <button
                                    onClick={() => handleDeleteProvider(p.id)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Eliminar Proveedor"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Models List (Right Side - 7 columns) */}
                <div className="lg:col-span-7">
                  {activeProvider ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Selected Provider Details Header */}
                      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-900">{activeProvider.display_name}</h3>
                            {activeProvider.is_active === 1 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                                <ShieldCheck className="w-3 h-3 mr-1" /> Activo Global
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 font-medium">Modelos disponibles para enrutamiento inteligente.</p>
                        </div>
                        
                        <button
                          onClick={() => setIsAddModelOpen(true)}
                          className="h-9 px-3 bg-[#109e38]/10 hover:bg-[#109e38]/20 text-[#109e38] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-center"
                        >
                          <Plus className="w-4 h-4" /> Agregar Modelo a {activeProvider.display_name}
                        </button>
                      </div>

                      {/* Models Grid/List */}
                      <div className="divide-y divide-slate-100">
                        {loadingModels ? (
                          <div className="p-12 text-center text-slate-400 text-sm">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#109e38]" />
                            Cargando modelos...
                          </div>
                        ) : models.length === 0 ? (
                          <div className="p-12 text-center text-slate-400 text-sm italic">
                            No hay modelos agregados para este proveedor.
                          </div>
                        ) : (
                          models.map((m) => {
                            const isModelActive = m.is_active === 1;
                            const isDefaultGeminiModel = activeProvider.id === 'gemini' && (m.model_id === 'gemini-2.5-flash' || m.model_id === 'gemini-2.0-flash' || m.model_id === 'gemini-1.5-flash');
                            return (
                              <div key={m.id} className="p-5 flex items-start justify-between hover:bg-slate-50/30 transition-all group">
                                <div className="space-y-1 pr-4">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-900 text-sm">{m.name}</h4>
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{m.model_id}</span>
                                    {isModelActive && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#109e38]/15 text-[#109e38]">
                                        En Uso
                                      </span>
                                    )}
                                  </div>
                                  {m.description && <p className="text-xs text-slate-400 leading-relaxed max-w-md">{m.description}</p>}
                                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-semibold pt-1">
                                    {m.context_window && (
                                      <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                        Contexto: {m.context_window.toLocaleString()} tokens
                                      </span>
                                    )}
                                    {m.max_output_tokens && (
                                      <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                        Max Output: {m.max_output_tokens.toLocaleString()} tokens
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  {/* Toggle Switch */}
                                  <button
                                    onClick={() => handleToggleModelActive(m.id)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      isModelActive ? "bg-[#109e38]" : "bg-slate-200"
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        isModelActive ? "translate-x-4" : "translate-x-0"
                                      }`}
                                    />
                                  </button>

                                  {/* Delete model */}
                                  {!isDefaultGeminiModel && (
                                    <button
                                      onClick={() => handleDeleteModel(m.id)}
                                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                      title="Eliminar Modelo"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
                      <Cpu className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      Selecciona un proveedor para gestionar sus modelos disponibles.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
          
          {activeTab === "whatsapp" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-2">WhatsApp API del Sistema</h3>
                <p className="text-sm text-slate-500 mb-6">Conecta el número de WhatsApp central de la plataforma. Este número será utilizado para enviar códigos de verificación, bienvenida de nuevas cuentas y soporte general a los dueños de los restaurantes.</p>
                <div className="max-w-md mx-auto">
                  <WhatsAppConnector tenantId="system_admin" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "agent" && (
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-160px)]">
              <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                  <div className="w-10 h-10 rounded-full bg-[#109e38]/10 text-[#109e38] flex items-center justify-center">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Agente Autónomo del SuperAdmin</h3>
                    <p className="text-xs text-slate-500 font-medium">Asistente con acceso global para gestionar restaurantes, planes y configuraciones.</p>
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-slate-50/50 space-y-4">
                  {simulatorLogs.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">Hola, soy el asistente de la plataforma. Pídeme que cree un restaurante, suspenda cuentas o te muestre métricas.</p>
                    </div>
                  )}
                  {simulatorLogs.map((log, i) => (
                    <div key={i} className={`flex ${log.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                        log.role === 'user' 
                          ? 'bg-[#109e38] text-white rounded-br-none' 
                          : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                      }`}>
                         {log.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-white border-t border-slate-100">
                   <div className="relative">
                      <input 
                        type="text" 
                        value={simulatorMessage}
                        onChange={e => setSimulatorMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSimulatorSend()}
                        placeholder="E.g. Crea un restaurante llamado Pizza Planeta..." 
                        className="w-full h-12 pl-4 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-[#109e38] transition-all"
                      />
                      <button 
                        onClick={handleSimulatorSend}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#109e38] text-white flex items-center justify-center hover:bg-[#0e8c31] transition-colors"
                      >
                         <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9 22 2z"/></svg>
                      </button>
                   </div>
                </div>
              </div>

              <div className="w-full lg:w-80 shrink-0 space-y-6 overflow-y-auto">
                 <div className="bg-[#e7f5ec] p-6 rounded-3xl border border-[#109e38]/10 h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <MessageSquare className="w-5 h-5 text-[#109e38]" />
                      <h4 className="text-sm font-black text-slate-900 uppercase">Instrucciones Globales AI</h4>
                    </div>
                    <p className="text-xs text-slate-600 mb-4 font-medium leading-relaxed">
                      El agente responderá tanto en este chat de administrador como por WhatsApp central, usando estas reglas para soporte a los dueños de restaurante.
                    </p>
                    <textarea 
                      placeholder="Ej: Si un restaurante pregunta cómo cambiar de plan, recuérdale que el Plan Pro cuesta $99..."
                      className="w-full flex-1 min-h-[150px] p-4 rounded-xl bg-white border border-green-200 text-sm focus:outline-none focus:border-[#109e38] resize-none"
                    ></textarea>
                    <button className="w-full h-10 mt-4 bg-[#109e38] text-white rounded-xl text-xs font-bold hover:bg-[#0d842e] transition-colors">Guardar Reglas</button>
                 </div>
              </div>
            </div>
          )}
          
        </div>
        )}

        {/* Plan Form Modal */}
        {showPlanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="font-bold text-slate-900">{planForm.id ? 'Editar Plan' : 'Crear Nuevo Plan'}</h3>
                <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">Close</span>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="overflow-y-auto p-5">
                <form id="plan-form" onSubmit={handleCreateOrEditPlan} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Plan</label>
                    <input 
                      type="text" 
                      required 
                      value={planForm.name}
                      onChange={(e) => setPlanForm({...planForm, name: e.target.value})}
                      placeholder="Ej. Professional" 
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Precio ($)</label>
                      <input 
                        type="number" 
                        required 
                        value={planForm.price}
                        onChange={(e) => setPlanForm({...planForm, price: parseFloat(e.target.value)})}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Intervalo</label>
                      <select 
                        value={planForm.interval}
                        onChange={(e) => setPlanForm({...planForm, interval: e.target.value})}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all bg-white"
                      >
                         <option value="mo">Mensual</option>
                         <option value="yr">Anual</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Órdenes Máximas / mes</label>
                    <input 
                      type="number" 
                      required 
                      value={planForm.max_orders}
                      onChange={(e) => setPlanForm({...planForm, max_orders: parseInt(e.target.value)})}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Características</label>
                      <button 
                        type="button" 
                        onClick={() => setPlanForm({...planForm, features: [...planForm.features, '']})}
                        className="text-[10px] font-bold text-[#109e38] hover:underline"
                      >
                        + Agregar
                      </button>
                    </div>
                    <div className="space-y-2">
                       {planForm.features.map((feature, i) => (
                         <div key={i} className="flex items-center gap-2">
                           <input 
                             type="text" 
                             required 
                             value={feature}
                             onChange={(e) => {
                               const newFeatures = [...planForm.features];
                               newFeatures[i] = e.target.value;
                               setPlanForm({...planForm, features: newFeatures});
                             }}
                             className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                             placeholder="Ej. Soporte 24/7"
                           />
                           <button 
                             type="button"
                             onClick={() => {
                               const newFeatures = planForm.features.filter((_, idx) => idx !== i);
                               setPlanForm({...planForm, features: newFeatures});
                             }}
                             className="p-2 text-slate-400 hover:text-red-500 rounded-lg"
                           >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                           </button>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={planForm.is_popular === 1}
                        onChange={(e) => setPlanForm({...planForm, is_popular: e.target.checked ? 1 : 0})}
                        className="w-4 h-4 text-[#109e38] rounded border-slate-300 focus:ring-[#109e38]" 
                      />
                      <span className="text-sm font-bold text-slate-700">Marcar como plan recomendado (Popular)</span>
                    </label>
                  </div>
                </form>
              </div>
              <div className="p-5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">
                <button type="button" onClick={() => setShowPlanModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" form="plan-form" className="px-4 py-2 bg-[#109e38] hover:bg-[#0d842e] text-white text-sm font-bold rounded-xl transition-colors">Guardar Plan</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Add Tenant Modal */}
        {showAddTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-900">Agregar Nuevo Tenant</h3>
                <button onClick={() => setShowAddTenant(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">Close</span>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <form onSubmit={handleCreateTenant} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Restaurante</label>
                  <input 
                    type="text" 
                    required 
                    value={newTenantForm.name}
                    onChange={(e) => setNewTenantForm({...newTenantForm, name: e.target.value})}
                    placeholder="Ej. Taquería El Paisa" 
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plan Inicial</label>
                  <select 
                    value={newTenantForm.plan}
                    onChange={(e) => setNewTenantForm({...newTenantForm, plan: e.target.value})}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all bg-white"
                  >
                    {globalData?.plans?.map((plan: any) => (
                       <option key={plan.id} value={plan.name}>{plan.name} (${plan.price}/{plan.interval})</option>
                    )) || (
                      <>
                        <option value="Starter">Starter ($29/mo)</option>
                        <option value="Pro">Professional ($99/mo)</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddTenant(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-[#109e38] hover:bg-[#0d842e] text-white text-sm font-bold rounded-xl transition-colors">Crear Tenant</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Flow Form Modal */}
        {showFlowModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <h3 className="font-bold text-slate-900">{flowForm.id ? 'Editar Flujo' : 'Crear Flujo'}</h3>
                <button onClick={() => setShowFlowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">Close</span>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="overflow-y-auto p-5">
                <form id="flow-form" onSubmit={handleCreateOrEditFlow} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Título del Flujo</label>
                    <input 
                      type="text" 
                      required 
                      value={flowForm.title}
                      onChange={(e) => setFlowForm({...flowForm, title: e.target.value})}
                      placeholder="Ej. Recordatorio de Pago" 
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Descripción</label>
                    <textarea 
                      required 
                      rows={3}
                      value={flowForm.description}
                      onChange={(e) => setFlowForm({...flowForm, description: e.target.value})}
                      placeholder="Descripción de cuándo se dispara este mensaje..." 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tipo / Vía</label>
                      <select 
                        value={flowForm.type}
                        onChange={(e) => setFlowForm({...flowForm, type: e.target.value})}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all bg-white"
                      >
                         <option value="Email">Email</option>
                         <option value="WhatsApp">WhatsApp</option>
                         <option value="Email + WhatsApp">Email + WhatsApp</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Color (Status UI)</label>
                      <select 
                        value={flowForm.color}
                        onChange={(e) => setFlowForm({...flowForm, color: e.target.value})}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all bg-white"
                      >
                         <option value="slate">Gris (Slate)</option>
                         <option value="green">Verde (Éxito)</option>
                         <option value="orange">Naranja (Alerta)</option>
                         <option value="red">Rojo (Peligro)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Status Interno</label>
                    <input 
                      type="text" 
                      required 
                      value={flowForm.status}
                      onChange={(e) => setFlowForm({...flowForm, status: e.target.value})}
                      placeholder="Ej. Activo / Borrador / Suspendido" 
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                    />
                  </div>
                </form>
              </div>
              <div className="p-5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">
                <button type="button" onClick={() => setShowFlowModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" form="flow-form" className="px-4 py-2 bg-[#109e38] hover:bg-[#0d842e] text-white text-sm font-bold rounded-xl transition-colors">Guardar Flujo</button>
              </div>
            </div>
          </div>
        )}

        {/* Add Provider Modal */}
        {isAddProviderOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#109e38]" />
                  <h3 className="font-black text-slate-900 tracking-tight">Registrar Proveedor de IA</h3>
                </div>
                <button 
                  onClick={() => setIsAddProviderOpen(false)} 
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ID Único del Proveedor (Minúsculas, sin espacios)</label>
                  <input 
                    type="text" 
                    required 
                    value={newProvider.id}
                    onChange={(e) => setNewProvider({...newProvider, id: e.target.value.toLowerCase().replace(/\s/g, '')})}
                    placeholder="Ej. openai, groq, deepseek, anthropic" 
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                  />
                  <p className="mt-1 text-[10px] text-slate-400 font-medium">Este ID identificará internamente al proveedor en el router de llamadas.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre para Mostrar</label>
                  <input 
                    type="text" 
                    required 
                    value={newProvider.display_name}
                    onChange={(e) => setNewProvider({...newProvider, display_name: e.target.value})}
                    placeholder="Ej. OpenAI, Groq Cloud, Anthropic" 
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">API Base URL</label>
                  <input 
                    type="url" 
                    required 
                    value={newProvider.api_base_url}
                    onChange={(e) => setNewProvider({...newProvider, api_base_url: e.target.value})}
                    placeholder="Ej. https://api.openai.com/v1" 
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                  />
                  <p className="mt-1 text-[10px] text-slate-400 font-medium">La URL raíz para las peticiones HTTP que siguen el estándar oficial de OpenAI.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">API Key (Opcional - Puede venir de las variables de entorno)</label>
                  <input 
                    type="password" 
                    value={newProvider.api_key}
                    onChange={(e) => setNewProvider({...newProvider, api_key: e.target.value})}
                    placeholder="••••••••••••••••••••••••••••" 
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                  />
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsAddProviderOpen(false)} 
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  disabled={!newProvider.id || !newProvider.display_name || !newProvider.api_base_url}
                  onClick={handleAddProvider} 
                  className="px-4 py-2 bg-[#109e38] hover:bg-[#0d842e] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
                >
                  Registrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Model Modal */}
        {isAddModelOpen && activeProvider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-[#109e38]" />
                  <h3 className="font-black text-slate-900 tracking-tight">Agregar Modelo a {activeProvider.display_name}</h3>
                </div>
                <button 
                  onClick={() => setIsAddModelOpen(false)} 
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ID del Modelo (Según API del Proveedor)</label>
                  <input 
                    type="text" 
                    required 
                    value={newModel.model_id}
                    onChange={(e) => setNewModel({...newModel, model_id: e.target.value.trim()})}
                    placeholder="Ej. gpt-4o, llama-3.1-70b-versatile, claude-3-5-sonnet" 
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                  />
                  <p className="mt-1 text-[10px] text-slate-400 font-medium">Este ID debe coincidir exactamente con el esperado por la API de tu proveedor.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Descriptivo</label>
                  <input 
                    type="text" 
                    required 
                    value={newModel.name}
                    onChange={(e) => setNewModel({...newModel, name: e.target.value})}
                    placeholder="Ej. GPT-4o Flagship, LLaMA 3.1 70B Fast" 
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descripción del Modelo</label>
                  <textarea 
                    rows={2}
                    value={newModel.description}
                    onChange={(e) => setNewModel({...newModel, description: e.target.value})}
                    placeholder="Breve explicación de las fortalezas de este modelo..." 
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Context Window (Tokens)</label>
                    <input 
                      type="number" 
                      value={newModel.context_window}
                      onChange={(e) => setNewModel({...newModel, context_window: e.target.value})}
                      placeholder="Ej. 128000" 
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Max Output Tokens</label>
                    <input 
                      type="number" 
                      value={newModel.max_output_tokens}
                      onChange={(e) => setNewModel({...newModel, max_output_tokens: e.target.value})}
                      placeholder="Ej. 4096" 
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:border-[#109e38] focus:ring-1 focus:ring-[#109e38] transition-all" 
                    />
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsAddModelOpen(false)} 
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  disabled={!newModel.model_id || !newModel.name}
                  onClick={handleAddModel} 
                  className="px-4 py-2 bg-[#109e38] hover:bg-[#0d842e] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
                >
                  Agregar Modelo
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}


