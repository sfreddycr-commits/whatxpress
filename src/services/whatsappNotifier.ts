/**
 * WhatsApp Notification Service
 * Sends automated WhatsApp messages to customers using existing connections.
 */
import { logger } from '../lib/logger.js';

// Access the connections store from whatsappService
// We use a simple approach: try to get the existing socket connection
const connections: Record<string, any> = {};

// This will be called by whatsappService to register connections
export function registerConnection(tenantId: string, sock: any) {
  connections[tenantId] = sock;
}

export function unregisterConnection(tenantId: string) {
  delete connections[tenantId];
}

/**
 * Send a notification message to a customer via WhatsApp
 */
export async function sendWhatsAppNotification(tenantId: string, customerPhone: string, message: string): Promise<boolean> {
  // Try to get the connection from the whatsappService connections
  // Since they share the same process, we can access it via global
  let sock = connections[tenantId];
  
  // Fallback: try global connections store
  if (!sock && (global as any).__waConnections) {
    sock = (global as any).__waConnections[tenantId];
  }
  
  if (!sock) {
    logger.warn({ tenantId }, "[WhatsApp Notifier] No active connection for tenant, cannot send notification");
    return false;
  }

  try {
    await sock.sendMessage(customerPhone, { text: message });
    logger.info({ tenantId, to: customerPhone.substring(0, 10) }, "[WhatsApp Notifier] Notification sent");
    return true;
  } catch (err) {
    logger.error({ err, tenantId }, "[WhatsApp Notifier] Failed to send notification");
    return false;
  }
}
