/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import TenantDashboard from "./pages/TenantDashboard";
import NetworkStatus from "./components/NetworkStatus";

const PricingPage = lazy(() => import("./pages/PricingPage"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const CustomerMenu = lazy(() => import("./pages/CustomerMenu"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const DriverMicroPanel = lazy(() => import("./pages/DriverMicroPanel"));
const CustomerTrackingView = lazy(() => import("./pages/CustomerTrackingView"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <Loader2 className="w-8 h-8 text-[#109e38] animate-spin" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <NetworkStatus />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/dashboard" element={<TenantDashboard />} />
          <Route path="/order/:tenantId" element={<CustomerMenu />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<SuperAdminDashboard />} />
          <Route path="/driver" element={<DriverDashboard driverId={localStorage.getItem('driverId') || ''} driverName={localStorage.getItem('driverName') || 'Repartidor'} token={localStorage.getItem('token') || ''} onLogout={() => { localStorage.clear(); window.location.href = '/login'; }} />} />
          <Route path="/d/:token" element={<DriverMicroPanel />} />
          <Route path="/t/:token" element={<CustomerTrackingView />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
