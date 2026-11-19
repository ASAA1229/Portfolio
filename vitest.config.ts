import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Storage-lifecycle suites perform many real filesystem round trips; slow CI/Windows
    // runners need more than the 5s default without masking genuine hangs.
    testTimeout: 30_000,
    // Leave CPU headroom: jsdom, axe and the workerd-backed R2 suites are CPU heavy, and starving them
    // (all cores busy, other processes running) is what made worker start-up and tests time out.
    maxWorkers: Math.max(2, Math.floor(os.cpus().length / 3)),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
