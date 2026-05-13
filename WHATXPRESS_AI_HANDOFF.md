# 🧠 WHATXPRESS - AI AGENT HANDOFF DOCUMENT
> **[CRITICAL SYSTEM PROMPT]**
> If you are a new AI Agent loading this file, read it entirely before touching any code. This document contains the exact architecture, database schemas, active dependencies, and hard rules of the WhatXpress project to ensure flawless continuity.

---

## 🏗️ 1. PROJECT OVERVIEW & ARCHITECTURE
**WhatXpress** is a Multi-Tenant POS (Point of Sale), KDS (Kitchen Display System), and WhatsApp Automation platform for restaurants. 

- **Root Directory:** `/opt/projects/whatxpress-src`
- **Tech Stack:**
  - **Frontend:** React + Vite + TailwindCSS. (Highly componentized).
  - **Backend:** Node.js + Express (TypeScript).
  - **Database:** PostgreSQL (accessed via a custom `DBWrapper` in `src/db.ts` that emulates SQLite syntax like `db.run()`, `db.get()`, `db.all()`).
  - **Real-Time:** Native WebSockets (`ws` library).
  - **WhatsApp API:** Baileys (`@whiskeysockets/baileys`).
  - **AI Engine:** Google Gemini (`@google/genai`) for conversational ordering.

---

## 📂 2. DIRECTORY STRUCTURE & MODULARIZATION

Recently refactored. The monolithic `TenantDashboard` was broken down into specialized components:

```text
/opt/projects/whatxpress-src/
├── server.ts                       # Main Express API, REST endpoints, Auth logic
├── package.json                    # Dependencies & Scripts
├── src/
│   ├── db.ts                       # Custom PostgreSQL Wrapper (CRITICAL)
│   ├── components/                 # Frontend Views
│   │   ├── PosView.tsx             # Point of Sale (Checkout, Tabs)
│   │   ├── KdsView.tsx             # Kitchen Display System (Real-time orders)
│   │   ├── DeliveryView.tsx        # Delivery & Dispatch tracking
│   │   ├── SettingsView.tsx        # Tenant branding and configuration
│   │   ├── AiView.tsx              # AI Prompt configuration & logs
│   │   ├── VariantsView.tsx        # Menu item variants management
│   │   ├── TabViews.tsx            # Staff, QR, Subscriptions, Promos, Menu
│   │   └── WhatsAppConnector.tsx   # QR code generation for Baileys
│   ├── hooks/
│   │   └── useKitchenWebSocket.ts  # Frontend WebSocket hook for KDS
│   ├── services/
│   │   ├── websocketServer.ts      # Backend WebSocket server logic
│   │   ├── whatsappService.ts      # Baileys implementation & WhatsApp flow
│   │   ├── aiService.ts            # Gemini AI Integration & Key pooling
│   │   └── authService.ts          # JWT Authentication logic
│   ├── middleware/
│   │   └── auth.ts                 # Express token verification
```

---

## 🗄️ 3. DATABASE SCHEMA & QUIRKS (CRITICAL)

The project uses PostgreSQL, but the `DBWrapper` (`src/db.ts`) translates standard SQLite calls to Postgres syntax on the fly. 

### Core Tables:
- `tenants`: Multi-tenant core (id, name, status, plan, mrr).
- `menu_items`: (id, tenant_id, category_id, name, price, is_available).
- `pos_orders`: Tracks the master order (id, tenant_id, table_number, status: 'open' | 'closed').
- `pos_order_items`: **CRITICAL RULE:** This table **does not have AUTOINCREMENT**. You MUST generate a unique string `id` (e.g., `poi_${Date.now()}_${Math.random()}`) when inserting into this table, otherwise PostgreSQL will throw a `NOT NULL constraint` error.
- `kitchen_orders`: Tracks orders sent to the KDS (status: 'pending', 'preparing', 'completed').

### Database Usage Rule:
Always use parameterized queries to prevent SQL injection:
✅ `await db.run("INSERT INTO categories (id, name) VALUES (?, ?)", [id, name]);`

---

## 📡 4. ROUTING & API ENDPOINTS

All API endpoints are defined in `server.ts` and prefixed with `/api/`.
- **Auth:** `POST /api/auth/login` (Returns JWT).
- **Tenant Data:** `GET /api/tenant-dashboard/:id` (Protected by `authenticateToken`).
- **POS / Cuentas Abiertas:**
  - `POST /api/tenant/:id/pos-orders` (Creates or updates an order. Requires generating unique IDs for items).
  - `PUT /api/tenant/:tenantId/pos-orders/:id/status` (Updates status to `open` or `closed`).
- **Kitchen:** `PUT /api/kitchen/:id/status` (Updates KDS status).
- **WebSockets:** Lives in `src/services/websocketServer.ts`. Currently accepts `{ type: "auth", tenantId }`. *(Note: Vulnerable to spoofing, pending JWT validation).*

---

## 🚨 5. CURRENT STATUS & PENDING TASKS

If you are picking up this project, here is the exact state of affairs:

1. **"Cuentas Abiertas" (Open Tabs) is IMPLEMENTED.** 
   - POS can save orders as `open` and recall them. 
   - Thermal printing (`window.print()`) is optimized for 80mm printers.
2. **KDS WebSockets are IMPLEMENTED.** 
   - The kitchen display updates in real-time without polling via `useKitchenWebSocket.ts`.
3. **Major Refactoring is COMPLETED.**
   - `TenantDashboard.tsx` is now modularized.

### Priority Tasks for the Next Agent:
- **WebSocket Security:** In `websocketServer.ts`, the connection is established merely by passing a `tenantId`. You must implement JWT token extraction and verification during the handshake or initial auth message to prevent rogue clients from listening to kitchen orders.
- **Payload Limits:** In `server.ts`, `express.json({ limit: "50mb" })` is too high and poses an OOM risk. Needs to be reduced.
- **CORS:** Currently `app.use(cors())` is fully open. Needs restriction.
- **Fine-Tuning:** Any requested adjustments to the thermal printer CSS or new POS features.

---

## 🚀 6. DEPLOYMENT & COMMANDS

To apply changes, you must rebuild the Vite frontend and restart the backend.
Always run this exact sequence from `/opt/projects/whatxpress-src`:

```bash
cd /opt/projects/whatxpress-src
npm run build
pm2 restart whatxpress
```
*(Note: If the PM2 process is named differently, check `pm2 status` first).*

**END OF HANDOFF.** You are now fully synchronized.
