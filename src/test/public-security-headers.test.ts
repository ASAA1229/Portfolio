// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { MemoryR2 } from "./helpers/memory-r2";

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: () =>
      new Response("<html><head></head><body>page</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  },
}));
const { default: server } = await import("@/server");

const ORIGIN = "https://portfolio.test";
const env = () => ({
  ENVIRONMENT: "production",
  PORTFOLIO_ADMIN_PASSWORD: "correct-horse-battery-staple",
  PORTFOLIO_ADMIN_SESSION_SECRET: "test-session-secret-with-sufficient-length-0123456789",
  RESUME_BUCKET: new MemoryR2(),
});

describe("public security headers and path normalization", () => {
  it("adds baseline security headers to public pages", async () => {
    const r = await server.fetch(new Request(`${ORIGIN}/people/abhishek`), env(), {});
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(r.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(r.headers.get("strict-transport-security")).toContain("max-age=");
    const csp = r.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  it("treats repeated slashes as the admin boundary", async () => {
    for (const path of ["/api//admin/audit", "/admin//content", "/api///admin/session"]) {
      const r = await server.fetch(new Request(`${ORIGIN}${path}`), env(), {});
      expect(r.status, path).toBe(404);
      expect(r.headers.get("x-frame-options")).toBe("DENY");
    }
  });
});
