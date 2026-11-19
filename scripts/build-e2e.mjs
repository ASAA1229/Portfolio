#!/usr/bin/env node
/** Builds the production bundle for the Node server preset used by the browser E2E suite. */
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NITRO_PRESET: "node-server" },
});
process.exit(result.status ?? 1);
