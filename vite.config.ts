// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig(({ command, mode }) => ({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  // Only the Vite development server receives this bypass. Build and preview
  // bundles never receive it, so production authentication remains enabled.
  ...(command === "serve" && mode === "development" ? {
    vite: {
      define: {
        "process.env.PORTFOLIO_ADMIN_AUTH_BYPASS": JSON.stringify("true"),
        "process.env.ENVIRONMENT": JSON.stringify("development"),
        "process.env.NODE_ENV": JSON.stringify("development"),
      },
    },
  } : {}),
}));
