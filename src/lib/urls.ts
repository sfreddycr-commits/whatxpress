/**
 * Base URL for absolute links in outbound communications (emails, etc.).
 *
 * Architecture decision: single-domain setup. The app is served from
 * https://whatxpress.com for everything — marketing, login, dashboard,
 * admin, driver views. There is no app.whatxpress.com subdomain in use.
 *
 * In-page navigation should use relative paths (e.g. `/login`, `/dashboard`)
 * so the code stays deployment-agnostic. Use this constant only when an
 * absolute URL is required (email CTAs, OAuth callbacks, webhooks).
 *
 * If the multi-domain split is reintroduced later (app.whatxpress.com for
 * app routes, whatxpress.com for marketing), update this constant and
 * re-enable the redirect logic in src/lib/domainRouting.ts.
 */
export const APP_BASE_URL = "https://whatxpress.com";

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE_URL}${normalized}`;
}
