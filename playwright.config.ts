import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";

/**
 * Browser E2E for the authenticated Admin journeys. It serves the production build under Node
 * (see scripts/build-e2e.mjs) with in-memory storage and credentials generated for this run only:
 * nothing secret is committed, written to disk or reused between runs. Workers inherit the
 * generated values through the environment set while this file loads in the main process.
 */
process.env["E2E_ADMIN_PASSWORD"] ??= randomBytes(18).toString("base64url");
process.env["E2E_SESSION_SECRET"] ??= randomBytes(32).toString("hex");

const port = Number(process.env["E2E_PORT"] ?? 4180);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL,
    // Uses an installed browser (Chrome on GitHub runners, Edge/Chrome locally); nothing is downloaded.
    channel: process.env["BROWSER_CHANNEL"] ?? "chrome",
    trace: "off",
  },
  webServer: {
    command: "node .output/server/index.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(port),
      HOST: "127.0.0.1",
      ENVIRONMENT: "test",
      PORTFOLIO_E2E_STORAGE: "memory",
      PORTFOLIO_ADMIN_PASSWORD: process.env["E2E_ADMIN_PASSWORD"] ?? "",
      PORTFOLIO_ADMIN_SESSION_SECRET: process.env["E2E_SESSION_SECRET"] ?? "",
    },
  },
});
