// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// Marks code compiled by the local Vite dev server (`vite dev`) only. Builds —
// including `vite build --mode development`, where import.meta.env.DEV is also
// true — never define it, so they can never enable the local admin auth bypass.
const devServerMarker: Plugin = {
  name: "portfolio-dev-server-marker",
  apply: (_config, { command, mode }) => command === "serve" && mode === "development",
  config: () => ({ define: { __PORTFOLIO_VITE_DEV_SERVER__: "true" } }),
};

// defineConfig only reads Lovable options (tanstackStart, vite, …) from an object;
// a function argument is treated as plain Vite config and these options are ignored.
export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: { plugins: [devServerMarker] },
});
