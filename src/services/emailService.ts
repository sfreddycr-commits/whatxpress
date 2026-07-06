import nodemailer from "nodemailer";
import { logger } from "../lib/logger.js";
import { absoluteUrl } from "../lib/urls.js";

let defaultTransporter: nodemailer.Transporter | null = null;

function getDefaultTransporter(): nodemailer.Transporter {
  if (!defaultTransporter) {
    defaultTransporter = nodemailer.createTransport({
      host: "localhost",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "admin@vitruspm.com",
        pass: process.env.SMTP_PASS || "",
      },
      tls: { rejectUnauthorized: false },
    });
  }
  return defaultTransporter;
}

function getTenantTransporter(smtp: {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
}): nodemailer.Transporter {
  if (smtp.smtp_host && smtp.smtp_user) {
    return nodemailer.createTransport({
      host: smtp.smtp_host,
      port: smtp.smtp_port || 587,
      secure: false,
      auth: {
        user: smtp.smtp_user,
        pass: smtp.smtp_pass || "",
      },
      tls: { rejectUnauthorized: false },
    });
  }
  return getDefaultTransporter();
}

const baseEmailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff">
  <tr><td style="padding:20px;text-align:center;background:#109e38">
    <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px">What<span style="color:#000">xpress</span></span>
  </td></tr>
  <tr><td style="padding:28px 20px">
    ${content}
  </td></tr>
  <tr><td style="padding:16px 20px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="font-size:11px;color:#94a3b8;margin:0">WhatXpress — Restaurant OS<br>© ${new Date().getFullYear()} Todos los derechos reservados.</p>
  </td></tr>
</table>
</body>
</html>`;

export async function sendWelcomeEmail(
  to: string,
  tenantName: string,
  planName: string,
  smtp?: any
): Promise<boolean> {
  const transporter = smtp ? getTenantTransporter(smtp) : getDefaultTransporter();
  try {
    await transporter.sendMail({
      from: '"WhatXpress" <noreply@vitruspm.com>',
      to,
      subject: `🎉 ¡Bienvenido a WhatXpress, ${tenantName}!`,
      html: baseEmailWrapper(`
        <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 8px">¡Bienvenido, ${tenantName}!</h1>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">Tu restaurante ya está configurado con el plan <strong>${planName}</strong>. Comienza a recibir pedidos por WhatsApp, gestionar tu menú y hacer crecer tu negocio.</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <a href="${absoluteUrl('/login')}" style="display:inline-block;padding:12px 32px;background:#109e38;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">Ir al Dashboard</a>
        </td></tr></table>
        <p style="font-size:12px;color:#94a3b8;margin:20px 0 0">¿Preguntas? Responde este correo o escríbenos por WhatsApp.</p>
      `),
    });
    return true;
  } catch (e) {
    logger.error({ err: e }, "[emailService] sendWelcomeEmail failed");
    return false;
  }
}

export async function sendReceiptEmail(
  to: string,
  tenantName: string,
  amount: number,
  currency: string,
  planName: string,
  transactionId: string,
  smtp?: any
): Promise<boolean> {
  const transporter = smtp ? getTenantTransporter(smtp) : getDefaultTransporter();
  try {
    const date = new Date().toLocaleDateString("es-CR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    await transporter.sendMail({
      from: '"WhatXpress Facturación" <noreply@vitruspm.com>',
      to,
      subject: `🧾 Recibo de pago — ${planName}`,
      html: baseEmailWrapper(`
        <h1 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">Recibo de Pago</h1>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px">${date}</p>
        <table width="100%" cellpadding="12" cellspacing="0" style="background:#f1f5f9;border-radius:12px">
          <tr><td style="font-size:13px;color:#475569;font-weight:600">Plan</td><td style="text-align:right;font-size:13px;color:#0f172a;font-weight:600">${planName}</td></tr>
          <tr><td style="font-size:13px;color:#475569">Monto</td><td style="text-align:right;font-size:13px;color:#0f172a;font-weight:700">${currency} ${amount.toFixed(2)}</td></tr>
          <tr><td style="font-size:11px;color:#94a3b8">Transacción</td><td style="text-align:right;font-size:11px;color:#94a3b8">${transactionId}</td></tr>
        </table>
        <p style="font-size:12px;color:#10b981;font-weight:600;margin:16px 0 0">✅ Pago confirmado</p>
      `),
    });
    return true;
  } catch (e) {
    logger.error({ err: e }, "[emailService] sendReceiptEmail failed");
    return false;
  }
}

export async function sendTrialEndingEmail(
  to: string,
  tenantName: string,
  daysLeft: number,
  smtp?: any
): Promise<boolean> {
  const transporter = smtp ? getTenantTransporter(smtp) : getDefaultTransporter();
  try {
    const urgency = daysLeft <= 2 ? "#ef4444" : "#f59e0b";
    await transporter.sendMail({
      from: '"WhatXpress" <noreply@vitruspm.com>',
      to,
      subject: `⏳ Tu prueba gratuita vence en ${daysLeft} día${daysLeft > 1 ? "s" : ""}`,
      html: baseEmailWrapper(`
        <h1 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">Tu prueba gratuita está por terminar</h1>
        <div style="display:inline-block;padding:6px 16px;background:${urgency}15;color:${urgency};border-radius:20px;font-size:13px;font-weight:700;margin:12px 0">Quedan ${daysLeft} día${daysLeft > 1 ? "s" : ""}</div>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:16px 0">${tenantName}, no pierdas el acceso a pedidos por WhatsApp, menú digital y todas las herramientas que hacen crecer tu restaurante.</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <a href="${absoluteUrl('/login')}" style="display:inline-block;padding:12px 32px;background:#109e38;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">Actualizar a Pro — $99/mes</a>
        </td></tr></table>
        <p style="font-size:12px;color:#94a3b8;margin:16px 0 0">Si ya realizaste el pago, ignora este mensaje.</p>
      `),
    });
    return true;
  } catch (e) {
    logger.error({ err: e }, "[emailService] sendTrialEndingEmail failed");
    return false;
  }
}

export async function sendRenewedEmail(
  to: string,
  tenantName: string,
  planName: string,
  nextDate: string,
  smtp?: any
): Promise<boolean> {
  const transporter = smtp ? getTenantTransporter(smtp) : getDefaultTransporter();
  try {
    await transporter.sendMail({
      from: '"WhatXpress Facturación" <noreply@vitruspm.com>',
      to,
      subject: `✅ Tu plan ${planName} fue renovado`,
      html: baseEmailWrapper(`
        <h1 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">¡Renovación exitosa!</h1>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px">${tenantName}, tu plan <strong>${planName}</strong> fue renovado automáticamente. Tu próxima renovación será el <strong>${nextDate}</strong>.</p>
        <div style="padding:12px 16px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0">
          <span style="font-size:13px;color:#166534;font-weight:600">✅ Todo listo — tus servicios continúan activos.</span>
        </div>
      `),
    });
    return true;
  } catch (e) {
    logger.error({ err: e }, "[emailService] sendRenewedEmail failed");
    return false;
  }
}

export async function sendPaymentFailedEmail(
  to: string,
  tenantName: string,
  amount: number,
  currency: string,
  smtp?: any
): Promise<boolean> {
  const transporter = smtp ? getTenantTransporter(smtp) : getDefaultTransporter();
  try {
    await transporter.sendMail({
      from: '"WhatXpress Facturación" <noreply@vitruspm.com>',
      to,
      subject: `⚠️ Pago fallido — ${currency} ${amount.toFixed(2)}`,
      html: baseEmailWrapper(`
        <h1 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">Tu pago no pudo procesarse</h1>
        <div style="display:inline-block;padding:6px 16px;background:#fef2f2;color:#ef4444;border-radius:20px;font-size:13px;font-weight:700;margin:12px 0">${currency} ${amount.toFixed(2)} — Fallido</div>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:16px 0">${tenantName}, el cobro automático de tu plan no pudo completarse. Por favor actualiza tu método de pago para evitar la suspensión del servicio.</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <a href="${absoluteUrl('/login')}" style="display:inline-block;padding:12px 32px;background:#ef4444;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px">Actualizar Método de Pago</a>
        </td></tr></table>
        <p style="font-size:12px;color:#94a3b8;margin:16px 0 0">Reintentaremos automáticamente en los próximos días. Si necesitas ayuda, responde este correo.</p>
      `),
    });
    return true;
  } catch (e) {
    logger.error({ err: e }, "[emailService] sendPaymentFailedEmail failed");
    return false;
  }
}
