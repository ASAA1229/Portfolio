import { describe, expect, it } from "vitest";
import {
  adminAuthConfigured,
  createAdminCookie,
  isAdminRequest,
  verifyAdminPassword,
} from "./admin-auth";

const env = {
  PORTFOLIO_ADMIN_PASSWORD: "test-only-password",
  PORTFOLIO_ADMIN_SESSION_SECRET: "test-only-session-secret-that-is-long-enough",
};


describe("private admin authentication", () => {
  it("requires both server-side secrets", () => {
    expect(adminAuthConfigured(env)).toBe(true);
    expect(adminAuthConfigured({ PORTFOLIO_ADMIN_PASSWORD: env.PORTFOLIO_ADMIN_PASSWORD })).toBe(false);
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
    expect(await isAdminRequest(new Request("https://portfolio.example/admin/resumes"), env)).toBe(false);
    const tampered = new Request("https://portfolio.example/admin/resumes", {
      headers: { cookie: `portfolio_admin_session=${value}x` },
    });
    expect(await isAdminRequest(tampered, env)).toBe(false);
  });
});
