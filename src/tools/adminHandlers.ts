// src/tools/adminHandlers.ts
import { initDb } from "../db";
import { logger } from "../lib/logger";
import type { ToolContext } from "../services/agentLoop";

// Admin handlers extracted from src/services/aiService.ts (processSystemAdminChat).
// Each handler is a named export whose name matches the FunctionDeclaration.name
// in src/tools/adminTools.ts exactly. Signature: (args, ctx) => Promise<any>.

export async function list_tenants(_args: any, _ctx: ToolContext) {
  const db = await initDb();
  const tenants = await db.all('SELECT id, name, status, plan, mrr FROM tenants LIMIT 10');
  return "Restaurants: " + JSON.stringify(tenants);
}

export async function get_metrics(_args: any, _ctx: ToolContext) {
  const db = await initDb();
  const tenants = await db.all('SELECT id, status, mrr FROM tenants');
  const active = tenants.filter((t: any) => t.status === 'Active').length;
  const totalARR = tenants.reduce((acc: number, t: any) => acc + ((t.mrr || 0) * 12), 0);
  return `Total Active Tenants: ${active}, Total Platform ARR: $${totalARR}`;
}

export async function create_tenant(args: any, _ctx: ToolContext) {
  const db = await initDb();
  const tenantId = "tenant_" + Math.random().toString(36).substr(2, 9);
  const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.run(
    "INSERT INTO tenants (id, name, status, plan, mrr, bg_color, init_letters, trial_ends_at, subscription_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [tenantId, args.name, 'Active', args.plan, args.plan === 'Pro' ? 99 : 29, 'bg-blue-100 text-blue-600', args.name.substring(0, 2).toUpperCase(), trialEndDate, 'trialing']
  );
  return `Tenant ${args.name} created successfully with ID ${tenantId}.`;
}

export async function suspend_tenant(args: any, _ctx: ToolContext) {
  const db = await initDb();
  await db.run("UPDATE tenants SET status = 'Suspended' WHERE id = ? OR name LIKE ?", [args.identifier, `%${args.identifier}%`]);
  return `Tenant with identifier ${args.identifier} has been suspended (if it existed).`;
}

export async function create_plan(args: any, _ctx: ToolContext) {
  const db = await initDb();
  const features = ["Autogestión de Menú Virtual", "Recepción de Pedidos Multicanal", "Soporte Standard"];
  await db.run(
    "INSERT OR REPLACE INTO plans (id, name, price, interval, max_orders, features, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [args.id, args.name, args.price, 'monthly', args.max_orders, JSON.stringify(features), 0]
  );
  return `Plan ${args.name} created successfully with price $${args.price}.`;
}

export async function update_tenant_plan(args: any, _ctx: ToolContext) {
  const db = await initDb();
  await db.run("UPDATE tenants SET plan = ? WHERE id = ? OR name LIKE ?", [args.new_plan, args.identifier, `%${args.identifier}%`]);
  return `Tenant matching '${args.identifier}' had its plan upgraded/updated to ${args.new_plan}.`;
}

export async function create_table(args: any, _ctx: ToolContext) {
  const db = await initDb();
  const tableId = "table_" + Math.random().toString(36).substr(2, 9);
  const qrUrl = `/menu/${args.tenant_id}?table=${args.table_number}`;
  await db.run(
    "INSERT INTO dining_tables (id, tenant_id, table_number, capacity, qr_code_url, status) VALUES (?, ?, ?, ?, ?, ?)",
    [tableId, args.tenant_id, args.table_number, args.capacity || 4, qrUrl, 'Available']
  );
  return `Table ${args.table_number} created successfully with QR url ${qrUrl}.`;
}

export async function add_dish_variant(args: any, _ctx: ToolContext) {
  const db = await initDb();
  const attrId = "opt_" + Math.random().toString(36).substr(2, 9);
  await db.run(
    "INSERT INTO item_attributes (id, menu_item_id, name, options) VALUES (?, ?, ?, ?)",
    [attrId, args.menu_item_id, args.name, args.options]
  );
  return `Variant ${args.name} with options ${args.options} added to menu item ${args.menu_item_id}.`;
}

export async function update_kitchen_order_status(args: any, _ctx: ToolContext) {
  const db = await initDb();
  await db.run("UPDATE kitchen_orders SET status = ? WHERE id = ?", [args.status, args.kitchen_order_id]);
  return `Kitchen order ${args.kitchen_order_id} status updated to ${args.status}.`;
}

export async function apply_promo_coupon(args: any, _ctx: ToolContext) {
  const db = await initDb();
  const coupon = await db.get("SELECT * FROM tenant_coupons WHERE tenant_id = ? AND code = ? AND status = 'Active'", [args.tenant_id, args.code]);
  if (!coupon) {
    return `El cupón '${args.code}' no existe o está inactivo.`;
  }
  const today = new Date().toISOString().split('T')[0];
  if (today < coupon.start_date || today > coupon.end_date) {
    return `El cupón '${args.code}' ha expirado.`;
  }
  if (args.subtotal < coupon.minimum_order) {
    return `El cupón '${args.code}' requiere una compra mínima de $${coupon.minimum_order}.`;
  }
  const discountAmount = coupon.discount_type === 'Percentage' ? (args.subtotal * coupon.discount) / 100 : coupon.discount;
  return `Cupón '${args.code}' aplicado correctamente. Descuento calculado: $${discountAmount}.`;
}