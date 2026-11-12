import { describe, expect, it } from "vitest";
import {
  adminAuthConfigured,
  createAdminCookie,
  isAdminRequest,
  verifyAdminPassword,
  adminCookieHeader,
  clearAdminCookieHeader,
  isValidSessionEpoch,
} from "./admin-auth";

const env = {
  PORTFOLIO_ADMIN_PASSWORD: "test-only-password",
  PORTFOLIO_ADMIN_SESSION_SECRET: "test-only-session-secret-that-is-long-enough",
};

describe("private admin authentication", () => {
  it("requires both server-side secrets", () => {
    expect(adminAuthConfigured(env)).toBe(true);
    expect(adminAuthConfigured({ PORTFOLIO_ADMIN_PASSWORD: env.PORTFOLIO_ADMIN_PASSWORD })).toBe(
      false,
    );
  });

  it("rejects weak configured owner passwords", () => {
    expect(adminAuthConfigured({ ...env, PORTFOLIO_ADMIN_PASSWORD: "short" })).toBe(false);
    expect(adminAuthConfigured({ ...env, PORTFOLIO_ADMIN_PASSWORD: "long-enough-password" })).toBe(true);
  });

  it("rejects missing or weak session-signing secrets", () => {
    expect(adminAuthConfigured({ ...env, PORTFOLIO_ADMIN_SESSION_SECRET: "too-short" })).toBe(false);
    expect(adminAuthConfigured({ ...env, PORTFOLIO_ADMIN_SESSION_SECRET: "x".repeat(31) })).toBe(false);
    expect(adminAuthConfigured({ ...env, PORTFOLIO_ADMIN_SESSION_SECRET: "x".repeat(32) })).toBe(true);
  });

  it("accepts only the configured password", async () => {
    expect(await verifyAdminPassword("test-only-password", env)).toBe(true);
    expect(await verifyAdminPassword("wrong-password", env)).toBe(false);
    expect(await verifyAdminPassword("test-only-password", {})).toBe(false);
  });

  it("validates a signed, unexpired session cookie", async () => {
    const value = await createAdminCookie(env);
    expect(value).toBeTruthy();
    const request = new Request("https://portfolio.example/admin/resumes", {
      headers: { cookie: `portfolio_admin_session=${value}` },
    });
    expect(await isAdminRequest(request, env)).toBe(true);
    expect(await isAdminRequest(new Request("https://portfolio.example/admin/resumes"), env)).toBe(
      false,
    );
    const tampered = new Request("https://portfolio.example/admin/resumes", {
      headers: { cookie: `portfolio_admin_session=${value}x` },
    });
    expect(await isAdminRequest(tampered, env)).toBe(false);
  });

  it("invalidates previously issued cookies when the owner session epoch changes", async () => {
    const cookie = await createAdminCookie(env, "7");
    expect(cookie).toBeTruthy();
    const request = new Request("https://portfolio.example/admin", {
      headers: { cookie: `portfolio_admin_session=${cookie}` },
    });
    expect(await isAdminRequest(request, env, "7")).toBe(true);
    expect(await isAdminRequest(request, env, "8")).toBe(false);
    expect(await isAdminRequest(request, env, "0")).toBe(false);
  });

  it("accepts only bounded canonical session epochs", () => {
    for (const valid of ["0", "1", "7", "9007199254740991"]) {
      expect(isValidSessionEpoch(valid)).toBe(true);
    }
    for (const invalid of ["", "-1", "01", "1.0", "1e3", "10000000000000000", "9999999999999999", 1, null]) {
      expect(isValidSessionEpoch(invalid)).toBe(false);
    }
  });

  it("sets secure cookie attributes and clears sessions safely", () => {
    const issued = adminCookieHeader("signed-value", true);
    expect(issued).toContain("HttpOnly");
    expect(issued).toContain("Secure");
    expect(issued).toContain("SameSite=Strict");
    expect(issued).toContain("Path=/");

    const cleared = clearAdminCookieHeader(true);
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("HttpOnly");
    expect(cleared).toContain("Secure");
  });
});
