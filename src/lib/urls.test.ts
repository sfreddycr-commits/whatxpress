import { describe, it, expect } from "vitest";
import { APP_BASE_URL, absoluteUrl } from "./urls";

describe("urls", () => {
  describe("APP_BASE_URL", () => {
    it("points to the root domain (no app subdomain)", () => {
      expect(APP_BASE_URL).toBe("https://whatxpress.com");
    });

    it("does not include the app subdomain", () => {
      expect(APP_BASE_URL).not.toContain("app.whatxpress.com");
    });
  });

  describe("absoluteUrl", () => {
    it("builds a URL from a path with leading slash", () => {
      expect(absoluteUrl("/login")).toBe("https://whatxpress.com/login");
    });

    it("builds a URL from a path without leading slash", () => {
      expect(absoluteUrl("dashboard")).toBe("https://whatxpress.com/dashboard");
    });

    it("preserves nested paths", () => {
      expect(absoluteUrl("/order/abc123")).toBe("https://whatxpress.com/order/abc123");
    });

    it("preserves query strings", () => {
      expect(absoluteUrl("/login?redirect=/dashboard")).toBe(
        "https://whatxpress.com/login?redirect=/dashboard"
      );
    });
  });
});
