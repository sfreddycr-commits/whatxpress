import { describe, it, expect } from 'vitest';

/**
 * WhatXPress API Tests
 * Run: npx vitest run src/server.test.ts
 */

const BASE = 'http://127.0.0.1:3000';

describe('Health & Auth', () => {
  it('health endpoint returns ok', async () => {
    const res = await fetch(`${BASE}/api/health`);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('auth login works with admin credentials', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@whatxpress.com', password: 'Admin123!' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe('admin@whatxpress.com');
  });

  it('auth login fails with wrong password', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@whatxpress.com', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Order Limit', () => {
  it('returns order limit for Pro tenant (unlimited)', async () => {
    const res = await fetch(`${BASE}/api/tenant/order-limit/tenant_1`);
    const data = await res.json();
    expect(data.allowed).toBe(true);
    expect(data.limit).toBe(-1); // Pro = unlimited
  });

  it('returns correct shape for order limit', async () => {
    const res = await fetch(`${BASE}/api/tenant/order-limit/tenant_1`);
    const data = await res.json();
    expect(data).toHaveProperty('allowed');
    expect(data).toHaveProperty('used');
    expect(data).toHaveProperty('limit');
    expect(data).toHaveProperty('remaining');
  });
});

describe('Analytics', () => {
  it('returns analytics with correct shape', async () => {
    const res = await fetch(`${BASE}/api/analytics/tenant_1`);
    const data = await res.json();
    expect(data.revenue).toBeDefined();
    expect(data.orders).toBeDefined();
    expect(Array.isArray(data.topProducts)).toBe(true);
    expect(Array.isArray(data.ordersByHour)).toBe(true);
    expect(typeof data.revenue.today).toBe('number');
    expect(typeof data.orders.today).toBe('number');
    expect(typeof data.avgOrderValue).toBe('number');
  });
});

describe('WhatsApp Orders', () => {
  it('returns empty array when no orders', async () => {
    const res = await fetch(`${BASE}/api/tenant/whatsapp-orders/tenant_1`);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });
});

describe('Tenant Dashboard', () => {
  it('dashboard endpoint responds', async () => {
    const res = await fetch(`${BASE}/api/tenant-dashboard/tenant_1`);
    expect([200, 401]).toContain(res.status);
  });
});
