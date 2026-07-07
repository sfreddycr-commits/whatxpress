// src/tools/adminTools.ts
import type { FunctionDeclaration } from "@google/genai";
import { Type } from "@google/genai";

export const adminTools: FunctionDeclaration[] = [
  {
    name: 'list_tenants',
    description: 'Lists all registered restaurants/tenants on the platform.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'get_metrics',
    description: 'Gets global platform metrics (ARR, total tenants).',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'create_tenant',
    description: 'Creates a new restaurant/tenant.',
    parameters: { 
      type: Type.OBJECT, 
      properties: {
         name: { type: Type.STRING, description: 'Name of the restaurant' },
         plan: { type: Type.STRING, description: 'Plan to assign (e.g. Starter, Pro)' }
      },
      required: ['name', 'plan']
    }
  },
  {
    name: 'create_plan',
    description: 'Creates a new subscription plan for the platform.',
    parameters: { 
      type: Type.OBJECT, 
      properties: {
         id: { type: Type.STRING, description: 'Unique identifier for the plan (e.g., enterprise)' },
         name: { type: Type.STRING, description: 'Display name of the plan' },
         price: { type: Type.NUMBER, description: 'Monthly price in USD' },
         max_orders: { type: Type.NUMBER, description: 'Maximum orders allowed' }
      },
      required: ['id', 'name', 'price', 'max_orders']
    }
  },
  {
    name: 'update_tenant_plan',
    description: 'Updates the subscription plan of an existing tenant.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         identifier: { type: Type.STRING, description: 'ID or Name of the restaurant to update' },
         new_plan: { type: Type.STRING, description: 'Name of the new plan' }
      },
      required: ['identifier', 'new_plan']
    }
  },
  {
    name: 'suspend_tenant',
    description: 'Suspends an existing tenant by ID or Name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         identifier: { type: Type.STRING, description: 'ID or Name of the restaurant to suspend' }
      },
      required: ['identifier']
    }
  },
  {
    name: 'create_table',
    description: 'Creates a physical dining table for a restaurant and generates its QR code.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         tenant_id: { type: Type.STRING, description: 'ID of the restaurant' },
         table_number: { type: Type.STRING, description: 'Table number or name, e.g. Mesa 4' },
         capacity: { type: Type.NUMBER, description: 'Seating capacity of the table, e.g. 4' }
      },
      required: ['tenant_id', 'table_number']
    }
  },
  {
    name: 'add_dish_variant',
    description: 'Adds customized attributes/variants (e.g. Size, Spiciness) to a menu item.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         menu_item_id: { type: Type.STRING, description: 'The ID of the dish to customize' },
         name: { type: Type.STRING, description: 'Name of the variant, e.g. Size' },
         options: { type: Type.STRING, description: 'JSON array of options, e.g. ["Small", "Medium", "Large"]' }
      },
      required: ['menu_item_id', 'name', 'options']
    }
  },
  {
    name: 'update_kitchen_order_status',
    description: 'Updates the prep state of a kitchen order (Pending, Preparing, Ready).',
    parameters: {
      type: Type.OBJECT,
      properties: {
         kitchen_order_id: { type: Type.STRING, description: 'The unique ID of the kitchen order' },
         status: { type: Type.STRING, description: 'The new status, e.g. Preparing or Ready' }
      },
      required: ['kitchen_order_id', 'status']
    }
  },
  {
    name: 'apply_promo_coupon',
    description: 'Validates and applies a coupon code to a customer order.',
    parameters: {
      type: Type.OBJECT,
      properties: {
         tenant_id: { type: Type.STRING, description: 'The unique ID of the restaurant/tenant' },
         code: { type: Type.STRING, description: 'The coupon code, e.g. PROMO2026' },
         subtotal: { type: Type.NUMBER, description: 'The current order subtotal before discount' }
      },
      required: ['tenant_id', 'code', 'subtotal']
    }
  }
];

export const adminToolNames = adminTools.map((t) => t.name);