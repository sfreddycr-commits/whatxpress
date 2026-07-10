import mysql from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';
import { logger } from './lib/logger.js';

let dbInstance: any = null;

type DriverType = 'mysql' | 'sqlite' | 'postgres';

export class DBWrapper {
  private poolMysql: mysql.Pool | null = null;
  private sqliteDb: any = null;
  private driver: DriverType;

  constructor(opts: { driver: DriverType; connectionString?: string; sqliteFile?: string }) {
    this.driver = opts.driver;
    if (opts.driver === 'sqlite') {
      this.sqliteDb = new DatabaseSync(opts.sqliteFile || './local.sqlite');
    } else if (opts.driver === 'mysql') {
      // Parse mysql://user:pass@host:port/db
      const cs = opts.connectionString || '';
      const match = cs.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (match) {
        const [, user, password, host, port, database] = match;
        this.poolMysql = mysql.createPool({
          host,
          port: Number(port),
          user,
          password,
          database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          multipleStatements: false,
        });
      } else {
        // Fallback: use as-is (assumes env vars MYSQL_HOST etc)
        this.poolMysql = mysql.createPool({
          uri: cs,
          waitForConnections: true,
          connectionLimit: 10,
        });
      }
    } else {
      throw new Error(`Driver ${opts.driver} not supported in this build`);
    }
  }

  private translateSqlToMysql(sql: string): string {
    let converted = sql;

    // 1. Convert INSERT OR REPLACE INTO → INSERT ... ON DUPLICATE KEY UPDATE
    if (sql.toUpperCase().includes('INSERT OR REPLACE INTO')) {
      const match = sql.match(/INSERT OR REPLACE INTO\s+`?(\w+)`?\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i);
      if (match) {
        const table = match[1];
        const colsStr = match[2];
        const cols = colsStr.split(',').map(c => c.trim().replace(/`/g, ''));
        const valuesStr = match[3];
        const updateClause = cols
          .map(c => `\`${c}\` = VALUES(\`${c}\`)`)
          .join(', ');
        converted = `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${valuesStr}) ON DUPLICATE KEY UPDATE ${updateClause}`;
      }
    }

    // 2. Convert INSERT OR IGNORE → INSERT IGNORE
    converted = converted.replace(/INSERT OR IGNORE INTO/gi, 'INSERT IGNORE INTO');
    converted = converted.replace(/INSERT OR IGNORE/gi, 'INSERT IGNORE');

    // 3. Convert SERIAL PRIMARY KEY → INT AUTO_INCREMENT PRIMARY KEY
    converted = converted.replace(/SERIAL PRIMARY KEY/gi, 'INT AUTO_INCREMENT PRIMARY KEY');

    // 4. Convert datetime('now') → CURRENT_TIMESTAMP (already in PG)
    converted = converted.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');

    // 5. Convert $1, $2, ... to ?
    let index = 1;
    converted = converted.replace(/\$\d+/g, () => '?');

    // 6. Remove AUTOINCREMENT (MySQL uses AUTO_INCREMENT)
    converted = converted.replace(/AUTOINCREMENT/gi, 'AUTO_INCREMENT');

    // 7. Convert boolean integer checks (MySQL uses TINYINT(1))
    // No changes needed for TEXT/INTEGER types

    return converted;
  }

  private translateSqlToSqlite(sql: string): string {
    return sql.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  }

  private translateSql(sql: string): string {
    if (this.driver === 'mysql') {
      return this.translateSqlToMysql(sql);
    }
    if (this.driver === 'sqlite') {
      return this.translateSqlToSqlite(sql);
    }
    return sql;
  }

  async exec(sql: string) {
    if (this.driver === 'sqlite') {
      const sqliteSql = this.translateSqlToSqlite(sql);
      this.sqliteDb.exec(sqliteSql);
    } else if (this.driver === 'mysql') {
      const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0);
      for (const q of queries) {
        const mySql = this.translateSqlToMysql(q);
        await this.poolMysql!.query(mySql);
      }
    }
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (this.driver === 'sqlite') {
      const sqliteSql = this.translateSqlToSqlite(sql);
      const stmt = this.sqliteDb.prepare(sqliteSql);
      const row = stmt.get(...params);
      return (row as T) || null;
    } else if (this.driver === 'mysql') {
      const mySql = this.translateSqlToMysql(sql);
      const [rows] = await this.poolMysql!.query(mySql, params);
      const arr = rows as any[];
      return (arr[0] as T) || null;
    }
    return null;
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.driver === 'sqlite') {
      const sqliteSql = this.translateSqlToSqlite(sql);
      const stmt = this.sqliteDb.prepare(sqliteSql);
      return stmt.all(...params) as T[];
    } else if (this.driver === 'mysql') {
      const mySql = this.translateSqlToMysql(sql);
      const [rows] = await this.poolMysql!.query(mySql, params);
      return rows as T[];
    }
    return [];
  }

  async run(sql: string, params: any[] = []) {
    if (this.driver === 'sqlite') {
      const sqliteSql = this.translateSqlToSqlite(sql);
      const stmt = this.sqliteDb.prepare(sqliteSql);
      const info = stmt.run(...params);
      return {
        changes: info.changes || 0,
        lastID: info.lastInsertRowid ? String(info.lastInsertRowid) : null
      };
    } else if (this.driver === 'mysql') {
      const mySql = this.translateSqlToMysql(sql);
      const [result] = await this.poolMysql!.query(mySql, params);
      const r = result as mysql.ResultSetHeader;
      return {
        changes: r.affectedRows || 0,
        lastID: r.insertId ? String(r.insertId) : null
      };
    }
    return { changes: 0, lastID: null };
  }

  async close() {
    if (this.driver === 'sqlite') {
      this.sqliteDb.close();
    } else if (this.driver === 'mysql') {
      await this.poolMysql!.end();
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

  const dbClient = process.env.DB_CLIENT || 'mysql';

  if (dbClient === 'sqlite') {
    logger.info("initDb: Opening SQLite database (native)...");
    const sqliteFile = process.env.SQLITE_FILE || './local.sqlite';
    try {
      const db = new DBWrapper({ driver: 'sqlite', sqliteFile });
      logger.info(`initDb: SQLite database connected successfully at ${sqliteFile}.`);
      dbInstance = db;
    } catch (err) {
      logger.error({ err }, "initDb: CRITICAL ERROR during SQLite database initialization");
      throw err;
    }
  } else if (dbClient === 'mysql') {
    logger.info("initDb: Opening MySQL database...");
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL environment variable is required');
    try {
      const db = new DBWrapper({ driver: 'mysql', connectionString });
      logger.info("initDb: MySQL database connected successfully.");
      dbInstance = db;
    } catch (err) {
      logger.error({ err }, "initDb: CRITICAL ERROR during MySQL database initialization");
      throw err;
    }
  } else {
    throw new Error(`Unsupported DB_CLIENT: ${dbClient}. Use 'mysql' or 'sqlite'.`);
  }

  try {
    const db = dbInstance;
    // Create tables if they don't exist with full columns synchronized (MySQL syntax)
    logger.info("initDb: Executing table creation...");
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(64) PRIMARY KEY,
        name TEXT,
        status TEXT,
        plan TEXT,
        mrr INT DEFAULT 0,
        bg_color TEXT,
        init_letters TEXT,
        trial_ends_at TEXT,
        subscription_status TEXT,
        password TEXT,
        current_period_end TEXT,
        cancel_at_period_end INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tenant_settings (
        tenant_id VARCHAR(64) PRIMARY KEY,
        country TEXT,
        currency TEXT,
        country_code TEXT,
        phone_number TEXT,
        whatsapp_number TEXT,
        smtp_host TEXT,
        smtp_port INT,
        smtp_user TEXT,
        smtp_pass TEXT,
        logo_url TEXT,
        currency_symbol VARCHAR(64) DEFAULT '$',
        opening_time TEXT,
        closing_time TEXT,
        facebook_url TEXT,
        instagram_url TEXT,
        min_order_value REAL DEFAULT 0,
        latitude REAL,
        longitude REAL,
        delivery_base_fee REAL DEFAULT 0,
        delivery_per_km_fee REAL DEFAULT 0,
        delivery_max_distance REAL DEFAULT 0,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS metrics (
        tenant_id VARCHAR(64) PRIMARY KEY,
        today_sales INT,
        ai_orders_count INT,
        automation_rate INT,
        active_tables INT,
        total_tables INT,
        pending_deliveries INT,
        attention_deliveries INT,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64),
        name TEXT,
        icon TEXT,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64),
        category_id VARCHAR(64),
        name TEXT,
        price REAL,
        description TEXT,
        image_url TEXT,
        is_available INT DEFAULT 1,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pos_orders (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64),
        table_number TEXT,
        status TEXT,
        total REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        waiter_id TEXT,
        payment_method TEXT,
        payment_status VARCHAR(64) DEFAULT 'pending',
        order_type VARCHAR(64) DEFAULT 'dine_in',
        customer_name TEXT,
        tip REAL DEFAULT 0,
        paid_at TIMESTAMP,
        tax_amount REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pos_order_items (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64),
        menu_item_id VARCHAR(64),
        quantity INT,
        price REAL,
        FOREIGN KEY(order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS whatsapp_connections (
        tenant_id VARCHAR(64) PRIMARY KEY,
        status TEXT,
        qr_code TEXT,
        connected_at TEXT,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS whatsapp_orders (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64),
        customer_phone TEXT,
        items TEXT,
        total REAL,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_config (
        tenant_id VARCHAR(64) PRIMARY KEY,
        custom_instructions TEXT,
        auto_upselling INT DEFAULT 1,
        reservation_confirmation INT DEFAULT 1,
        loyalty_rewards INT DEFAULT 0,
        identity_prompt TEXT,
        operational_rules TEXT,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id VARCHAR(64),
        role TEXT,
        message TEXT,
        timestamp TEXT,
        automation_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS api_pool (
        key_value VARCHAR(255) PRIMARY KEY,
        status VARCHAR(64) DEFAULT 'healthy',
        fail_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_check TEXT
      );

      CREATE TABLE IF NOT EXISTS plans (
        id VARCHAR(64) PRIMARY KEY,
        name TEXT,
        price REAL,
        \`interval\` TEXT,
        max_orders INT,
        features TEXT,
        is_popular INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS global_settings (
        id VARCHAR(64) PRIMARY KEY,
        grace_period_days INT,
        annual_discount_percent INT
      );

      CREATE TABLE IF NOT EXISTS communication_flows (
        id VARCHAR(64) PRIMARY KEY,
        title TEXT,
        type TEXT,
        status TEXT,
        description TEXT,
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name TEXT NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        role VARCHAR(64) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_tenants (
        user_id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL,
        role VARCHAR(64) DEFAULT 'owner',
        PRIMARY KEY (user_id, tenant_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS payment_gateways (
        id VARCHAR(64) PRIMARY KEY,
        provider TEXT,
        sandbox_client_id TEXT,
        sandbox_client_secret TEXT,
        live_client_id TEXT,
        live_client_secret TEXT,
        is_sandbox INT DEFAULT 1,
        is_active INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        plan_id VARCHAR(64) NOT NULL,
        status VARCHAR(64) DEFAULT 'active',
        current_period_start TEXT,
        current_period_end TEXT,
        cancel_at_period_end INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        subscription_id VARCHAR(64),
        amount REAL NOT NULL,
        currency VARCHAR(64) DEFAULT 'USD',
        status VARCHAR(64) DEFAULT 'pending',
        paypal_invoice_id TEXT,
        paypal_capture_id TEXT,
        due_date TEXT,
        paid_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS payment_transactions (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        invoice_id VARCHAR(64),
        gateway VARCHAR(64) DEFAULT 'paypal',
        type TEXT,
        amount REAL,
        currency VARCHAR(64) DEFAULT 'USD',
        status TEXT,
        paypal_order_id TEXT,
        paypal_capture_id TEXT,
        paypal_refund_id TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        tenant_id VARCHAR(64),
        user_id VARCHAR(64),
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
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64),
        table_number TEXT NOT NULL,
        capacity INT,
        qr_code_url TEXT,
        status VARCHAR(64) DEFAULT 'Available',
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS item_attributes (
        id VARCHAR(64) PRIMARY KEY,
        menu_item_id VARCHAR(64),
        name TEXT NOT NULL,
        options TEXT NOT NULL,
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS item_extras (
        id VARCHAR(64) PRIMARY KEY,
        menu_item_id VARCHAR(64),
        name TEXT NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS item_addons (
        id VARCHAR(64) PRIMARY KEY,
        menu_item_id VARCHAR(64),
        name TEXT NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS kitchen_orders (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64),
        tenant_id VARCHAR(64),
        item_name TEXT NOT NULL,
        quantity INT NOT NULL,
        status VARCHAR(64) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tenant_taxes (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        name TEXT NOT NULL,
        tax_rate REAL NOT NULL,
        type VARCHAR(64) DEFAULT 'Percentage',
        status VARCHAR(64) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tenant_coupons (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        name TEXT NOT NULL,
        code VARCHAR(64) UNIQUE NOT NULL,
        discount REAL NOT NULL,
        discount_type VARCHAR(64) DEFAULT 'Percentage',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        minimum_order REAL DEFAULT 0,
        maximum_discount REAL,
        limit_per_user INT DEFAULT 1,
        status VARCHAR(64) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tenant_waiters (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        name TEXT NOT NULL,
        pin TEXT NOT NULL,
        status VARCHAR(64) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tenant_delivery_rules (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        name TEXT NOT NULL,
        min_distance REAL NOT NULL,
        max_distance REAL NOT NULL,
        delivery_fee REAL NOT NULL,
        status VARCHAR(64) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS whatsapp_chat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id VARCHAR(64),
        customer_phone TEXT,
        role TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS whatsapp_chat_control (
        tenant_id VARCHAR(64),
        customer_phone VARCHAR(64),
        is_bot_active INT DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(tenant_id, customer_phone)
      );

      CREATE TABLE IF NOT EXISTS delivery_drivers (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        pin TEXT,
        status VARCHAR(64) DEFAULT 'active',
        is_available INT DEFAULT 1,
        current_lat REAL,
        current_lng REAL,
        total_deliveries INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS delivery_assignments (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        order_id VARCHAR(64) NOT NULL,
        driver_id VARCHAR(64),
        status VARCHAR(64) DEFAULT 'pending',
        customer_lat REAL,
        customer_lng REAL,
        customer_phone TEXT,
        distance_km REAL,
        delivery_fee REAL,
        assigned_at TIMESTAMP,
        picked_up_at TIMESTAMP,
        delivered_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        driver_token TEXT,
        customer_token TEXT,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY(driver_id) REFERENCES delivery_drivers(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS cash_drawer_events (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64),
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
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS order_payments (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_status VARCHAR(64) DEFAULT 'pending',
        tip REAL DEFAULT 0,
        paid_at TIMESTAMP,
        refunded_at TIMESTAMP,
        refund_amount REAL DEFAULT 0,
        refund_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS split_payments (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(64) NOT NULL,
        split_label TEXT,
        amount REAL NOT NULL,
        tip REAL DEFAULT 0,
        payment_method TEXT,
        items TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
        FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);

    // WhatsApp contact info cache (names + profile pictures)
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS whatsapp_contacts (
          tenant_id VARCHAR(64) NOT NULL,
          phone TEXT NOT NULL,
          push_name TEXT,
          profile_pic_url TEXT,
          is_archived INT DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(tenant_id, phone)
        );
      `);
    } catch (e) {}

    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS ai_providers (
          id VARCHAR(64) PRIMARY KEY,
          display_name TEXT NOT NULL,
          api_base_url TEXT NOT NULL,
          api_key TEXT,
          is_active INT DEFAULT 0,
          status VARCHAR(64) DEFAULT 'healthy',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ai_models (
          id VARCHAR(64) PRIMARY KEY,
          provider_id VARCHAR(64) NOT NULL,
          model_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          max_output_tokens INT,
          context_window INT,
          is_active INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE
        );
      `);
    } catch (e) {
      logger.error({ err: e }, "initDb: Error creating AI Providers or Models tables");
    }

    try { await db.exec(`ALTER TABLE whatsapp_contacts ADD COLUMN is_archived INT DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN mrr INT DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN bg_color TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN init_letters TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN trial_ends_at TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN subscription_status TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN current_period_end TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE tenants ADD COLUMN cancel_at_period_end INT DEFAULT 0;`); } catch (e) {}


    try {
      await db.exec(`ALTER TABLE pos_orders ADD COLUMN waiter_id TEXT;`);
    } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN payment_method TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN payment_status VARCHAR(64) DEFAULT 'pending';`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN order_type VARCHAR(64) DEFAULT 'dine_in';`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN customer_name TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN tip REAL DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN paid_at TIMESTAMP;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN tax_amount REAL DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE pos_orders ADD COLUMN discount_amount REAL DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE delivery_assignments ADD COLUMN expires_at TIMESTAMP;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE delivery_assignments ADD COLUMN driver_token TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE delivery_assignments ADD COLUMN customer_token TEXT;`); } catch (e) {}

    try {
      await db.exec(`ALTER TABLE api_pool ADD COLUMN fail_count INT DEFAULT 0;`);
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
    try { await db.exec(`ALTER TABLE tenant_settings ADD COLUMN currency_symbol VARCHAR(64) DEFAULT '$';`); } catch (e) {}


    try {
      await db.exec(`
        CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
        CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
        CREATE INDEX idx_audit_user ON audit_logs(user_id);
      `);
    } catch (e) {}

    // Seed initial plans and communication flows if plans table is empty
    const planCount = await db.get('SELECT COUNT(*) as count FROM plans');
    if (planCount && Number(planCount.count) === 0) {
      logger.info('initDb: Seeding plans and communication flows into MySQL...');

      await db.run("INSERT INTO plans (id, name, price, `interval`, max_orders, features, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ['plan_starter', 'Starter', 29, 'mo', 1000, JSON.stringify(['Hasta 1,000 órdenes', 'Soporte IA Básico', '1 Sucursal']), 0]);
      await db.run("INSERT INTO plans (id, name, price, `interval`, max_orders, features, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
    logger.error({ err }, "initDb: CRITICAL ERROR during MySQL database initialization");
    throw err;
  }
}
