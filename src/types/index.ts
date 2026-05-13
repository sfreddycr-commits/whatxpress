// WhatXpress TypeScript Interfaces

export interface Tenant {
  id: string;
  name: string;
  status: 'Active' | 'Suspended' | 'Trialing';
  plan: string;
  mrr: number;
  bg_color: string;
  init_letters: string;
  trial_ends_at: string;
  subscription_status: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string;
  role: 'admin' | 'owner' | 'super_admin';
  created_at: string;
}

export interface UserTenant {
  user_id: string;
  tenant_id: string;
  role: 'owner' | 'admin' | 'super_admin';
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  icon: string;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  is_available: number;
  orders_today?: number;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface POSOrder {
  id: string;
  tenant_id: string;
  table_number: string;
  status: 'open' | 'closed' | 'cancelled' | 'preparing' | 'ready' | 'delivered';
  total: number;
  created_at: string;
  items?: POSOrderItem[];
  waiter_name?: string;
}

export interface POSOrderItem {
  id: number;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price: number;
  item_name?: string;
}

export interface Waiter {
  id: string;
  tenant_id: string;
  name: string;
  pin: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Table {
  id: string;
  tenant_id: string;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied';
  created_at: string;
}

export interface Coupon {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  discount: number;
  discount_type: 'Percentage' | 'Fixed';
  start_date: string;
  end_date: string;
  minimum_order: number;
  is_active: number;
  created_at: string;
}

export interface AIConfig {
  tenant_id: string;
  custom_instructions: string;
  identity_prompt: string;
  operational_rules: string;
  auto_upselling: number;
  reservation_confirmation: number;
  loyalty_rewards: number;
}

export interface AILog {
  id: number;
  tenant_id: string;
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
  automation_type?: string;
}

export interface SimulatorLog {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  image?: string;
}

export interface TenantSettings {
  tenant_id: string;
  country: string;
  currency: string;
  country_code: string;
  phone_number: string;
  whatsapp_number: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  logo_url: string;
}

export interface Metrics {
  tenant_id: string;
  today_sales: number;
  ai_orders_count: number;
  automation_rate: number;
  active_tables: number;
  total_tables: number;
  pending_deliveries: number;
  attention_deliveries: number;
}

export interface TenantDashboardData {
  tenant: Tenant;
  settings: TenantSettings;
  metrics: Metrics;
  categories: Category[];
  menuItems: MenuItem[];
  aiConfig: AIConfig;
  aiLogs: AILog[];
  activeOrders: POSOrder[];
  dbCoupons?: Coupon[];
  dbTables?: Table[];
  waiters?: Waiter[];
}

export interface GlobalSettings {
  id: string;
  grace_period_days: number;
  annual_discount_percent: number;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenant_id?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    tenant_id?: string;
  };
}

export interface Analytics {
  revenue: {
    today: number;
    month: number;
  };
  orders: {
    today: number;
  };
  topProducts: Array<{
    name: string;
    image_url: string;
    total_qty: number;
    revenue: number;
  }>;
  ordersByHour: Array<{
    hour: string;
    count: number;
  }>;
  aiAutomation: {
    ordersTaken: number;
    rate: string;
  };
}

export interface OrderLimit {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}
