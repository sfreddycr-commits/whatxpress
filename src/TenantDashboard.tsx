import React, { useState, useEffect } from "react";
import {
  Menu,
  UtensilsCrossed,
  LayoutDashboard,
  ShoppingCart,
  ChefHat,
  QrCode,
  Sparkles,
  TrendingUp,
  Settings,
  Users,
  TruckIcon,
  BarChart3,
  UserCheck,
  CreditCard,
  Bot,
  Package,
  X,
  MessageCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useDashboardData } from "../hooks/useDashboardData";
import { DashboardHomeView } from "../components/DashboardHomeView";
import { PosView } from "../components/PosView";
import { MenuView } from "../components/MenuView";
import { QrView } from "../components/QrView";
import KdsView from "../components/KdsView";
import { VariantsView } from "../components/VariantsView";
import { PromotionsView } from "../components/PromotionsView";
import { StaffView } from "../components/StaffView";
import { ConversationsView } from "../components/ConversationsView";
import { AiView } from "../components/AiView";
import { DeliveryView } from "../components/DeliveryView";
import { ReportsView } from "../components/ReportsView";
import { OpsControlView } from "../components/OpsControlView";
import { SubscriptionView } from "../components/SubscriptionView";
import { SettingsView } from "../components/SettingsView";

type TabId =
  | "dashboard"
  | "pos"
  | "menu"
  | "qr"
  | "kds"
  | "variants"
  | "promotions"
  | "staff"
  | "ai"
  | "delivery"
  | "reports"
  | "crm"
  | "subscription"
  | "conversations"
  | "settings";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Panel Principal", icon: LayoutDashboard },
  { id: "pos", label: "Punto de Venta", icon: ShoppingCart },
  { id: "menu", label: "Menú y Productos", icon: UtensilsCrossed },
  { id: "qr", label: "Mesas y QR", icon: QrCode },
  { id: "kds", label: "Cocina KDS", icon: ChefHat },
  { id: "variants", label: "Variantes y Extras", icon: Package },
  { id: "promotions", label: "Promociones", icon: Sparkles },
  { id: "staff", label: "Meseros y Personal", icon: Users },
  { id: "ai", label: "Agente WhatsApp", icon: Bot },
  { id: "delivery", label: "Envíos", icon: TruckIcon },
  { id: "reports", label: "Reportes", icon: BarChart3 },
  { id: "subscription", label: "Mi Suscripción", icon: CreditCard },
  { id: "conversations", label: "Conversaciones", icon: MessageCircle },
  { id: "settings", label: "Configuración", icon: Settings },
];

export const TenantDashboard: React.FC = () => {
  const { dashboardData, loading, loadError, refreshDashboard, dbTables, tenantId, token } =
    useDashboardData();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [geoState, setGeoState] = useState<"pending" | "granted" | "denied">("pending");

  // Geolocation permission
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoState("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setGeoState("granted"),
      () => setGeoState("denied")
    );
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("tenantId");
    window.location.href = "/login";
  };

  if (!tenantId || !token) {
    window.location.href = "/login";
    return null;
  }

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#109e38] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-400">Cargando...</span>
        </div>
      </div>
    );
  }

  if (loadError && !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-red-500 font-bold mb-2">Error al cargar datos</p>
          <p className="text-slate-400 text-sm">{loadError}</p>
          <button
            onClick={refreshDashboard}
            className="mt-4 px-4 py-2 bg-[#109e38] text-white rounded-xl font-bold text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const tenant = dashboardData?.tenant;
  const metrics = dashboardData?.metrics;
  const settings = dashboardData?.settings;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const today = new Date().toLocaleDateString("es-CR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const renderContent = () => {
    const dd = dashboardData;
    if (!dd) return null;

    const currencySymbol = settings?.currency_symbol || "$";
    const commonProps = { tenantId, token, refreshDashboard, setIsSidebarOpen, setActiveTab, currencySymbol };

    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardHomeView
            {...commonProps}
            metrics={metrics}
            activeOrders={dd.activeOrders || []}
            menuItems={dd.menuItems || []}
            tenant={tenant}
            dbTables={dbTables}
          />
        );
      case "pos":
        return (
          <PosView
            {...commonProps}
            categories={dd.categories || []}
            menuItems={dd.menuItems || []}
            tables={dbTables}
          />
        );
      case "menu":
        return (
          <MenuView
            {...commonProps}
            categories={dd.categories || []}
            menuItems={dd.menuItems || []}
          />
        );
      case "qr":
        return <QrView {...commonProps} dbTables={dbTables} />;
      case "kds":
        return (
          <KdsView
            {...commonProps}
          />
        );
      case "variants":
        return <VariantsView {...commonProps} menuItems={dd.menuItems || []} />;
      case "promotions":
        return (
          <PromotionsView
            {...commonProps}
            dbCoupons={dd.dbCoupons || []}
          />
        );
      case "staff":
        return (
          <StaffView
            {...commonProps}
            waiters={dd.waiters || []}
          />
        );
      case "ai":
        return (
          <AiView
            {...commonProps}
            aiLogs={dd.aiLogs || []}
            aiConfig={dd.aiConfig}
            activeOrders={dd.activeOrders || []}
          />
        );
      case "delivery":
        return (
          <DeliveryView
            {...commonProps}
            activeOrders={dd.activeOrders || []}
          />
        );
      case "reports":
        return <ReportsView {...commonProps} />;
      case "subscription":
        return (
          <SubscriptionView
            {...commonProps}
            tenant={tenant}
          />
        );
      case "conversations":
        return (
          <ConversationsView
            {...commonProps}
          />
        );
      case "settings":
        return (
          <SettingsView
            {...commonProps}
            settings={settings}
            tenant={tenant}
          />
        );
      default:
        return null;
    }
  };

  const SidebarContent: React.FC = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#109e38] flex items-center justify-center shadow-lg shadow-[#109e38]/20">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 tracking-tight leading-none">
              WhatXpress
            </div>
            <div className="text-[10px] font-medium text-slate-400">Restaurant OS</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? "bg-[#109e38] text-white shadow-lg shadow-[#109e38]/20"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-xs">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-black">
            {tenant?.name?.charAt(0) || "A"}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-700 truncate">{tenant?.name || "Admin"}</div>
            <div className="text-[10px] text-slate-400 capitalize">{tenant?.plan || "Free"}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full h-9 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden lg:flex sticky top-0 h-screen shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
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
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 shrink-0 lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-[#109e38]" />
            <span className="text-sm font-black text-slate-900">WhatXpress</span>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
};
export default TenantDashboard;
