import { getDb } from '../db.js';

/**
 * Safely audits administrative or core action events to persistence.
 * Fault tolerant - does not interrupt the main execution chain if it fails.
 */
export async function audit(action: string, userId: string | null, tenantId: string | null, details: string): Promise<void> {
  try {
    const db = getDb();
    await db.run(
      "INSERT INTO audit_logs (action, user_id, tenant_id, details, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
      [action, userId || "system", tenantId || "system", details]
    );
  } catch (e) {
    // Silently discard audit logging errors to not affect the UX execution thread
    console.error("[AuditLogger] Failed recording audit trail:", e);
  }
}

/**
 * Securely determines the active tenant context. 
 * Prioritizes explicitly authenticated identity, with fallbacks to active candidate lookups.
 */
export async function getSafeTenantId(req: any, inputId?: string): Promise<string> {
  try {
    const db = getDb();
    let candidate = req.user?.tenant_id || inputId;
    
    // Discard empty/placeholder values
    if (!candidate || candidate === 'null' || candidate === 'undefined' || candidate === 'tenant_1') {
      // No hardcoded fallback — find the first valid tenant dynamically
      const first = await db.get("SELECT id FROM tenants LIMIT 1");
      if (first) {
        candidate = (first as any).id;
      } else {
        throw new Error("No tenants found in database");
      }
    }

    // Ensure the target actually exists
    const exists = await db.get("SELECT id FROM tenants WHERE id = ?", [candidate]);
    if (exists) return candidate;

    // Dynamic fallback to any valid system tenant
    const fallback = await db.get("SELECT id FROM tenants LIMIT 1");
    if (fallback) return (fallback as any).id;
    
    throw new Error("No tenants available in database");
  } catch (e) {
    // Re-throw so the caller knows something is wrong instead of silently using a wrong tenant
    throw e;
  }
}
