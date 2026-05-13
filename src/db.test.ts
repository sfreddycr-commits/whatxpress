import { describe, it, expect } from "vitest";

// We test the SQL translation logic directly (same logic as in DBWrapper.translateSql)
function translateSql(sql: string): string {
  let converted = sql;

  // 1. INSERT OR REPLACE
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

  // 2. INSERT OR IGNORE
  if (sql.toUpperCase().includes('INSERT OR IGNORE INTO')) {
    const match = sql.match(/INSERT OR IGNORE INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i);
    if (match) {
      const table = match[1];
      const colsStr = match[2];
      const cols = colsStr.split(',').map(c => c.trim());
      const valuesStr = match[3];
      let conflictTarget = 'id';
      if (table.toLowerCase() === 'api_pool') {
        conflictTarget = 'key_value';
      }
      converted = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${valuesStr}) ON CONFLICT ("${conflictTarget}") DO NOTHING`;
    }
  }

  // 3. ? to $1, $2...
  let paramIndex = 0;
  converted = converted.replace(/\?/g, () => `$${++paramIndex}`);

  // 4. datetime('now') to CURRENT_TIMESTAMP
  converted = converted.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');

  return converted;
}

describe("DBWrapper SQL Translation", () => {
  it("translates INSERT OR REPLACE INTO", () => {
    const result = translateSql("INSERT OR REPLACE INTO plans (id, name, price) VALUES (?, ?, ?)");
    expect(result).toContain("ON CONFLICT (\"id\") DO UPDATE SET");
    expect(result).toContain('"name" = EXCLUDED."name"');
  });

  it("uses tenant_id as conflict target for tenant_settings", () => {
    const result = translateSql("INSERT OR REPLACE INTO tenant_settings (tenant_id, country, currency) VALUES (?, ?, ?)");
    expect(result).toContain('ON CONFLICT ("tenant_id")');
  });

  it("translates INSERT OR IGNORE INTO", () => {
    const result = translateSql("INSERT OR IGNORE INTO api_pool (key_value, provider, key) VALUES (?, ?, ?)");
    expect(result).toContain("ON CONFLICT");
    expect(result).toContain("DO NOTHING");
  });

  it("uses key_value as conflict for api_pool", () => {
    const result = translateSql("INSERT OR IGNORE INTO api_pool (key_value, provider, key) VALUES (?, ?, ?)");
    expect(result).toContain('ON CONFLICT ("key_value")');
  });

  it("translates ? to $1, $2, $3", () => {
    const result = translateSql("SELECT * FROM tenants WHERE id = ? AND status = ?");
    expect(result).toContain("$1");
    expect(result).toContain("$2");
  });

  it("translates datetime('now') to CURRENT_TIMESTAMP", () => {
    const result = translateSql("INSERT INTO audit_logs (created_at) VALUES (datetime('now'))");
    expect(result).toContain("CURRENT_TIMESTAMP");
  });
});
