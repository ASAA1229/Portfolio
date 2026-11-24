// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  TEST_DATA_COMMENT,
  applyDemoSecrets,
  parseEnvFile,
  productionIndicators,
  run,
  validateIdentity,
} from "../../scripts/demo-login.mjs";

describe("demo login (development only)", () => {
  it("refuses production, CI and hosted contexts without echoing the password", () => {
    expect(productionIndicators({ NODE_ENV: "production" })).not.toHaveLength(0);
    expect(productionIndicators({ ENVIRONMENT: "Production" })).not.toHaveLength(0);
    expect(productionIndicators({ CI: "true" })).not.toHaveLength(0);
    expect(productionIndicators({})).toHaveLength(0);
    const secret = "very-secret-demo-password";
    const result = run(["apply"], {
      NODE_ENV: "production",
      DEMO_USER_EMAIL: "demo.admin@example.invalid",
      DEMO_USER_PASSWORD: secret,
    });
    expect(result.code).toBe(1);
    expect(result.message).not.toContain(secret);
  });

  it("requires an email and a 12+ character password", () => {
    expect(validateIdentity({ email: "nope", password: "short" })).toHaveLength(2);
    expect(
      validateIdentity({ email: "demo.admin@example.invalid", password: "a-long-demo-password" }),
    ).toEqual([]);
    const result = run(["apply"], {
      DEMO_USER_EMAIL: "demo.admin@example.invalid",
      DEMO_USER_PASSWORD: "tiny",
    });
    expect(result.code).toBe(1);
    expect(result.message).not.toContain("tiny");
  });

  it("replaces only the admin password, keeps other lines and adds a signing secret once", () => {
    const first = applyDemoSecrets(
      "OTHER=1\nPORTFOLIO_ADMIN_PASSWORD=old\n",
      "new-demo-password!",
      () => "s".repeat(64),
    );
    expect(first).toBe(
      `OTHER=1\n${TEST_DATA_COMMENT}\nPORTFOLIO_ADMIN_PASSWORD=new-demo-password!\nPORTFOLIO_ADMIN_SESSION_SECRET=${"s".repeat(64)}\n`,
    );
    const second = applyDemoSecrets(first, "other-demo-password!", () => "different");
    expect(second).toContain(`PORTFOLIO_ADMIN_SESSION_SECRET=${"s".repeat(64)}`);
    expect(second).toContain("PORTFOLIO_ADMIN_PASSWORD=other-demo-password!");
    expect(second.split(TEST_DATA_COMMENT)).toHaveLength(2); // re-applying never duplicates the label
  });

  it("writes the TEMPORARY / TEST DATA comment directly above the managed keys", () => {
    expect(TEST_DATA_COMMENT).toBe(
      "# TEMPORARY / TEST DATA – local demo admin login, never use in production",
    );
    const fresh = applyDemoSecrets("", "a-long-demo-password", () => "x".repeat(8));
    expect(fresh.split("\n").slice(0, 2)).toEqual([
      TEST_DATA_COMMENT,
      "PORTFOLIO_ADMIN_PASSWORD=a-long-demo-password",
    ]);
  });

  it("parses only the demo keys from env files", () => {
    expect(parseEnvFile('DEMO_USER_EMAIL="a@b.co"\nSECRET=zzz\nDEMO_USER_PASSWORD=pw')).toEqual({
      DEMO_USER_EMAIL: "a@b.co",
      DEMO_USER_PASSWORD: "pw",
    });
  });
});
