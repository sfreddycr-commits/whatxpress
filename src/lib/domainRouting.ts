export function isAppDomain(hostname: string): boolean {
  return hostname === "app.whatxpress.com";
}

export function isMarketingDomain(hostname: string): boolean {
  return hostname === "whatxpress.com" || hostname === "www.whatxpress.com";
}

export const APP_ROUTES = ["/login", "/dashboard", "/admin", "/driver"];

export function isAppRoute(pathname: string): boolean {
  return (
    APP_ROUTES.includes(pathname) ||
    pathname.startsWith("/order/") ||
    pathname.startsWith("/d/") ||
    pathname.startsWith("/t/")
  );
}

/**
 * Decides whether a request on `hostname` for `pathname` should be
 * redirected to the app subdomain (https://app.whatxpress.com/...).
 *
 * Current behavior: never redirect. All routes work on the root domain
 * (https://whatxpress.com). Kept as a function (not a constant) to
 * preserve the architectural seam in case multi-domain routing is
 * reintroduced later.
 */
export function shouldRedirectToApp(hostname: string, pathname: string): boolean {
  return false;
}
