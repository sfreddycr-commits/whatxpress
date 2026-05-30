import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { logger } from './lib/logger.js';
const { Pool } = pg;

let dbInstance: any = null;

export class DBWrapper {
  private pool: pg.Pool | null = null;
  private sqliteDb: any = null;
  private isSqlite: boolean = false;

  constructor(connectionString: string, isSqlite: boolean = false, sqliteFile: string = './local.sqlite') {
    this.isSqlite = isSqlite;
    if (isSqlite) {
      this.sqliteDb = new DatabaseSync(sqliteFile);
    } else {
      this.pool = new Pool({
        connectionString,
      });
    }
  }

  private translateSqlToSqlite(sql: string): string {
    // SQLite doesn't use SERIAL, convert to INTEGER PRIMARY KEY AUTOINCREMENT
    return sql.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  }

  private translateSql(sql: string): string {
    let converted = sql;

    // 1. Convert INSERT OR REPLACE
    if (sql.toUpperCase().includes('INSERT OR REPLACE INTO')) {
      const match = sql.match(/INSERT OR REPLACE INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i);
      if (match) {
        const table = match[1];
        const colsStr = match[2];
        const cols = colsStr.split(',').map(c => c.trim());
        const valuesStr = match[3];
        
        let conflictTarget = 'id';
        const lowerTable = table.toLowerCase();
        if (lowerTable === 'tenant_settings' || lowerTable === 'metrics' || lowerTable === 'ai_config') {
          conflictTarget = 'tenant_id';
        }
        
        const updateClause = cols
          .filter(c => c.toLowerCase() !== conflictTarget)
          .map(c => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');
          
        converted = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${valuesStr}) ON CONFLICT ("${conflictTarget}") DO UPDATE SET ${updateClause}`;
      }
    }

    // 2. Convert INSERT OR IGNORE
    if (sql.toUpperCase().includes('INSERT OR IGNORE INTO')) {
      const match = sql.match(/INSERT OR IGNORE INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i);
      if (match) {
        const table = match[1];
        const colsStr = match[2];
        const cols = colsStr.split(',').map(c => c.trim());
        const valuesStr = match[3];

        let conflictTarget = 'key_value';
        const lowerTable = table.toLowerCase();
        if (lowerTable === 'api_pool') {
          conflictTarget = 'key_value';
        } else if (lowerTable === 'tenants') {
          conflictTarget = 'id';
        }

        converted = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${valuesStr}) ON CONFLICT ("${conflictTarget}") DO NOTHING`;
      }
    }

    // 3. Convert INSERT OR IGNORE (with plain spaces)
    converted = converted.replace(/INSERT OR IGNORE/gi, 'INSERT');

    // 4. Convert SQLite specfic DATETIME / AUTOINCREMENT
    converted = converted.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
    converted = converted.replace(/AUTOINCREMENT/gi, '');

    // 5. Convert SQLite placeholders (?) to Postgres placeholders ($1, $2, ...)
    let index = 1;
    converted = converted.replace(/\?/g, () => `$${index++}`);

    return converted;
  }

  async exec(sql: string) {
    if (this.isSqlite) {
      const sqliteSql = this.translateSqlToSqlite(sql);
      this.sqliteDb.exec(sqliteSql);
    } else {
      const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0);
      for (const q of queries) {
        const pgSql = this.translateSql(q);
        await this.pool!.query(pgSql);
      }
    }
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (this.isSqlite) {
      const sqliteSql = this.translateSqlToSqlite(sql);
      const stmt = this.sqliteDb.prepare(sqliteSql);
      const row = stmt.get(...params);
      return (row as T) || null;
    } else {
      const pgSql = this.translateSql(sql);
      const res = await this.pool!.query(pgSql, params);
      return res.rows[0] || null;
    }
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.isSqlite) {
      const sqliteSql = this.translateSqlToSqlite(sql);
      const stmt = this.sqliteDb.prepare(sqliteSql);
      return stmt.all(...params) as T[];
    } else {
      const pgSql = this.translateSql(sql);
      const res = await this.pool!.query(pgSql, params);
      return res.rows;
    }
  }

  async run(sql: string, params: any[] = []) {
    if (this.isSqlite) {
      const sqliteSql = this.translateSqlToSqlite(sql);
      const stmt = this.sqliteDb.prepare(sqliteSql);
      const info = stmt.run(...params);
      return {
        changes: info.changes || 0,
        lastID: info.lastInsertRowid ? String(info.lastInsertRowid) : null
      };
    } else {
      const pgSql = this.translateSql(sql);
      const res = await this.pool!.query(pgSql, params);
      return {
        changes: res.rowCount || 0,
        lastID: null
      };
    }
  }

  async close() {
    if (this.isSqlite) {
      this.sqliteDb.close();
    } else {
      await this.pool!.end();
    }
  }
}

export function getDb(): DBWrapper {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

export async function initDb() {
  if (dbInstance) return dbInstance;

  const dbClient = process.env.DB_CLIENT || 'postgres';

  if (dbClient === 'sqlite') {
    logger.info("initDb: Opening SQLite database (native)...");
    const sqliteFile = process.env.SQLITE_FILE || './local.sqlite';
    try {
      const db = new DBWrapper('', true, sqliteFile);
      logger.info(`initDb: SQLite database connected successfully at ${sqliteFile}.`);
      dbInstance = db;
    } catch (err) {
      logger.error({ err }, "initDb: CRITICAL ERROR during SQLite database initialization");
      throw err;
    }
  } else {
    logger.info("initDb: Opening PostgreSQL database...");
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL environment variable is required');
    try {
      const db = new DBWrapper(connectionString);
      logger.info("initDb: Database connected successfully.");
      dbInstance = db;
    } catch (err) {
      logger.error({ err }, "initDb: CRITICAL ERROR during PostgreSQL database initialization");
      throw err;
    }
  }

  try {
    const db = dbInstance;
    // Create tables if they don't exist with full columns synchronized
    logger.info("initDb: Executing table creation...");
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT,
        status TEXT,
        plan TEXT,
        mrr INTEGER,
        bg_color TEXT,
        init_letters TEXT,
        trial_ends_at TEXT,
        subscription_status TEXT,
        password TEXT,
        current_period_end TEXT,
        cancel_at_period_end INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tenant_settings (
        tenant_id TEXT PRIMARY KEY,
        country TEXT,
        currency TEXT,
        country_code TEXT,
        phone_number TEXT,
        whatsapp_number TEXT,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        logo_url TEXT,
        currency_symbol TEXT DEFAULT '$',
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS metrics (
        tenant_id TEXT PRIMARY KEY,
        today_sales INTEGER,
        ai_orders_count INTEGER,
        automation_rate INTEGER,
        active_tables INTEGER,
        total_tables INTEGER,
        pending_deliveries INTEGER,
        attention_deliveries INTEGER,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        name TEXT,
        icon TEXT,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        category_id TEXT,
        name TEXT,
        price REAL,
        description TEXT,
        image_url TEXT,
        is_available INTEGER DEFAULT 1,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS pos_orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        table_number TEXT,
        status TEXT,
        total REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS pos_order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        menu_item_id TEXT,
        quantity INTEGER,
        price REAL,
        FOREIGN KEY(order_id) REFERENCES pos_orders(id),
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
      );

      CREATE TABLE IF NOT EXISTS whatsapp_connections (
        tenant_id TEXT PRIMARY KEY,
        status TEXT,
        qr_code TEXT,
        connected_at TEXT,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS whatsapp_orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        customer_phone TEXT,
        items TEXT,
        total REAL,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS ai_config (
        tenant_id TEXT PRIMARY KEY,
        custom_instructions TEXT,
        auto_upselling INTEGER DEFAULT 1,
        reservation_confirmation INTEGER DEFAULT 1,
        loyalty_rewards INTEGER DEFAULT 0,
        identity_prompt TEXT,
        operational_rules TEXT,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS ai_logs (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT,
        role TEXT,
        message TEXT,
        timestamp TEXT,
        automation_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS api_pool (
        key_value TEXT PRIMARY KEY,
        status TEXT DEFAULT 'healthy',
        fail_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_check TEXT
      );

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        interval TEXT,
        max_orders INTEGER,
        features TEXT,
        is_popular INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS global_settings (
        id TEXT PRIMARY KEY,
        grace_period_days INTEGER,
        annual_discount_percent INTEGER
      );

      CREATE TABLE IF NOT EXISTS communication_flows (
        id TEXT PRIMARY KEY,
        title TEXT,
        type TEXT,
        status TEXT,
        description TEXT,
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_tenants (
        user_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        role TEXT DEFAULT 'owner',
        PRIMARY KEY (user_id, tenant_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS payment_gateways (
        id TEXT PRIMARY KEY,
        provider TEXT,
        sandbox_client_id TEXT,
        sandbox_client_secret TEXT,
        live_client_id TEXT,
        live_client_secret TEXT,
        is_sandbox INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        current_period_start TEXT,
        current_period_end TEXT,
        cancel_at_period_end INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        subscription_id TEXT,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'pending',
        paypal_invoice_id TEXT,
        paypal_capture_id TEXT,
        due_date TEXT,
        paid_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_transactions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        invoice_id TEXT,
        gateway TEXT DEFAULT 'paypal',
        type TEXT,
        amount REAL,
        currency TEXT DEFAULT 'USD',
        status TEXT,
        paypal_order_id TEXT,
        paypal_capture_id TEXT,
        paypal_refund_id TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        tenant_id TEXT,
        user_id TEXT,
        user_email TEXT,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        request_id TEXT
      );

      CREATE TABLE IF NOT EXISTS dining_tables (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        table_number TEXT NOT NULL,
        capacity INTEGER,
        qr_code_url TEXT,
        status TEXT DEFAULT 'Available',
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS item_attributes (
        id TEXT PRIMARY KEY,
        menu_item_id TEXT,
        name TEXT NOT NULL,
        options TEXT NOT NULL,
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
      );

      CREATE TABLE IF NOT EXISTS item_extras (
        id TEXT PRIMARY KEY,
        menu_item_id TEXT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
      );

      CREATE TABLE IF NOT EXISTS item_addons (
        id TEXT PRIMARY KEY,
        menu_item_id TEXT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
      );

      CREATE TABLE IF NOT EXISTS kitchen_orders (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        tenant_id TEXT,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS tenant_taxes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tax_rate REAL NOT NULL,
        type TEXT DEFAULT 'Percentage',
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS tenant_coupons (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        discount REAL NOT NULL,
        discount_type TEXT DEFAULT 'Percentage',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        minimum_order REAL DEFAULT 0,
        maximum_discount REAL,
        limit_per_user INTEGER DEFAULT 1,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS tenant_waiters (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        pin TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS tenant_delivery_rules (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        min_distance REAL NOT NULL,
        max_distance REAL NOT NULL,
        delivery_fee REAL NOT NULL,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS whatsapp_chat_history (
        id SERIAL PRIMARY KEY,
        tenant_id TEXT,
        customer_phone TEXT,
        role TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS whatsapp_chat_control (
        tenant_id TEXT,
        customer_phone TEXT,
        is_bot_active INTEGER DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(tenant_id, customer_phone)
      );

      CREATE TABLE IF NOT EXISTS delivery_drivers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        pin TEXT,
        status TEXT DEFAULT 'active',
        is_available INTEGER DEFAULT 1,
        current_lat REAL,
        current_lng REAL,
        total_deliveries INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS delivery_assignments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        driver_id TEXT,
        status TEXT DEFAULT 'pending',
        customer_lat REAL,
        customer_lng REAL,
        customer_phone TEXT,
        distance_km REAL,
        delivery_fee REAL,
        assigned_at TIMESTAMP,
        picked_up_at TIMESTAMP,
        delivered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id),
        FOREIGN KEY(driver_id) REFERENCES delivery_drivers(id)
      );

      CREATE TABLE IF NOT EXISTS cash_drawer_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT,
        event_type TEXT NOT NULL,
        opening_amount REAL DEFAULT 0,
        closing_amount REAL DEFAULT 0,
        expected_amount REAL DEFAULT 0,
        difference REAL DEFAULT 0,
        cash_sales REAL DEFAULT 0,
        card_sales REAL DEFAULT 0,
        transfer_sales REAL DEFAULT 0,
        other_sales REAL DEFAULT 0,
        total_tips REAL DEFAULT 0,
        refunds_total REAL DEFAULT 0,
        notes TEXT,
        opened_at TIMESTAMP,
        closed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS order_payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_status TEXT DEFAULT 'pending',
        tip REAL DEFAULT 0,
        paid_at TIMESTAMP,
        refunded_at TIMESTAMP,
        refund_amount REAL DEFAULT 0,
        refund_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES pos_orders(id),
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );

      CREATE TABLE IF NOT EXISTS split_payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        split_label TEXT,
        amount REAL NOT NULL,
        tip REAL DEFAULT 0,
        payment_method TEXT,
        items TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES pos_orders(id),
        FOREIGN KEY(tenant_id) REFERENCES tenants(id)
      );
    `);

    // WhatsApp contact info cache (names + profile pictures)
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS whatsapp_contacts (
          tenant_id TEXT NOT NULL,
          phone TEXT NOT NULL,
          push_name TEXT,
          profile_pic_url TEXT,
          is_archived INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(tenant_id, phone)
        );
      `);
    } catch (e) {}

    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS ai_providers (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          api_base_url TEXT NOT NULL,
          api_key TEXT,
          is_active INTEGER DEFAULT 0,
          status TEXT DEFAULT 'healthy',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ai_models (
          id TEXT PRIMARY KEY,
          provider_id TEXT NOT NULL,
          model_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          max_output_tokens INTEGER,
          context_window INTEGER,
          is_active INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE
        );
      `);
    } catch (e) {
      logger.error({ err: e }, "initDb: Error creating AI Providers or Models tables");
    }

    try { await db.exec(`ALTER TABLE whatsapp_contacts ADD COLUMN is_archived INTEGER DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN mrr INTEGER DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN bg_color TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN init_letters TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN trial_ends_at TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN subscription_status TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN current_period_end TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN cancel_at_period_end INTEGER DEFAULT 0;`); } catch (e) {}


    try {
      await db.exec(`ALTER TABLE pos_orders ADD COLUMN waiter_id TEXT;`);
    } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN payment_method TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN payment_status TEXT DEFAULT 'pending';`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN order_type TEXT DEFAULT 'dine_in';`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN customer_name TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN tip REAL DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN paid_at TIMESTAMP;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN tax_amount REAL DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN discount_amount REAL DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE delivery_assignments ADD COLUMN expires_at TIMESTAMP;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE delivery_assignments ADD COLUMN driver_token TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE delivery_assignments ADD COLUMN customer_token TEXT;`); } catch (e) {}

    try {
      await db.exec(`ALTER TABLE api_pool ADD COLUMN fail_count INTEGER DEFAULT 0;`);
    } catch (e) {}

    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN opening_time TEXT;`);
    } catch (e) {}
    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN closing_time TEXT;`);
    } catch (e) {}
    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN facebook_url TEXT;`);
    } catch (e) {}
    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN instagram_url TEXT;`);
    } catch (e) {}
    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN min_order_value REAL DEFAULT 0;`);
    } catch (e) {}
    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN latitude REAL;`);
    } catch (e) {}
    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN longitude REAL;`);
    } catch (e) {}

    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN delivery_base_fee REAL DEFAULT 0;`);
    } catch (e) {}
    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN delivery_per_km_fee REAL DEFAULT 0;`);
    } catch (e) {}
    try {
      await db.exec(`ALTER TABLE tenant_settings ADD COLUMN delivery_max_distance REAL DEFAULT 0;`);
    } catch (e) {}
    try { await db.exec(`ALTER TABLE tenant_settings ADD COLUMN currency_symbol TEXT DEFAULT '$';`); } catch (e) {}


    try {
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
      `);
    } catch (e) {}

    // Seed initial plans and communication flows if plans table is empty
    const planCount = await db.get('SELECT COUNT(*) as count FROM plans');
    if (planCount && Number(planCount.count) === 0) {
      logger.info('initDb: Seeding plans and communication flows into PostgreSQL...');
      
      await db.run("INSERT INTO plans (id, name, price, interval, max_orders, features, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?)", 
        ['plan_starter', 'Starter', 29, 'mo', 1000, JSON.stringify(['Hasta 1,000 órdenes', 'Soporte IA Básico', '1 Sucursal']), 0]);
      await db.run("INSERT INTO plans (id, name, price, interval, max_orders, features, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?)", 
        ['plan_pro', 'Professional', 99, 'mo', -1, JSON.stringify(['Órdenes Ilimitadas', 'IA Avanzada (Vision)', 'Hasta 5 Sucursales']), 1]);

      const flows = [
        { id: 'flow_1', title: 'Bienvenida Tenant', type: 'Email + WhatsApp', status: 'Activo', color: 'green', desc: 'Se envía automáticamente cuando un tenant crea su cuenta.' },
        { id: 'flow_2', title: 'Alerta Nivel de IA (80%)', type: 'WhatsApp', status: 'Activo', color: 'green', desc: 'Avisa al restaurante que su cuota de IA está por agotarse.' },
        { id: 'flow_3', title: 'Fallo de Pago', type: 'Email', status: 'Activo', color: 'orange', desc: 'Correos automáticos (Día 1, Día 3, Día 7) por intento fallido.' },
        { id: 'flow_4', title: 'Aviso de Suspensión', type: 'Email + WhatsApp', status: 'Activo', color: 'red', desc: 'Notifica que el bot ha sido apagado por impago.' },
        { id: 'flow_5', title: 'Resumen Semanal', type: 'Email', status: 'Borrador', color: 'slate', desc: 'Reporte de ventas de la semana generado para cada tenant.' },
      ];
      for (const f of flows) {
        await db.run("INSERT INTO communication_flows (id, title, type, status, color, description) VALUES (?, ?, ?, ?, ?, ?)",
          [f.id, f.title, f.type, f.status, f.color, f.desc]);
      }
    }

    // Seed initial AI provider and model if empty
    try {
      const providerCount = await db.get('SELECT COUNT(*) as count FROM ai_providers');
      if (providerCount && Number(providerCount.count) === 0) {
        logger.info('initDb: Seeding default Gemini AI Provider and Model...');
        await db.run(
          "INSERT INTO ai_providers (id, display_name, api_base_url, api_key, is_active) VALUES (?, ?, ?, ?, ?)",
          ['gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com', 'GEMINI_API_KEY', 1]
        );
        await db.run(
          "INSERT INTO ai_models (id, provider_id, model_id, name, description, max_output_tokens, context_window, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          ['gemini:gemini-2.5-flash', 'gemini', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 'Standard fast dynamic model', 8192, 1048576, 1]
        );
      }
    } catch (e) {
      logger.error({ err: e }, "initDb: Error seeding default AI provider");
    }

    dbInstance = db;
    return db;
  } catch (err) {
    logger.error({ err }, "initDb: CRITICAL ERROR during PostgreSQL database initialization");
    throw err;
  }
}
