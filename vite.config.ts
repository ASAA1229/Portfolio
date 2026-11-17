// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

// Marks code compiled by the local Vite dev server (`vite dev`) only. Builds —
// including `vite build --mode development`, where import.meta.env.DEV is also
// true — never define it, so they can never enable the local admin auth bypass.
const devServerMarker: Plugin = {
  name: "portfolio-dev-server-marker",
  apply: (_config, { command, mode }) => command === "serve" && mode === "development",
  config: () => ({ define: { __PORTFOLIO_VITE_DEV_SERVER__: "true" } }),
};

// Build identity for the ASAA service manifest (/.well-known/asaa-service). The commit comes from CI's
// GIT_COMMIT or the local git checkout; when neither is available it stays null. Nothing secret is embedded.
function buildCommit(): string | null {
  const candidate =
    process.env["GIT_COMMIT"] ??
    (() => {
      try {
        return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
          .toString()
          .trim();
      } catch {
        return undefined;
      }
    })();
  return candidate && /^[0-9a-f]{7,40}$/.test(candidate) ? candidate : null;
}

const buildInfo: Plugin = {
  name: "portfolio-build-info",
  config: () => ({
    define: {
      __PORTFOLIO_VERSION__: JSON.stringify(
        (JSON.parse(readFileSync("package.json", "utf8")) as { version?: string }).version ??
          "0.0.0",
      ),
      __PORTFOLIO_BUILD_COMMIT__: JSON.stringify(buildCommit()),
    },
  }),
};

// defineConfig only reads Lovable options (tanstackStart, vite, …) from an object;
// a function argument is treated as plain Vite config and these options are ignored.
export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: { plugins: [devServerMarker, buildInfo] },
});
