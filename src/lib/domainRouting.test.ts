import { describe, it, expect } from "vitest";
import {
  shouldRedirectToApp,
  isAppDomain,
  isMarketingDomain,
  isAppRoute,
} from "./domainRouting";

describe("domainRouting", () => {
  describe("shouldRedirectToApp", () => {
    it("does NOT redirect /login from whatxpress.com to app subdomain", () => {
      expect(shouldRedirectToApp("whatxpress.com", "/login")).toBe(false);
    });

    it("does NOT redirect /dashboard from whatxpress.com", () => {
      expect(shouldRedirectToApp("whatxpress.com", "/dashboard")).toBe(false);
    });

    it("does NOT redirect /admin from www.whatxpress.com", () => {
      expect(shouldRedirectToApp("www.whatxpress.com", "/admin")).toBe(false);
    });

    it("does NOT redirect /driver from whatxpress.com", () => {
      expect(shouldRedirectToApp("whatxpress.com", "/driver")).toBe(false);
    });

    it("does NOT redirect /order/:id from whatxpress.com", () => {
      expect(shouldRedirectToApp("whatxpress.com", "/order/abc123")).toBe(false);
    });

    it("does NOT redirect /d/:token from whatxpress.com", () => {
      expect(shouldRedirectToApp("whatxpress.com", "/d/xyz")).toBe(false);
    });

    it("does NOT redirect even from app subdomain (single domain policy)", () => {
      expect(shouldRedirectToApp("app.whatxpress.com", "/login")).toBe(false);
    });
  });

  describe("isAppDomain", () => {
    it("identifies app.whatxpress.com as the app domain", () => {
      expect(isAppDomain("app.whatxpress.com")).toBe(true);
    });
    it("does not identify the root domain as app domain", () => {
      expect(isAppDomain("whatxpress.com")).toBe(false);
    });
    it("does not identify www subdomain as app domain", () => {
      expect(isAppDomain("www.whatxpress.com")).toBe(false);
    });
  });

  describe("isMarketingDomain", () => {
    it("identifies whatxpress.com", () => {
      expect(isMarketingDomain("whatxpress.com")).toBe(true);
    });
    it("identifies www.whatxpress.com", () => {
      expect(isMarketingDomain("www.whatxpress.com")).toBe(true);
    });
    it("rejects other domains", () => {
      expect(isMarketingDomain("example.com")).toBe(false);
      expect(isMarketingDomain("app.whatxpress.com")).toBe(false);
    });
  });

  describe("isAppRoute", () => {
    it("identifies /login, /dashboard, /admin, /driver as app routes", () => {
      expect(isAppRoute("/login")).toBe(true);
      expect(isAppRoute("/dashboard")).toBe(true);
      expect(isAppRoute("/admin")).toBe(true);
      expect(isAppRoute("/driver")).toBe(true);
    });
    it("identifies /order/, /d/, /t/ prefixed routes", () => {
      expect(isAppRoute("/order/foo")).toBe(true);
      expect(isAppRoute("/d/abc")).toBe(true);
      expect(isAppRoute("/t/xyz")).toBe(true);
    });
    it("does not identify /, /pricing, or other paths as app routes", () => {
      expect(isAppRoute("/")).toBe(false);
      expect(isAppRoute("/pricing")).toBe(false);
      expect(isAppRoute("/blog")).toBe(false);
    });
  });
});
