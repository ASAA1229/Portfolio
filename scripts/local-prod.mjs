#!/usr/bin/env node
/**
 * Local production runner: serves the PRODUCTION (Cloudflare-preset) build on this machine at
 * http://localhost:8300 through `wrangler dev --local` (Miniflare/workerd), with R2 emulated and persisted
 * to a git-ignored folder. It never logs in to Cloudflare, never deploys and never touches hosted R2/KV.
 *
 * Usage: node scripts/local-prod.mjs <command>
 *   init              create .local-prod/ and per-install admin secrets (never printed; user-only ACL)
 *   build             production build -> new immutable release under .local-prod/releases/
 *   start             start the current release in the background (detached, logs in .local-prod/logs)
 *   stop              stop the running server
 *   status            show current/previous release and whether the server answers
 *   smoke             HTTP smoke test of the four profiles, SEO files and the Admin gate
 *   deploy            build + restart + smoke; rolls back to the previous release if smoke fails
 *   rollback          switch to the previous release, restart and smoke
 *   install-startup   start automatically at user logon (Windows scheduled task / systemd user unit hint)
 *   uninstall-startup remove the logon task
 *
 * Layout (all git-ignored): .local-prod/{.dev.vars,state/,releases/<id>/,current.json,run.json,logs/}
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// LOCAL_PROD_HOME lets CI keep releases, secrets and R2 state outside the (wiped) workspace so rollback works.
const base = process.env.LOCAL_PROD_HOME
  ? path.resolve(process.env.LOCAL_PROD_HOME)
  : path.join(root, ".local-prod");
const PORT = Number(process.env.LOCAL_PROD_PORT ?? 8300);
const HOST = "127.0.0.1";
const RELEASES_KEPT = 5;
const files = {
  vars: path.join(base, ".dev.vars"),
  state: path.join(base, "state"),
  releases: path.join(base, "releases"),
  current: path.join(base, "current.json"),
  run: path.join(base, "run.json"),
  logs: path.join(base, "logs"),
};
const URL_BASE = `http://localhost:${PORT}`;

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const log = (message) => console.log(message);
const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

function restrictToCurrentUser(file) {
  if (process.platform === "win32") {
    const user = process.env.USERNAME;
    if (!user) return;
    spawnSync("icacls", [file, "/inheritance:r", "/grant:r", `${user}:F`], { stdio: "ignore" });
  } else {
    chmodSync(file, 0o600);
  }
}

function init() {
  mkdirSync(files.state, { recursive: true });
  mkdirSync(files.releases, { recursive: true });
  mkdirSync(files.logs, { recursive: true });
  if (existsSync(files.vars)) {
    log(`Secrets already exist at ${files.vars} (kept; delete the file to regenerate).`);
    return;
  }
  // 24 URL-safe characters (>= 12 required by the server) and a 48-byte signing secret (>= 32 required).
  const password = randomBytes(18).toString("base64url");
  const secret = randomBytes(48).toString("hex");
  writeFileSync(
    files.vars,
    `PORTFOLIO_ADMIN_PASSWORD=${password}\nPORTFOLIO_ADMIN_SESSION_SECRET=${secret}\n`,
    { mode: 0o600 },
  );
  restrictToCurrentUser(files.vars);
  log(`Created per-install admin secrets in ${files.vars} (readable only by the current user).`);
  log("Open that file to read the Admin password; the scripts never print it.");
}

function wranglerBin() {
  const bin = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
  if (!existsSync(bin)) fail("wrangler is not installed. Run `npm install` first.");
  return bin;
}

function releaseIds() {
  return existsSync(files.releases)
    ? readdirSync(files.releases)
        .filter((d) => existsSync(path.join(files.releases, d, "release.json")))
        .sort()
    : [];
}

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function build() {
  init();
  const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout.trim();
  const sha = git("rev-parse", "--short=12", "HEAD") || "nogit";
  rmSync(path.join(root, ".output"), { recursive: true, force: true });
  log("== Production build (Cloudflare preset)");
  const result = spawnSync("npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NITRO_PRESET: "", SERVER_PRESET: "" },
  });
  if (result.status !== 0) fail("build failed; the current release is unchanged.");
  const wranglerJson = path.join(root, ".output", "server", "wrangler.json");
  if (!existsSync(wranglerJson))
    fail(".output/server/wrangler.json missing: not a Cloudflare-preset build.");
  const id = `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}-${sha}`;
  const dir = path.join(files.releases, id);
  mkdirSync(dir, { recursive: true });
  cpSync(path.join(root, ".output"), path.join(dir, "output"), { recursive: true });
  const entry = readJson(wranglerJson, {}).main ?? "index.mjs";
  const entryFile = path.join(dir, "output", "server", entry);
  writeFileSync(
    path.join(dir, "release.json"),
    JSON.stringify(
      {
        id,
        commit: sha,
        builtAt: new Date().toISOString(),
        serverEntry: entry,
        serverEntrySha256: existsSync(entryFile) ? sha256File(entryFile) : null,
      },
      null,
      2,
    ),
  );
  const previous = readJson(files.current, {}).current ?? null;
  writeFileSync(files.current, JSON.stringify({ current: id, previous }, null, 2));
  for (const old of releaseIds().slice(0, -RELEASES_KEPT)) {
    if (old !== id && old !== previous)
      rmSync(path.join(files.releases, old), { recursive: true, force: true });
  }
  log(`Release ${id} built (previous: ${previous ?? "none"}).`);
  return id;
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stop() {
  const run = readJson(files.run, {});
  if (isRunning(run.pid)) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(run.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try {
        process.kill(-run.pid, "SIGTERM");
      } catch {
        process.kill(run.pid, "SIGTERM");
      }
    }
    log(`Stopped server (pid ${run.pid}).`);
  } else {
    log("No running server recorded.");
  }
  rmSync(files.run, { force: true });
}

async function waitForServer(timeoutMs = 240000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(`${URL_BASE}/`, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function start(soft = false) {
  init();
  const { current } = readJson(files.current, {});
  if (!current) fail("No release built yet. Run `npm run local:deploy` first.");
  stop();
  const releaseDir = path.join(files.releases, current, "output", "server");
  if (!existsSync(path.join(releaseDir, "wrangler.json")))
    fail(`Release ${current} is incomplete.`);
  // wrangler reads Worker secrets from a .dev.vars file next to the config; the copy is user-only and git-ignored.
  const releaseVars = path.join(releaseDir, ".dev.vars");
  cpSync(files.vars, releaseVars);
  restrictToCurrentUser(releaseVars);
  mkdirSync(files.logs, { recursive: true });
  const out = openSync(path.join(files.logs, "server.log"), "a");
  const child = spawn(
    process.execPath,
    [
      wranglerBin(),
      "dev",
      "--config",
      path.join(releaseDir, "wrangler.json"),
      "--local",
      "--ip",
      HOST,
      "--port",
      String(PORT),
      "--persist-to",
      files.state,
      "--show-interactive-dev-session=false",
    ],
    {
      cwd: releaseDir,
      detached: true,
      stdio: ["ignore", out, out],
      windowsHide: true,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "true" },
    },
  );
  child.unref();
  writeFileSync(files.run, JSON.stringify({ pid: child.pid, release: current, port: PORT }));
  log(`Starting release ${current} on ${URL_BASE} (pid ${child.pid}) ...`);
  if (!(await waitForServer())) {
    stop();
    if (soft) return false;
    fail(`Server did not answer on ${URL_BASE}; see ${path.join(files.logs, "server.log")}.`);
  }
  log("Server is up.");
  return true;
}

async function smoke() {
  const checks = [
    ["/", 200, "Abhishek home"],
    ["/people/ammu", 200, "Amulya"],
    ["/people/bava", 200, "Anjini"],
    ["/people/sai", 200, "Sai"],
    ["/projects", 200],
    ["/sitemap.xml", 200],
    ["/robots.txt", 200],
    ["/admin/login", 200],
    ["/api/admin/session", [401, 403, 404]],
    ["/definitely-not-a-page", 404],
  ];
  let failed = 0;
  for (const [route, expected, label] of checks) {
    try {
      const res = await fetch(URL_BASE + route, { redirect: "manual" });
      const ok = Array.isArray(expected) ? expected.includes(res.status) : res.status === expected;
      log(`${ok ? "PASS" : "FAIL"} ${res.status} ${route}${label ? ` (${label})` : ""}`);
      if (!ok) failed += 1;
    } catch (error) {
      log(`FAIL ${route}: ${error instanceof Error ? error.message : String(error)}`);
      failed += 1;
    }
  }
  // A protected admin API must never be served without a session.
  try {
    const res = await fetch(`${URL_BASE}/api/admin/content`, { redirect: "manual" });
    const ok = res.status !== 200;
    log(`${ok ? "PASS" : "FAIL"} ${res.status} /api/admin/content without a session is not served`);
    if (!ok) failed += 1;
  } catch {
    failed += 1;
  }
  // Admin round trip: proves the secrets are wired and the R2 binding (resume index) is reachable.
  try {
    const pw = /^PORTFOLIO_ADMIN_PASSWORD=(.*)$/m
      .exec(readFileSync(files.vars, "utf8"))?.[1]
      ?.trim();
    const login = await fetch(`${URL_BASE}/api/admin/login`, {
      method: "POST",
      headers: { origin: URL_BASE, "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    const resumes = login.ok
      ? await fetch(`${URL_BASE}/api/admin/resumes`, { headers: { cookie } })
      : null;
    const ok = login.ok && resumes?.status === 200;
    log(
      `${ok ? "PASS" : "FAIL"} admin login ${login.status} + R2-backed resume index ${resumes?.status ?? "n/a"}`,
    );
    if (!ok) failed += 1;
  } catch (error) {
    log(`FAIL admin round trip: ${error instanceof Error ? error.message : String(error)}`);
    failed += 1;
  }
  if (failed) {
    log(`Smoke FAILED (${failed} check(s)).`);
    return false;
  }
  log("Smoke PASSED.");
  return true;
}

async function rollback() {
  const state = readJson(files.current, {});
  if (!state.previous || !existsSync(path.join(files.releases, state.previous))) {
    fail("There is no previous release to roll back to.");
  }
  writeFileSync(
    files.current,
    JSON.stringify(
      { current: state.previous, previous: null, rolledBackFrom: state.current },
      null,
      2,
    ),
  );
  log(`Rolling back ${state.current} -> ${state.previous}`);
  await start();
  if (!(await smoke()))
    fail("Smoke failed after rollback; investigate .local-prod/logs/server.log.");
}

async function deploy() {
  const before = readJson(files.current, {}).current ?? null;
  build();
  const up = await start(true);
  if (up && (await smoke())) {
    log("Local production deploy succeeded.");
    return;
  }
  log("Smoke failed on the new release.");
  if (before) {
    writeFileSync(files.current, JSON.stringify({ current: before, previous: null }, null, 2));
    log(`Automatically rolling back to ${before}`);
    await start();
    if (await smoke()) log("Rolled back; the previous release is serving again.");
  } else {
    stop();
  }
  process.exit(1);
}

function status() {
  const state = readJson(files.current, {});
  const run = readJson(files.run, {});
  log(
    JSON.stringify(
      {
        current: state.current ?? null,
        previous: state.previous ?? null,
        releases: releaseIds(),
        pid: run.pid ?? null,
        running: isRunning(run.pid),
        url: URL_BASE,
      },
      null,
      2,
    ),
  );
}

function installStartup() {
  const script = path.join(root, "scripts", "local-prod.mjs");
  if (process.platform === "win32") {
    const result = spawnSync(
      "schtasks",
      [
        "/Create",
        "/F",
        "/SC",
        "ONLOGON",
        "/RL",
        "LIMITED",
        "/TN",
        "PortfolioLocalProd",
        "/TR",
        `"${process.execPath}" "${script}" start`,
      ],
      { stdio: "inherit" },
    );
    if (result.status !== 0) fail("Could not create the scheduled task.");
    log("Scheduled task PortfolioLocalProd created: the server starts when you log on.");
  } else {
    log(
      `Add a systemd user unit or cron @reboot entry running: ${process.execPath} ${script} start`,
    );
  }
}

function uninstallStartup() {
  if (process.platform === "win32") {
    spawnSync("schtasks", ["/Delete", "/F", "/TN", "PortfolioLocalProd"], { stdio: "inherit" });
  } else {
    log("Remove the unit or cron entry you created.");
  }
}

const commands = {
  init,
  build,
  start,
  stop,
  status,
  deploy,
  rollback,
  smoke: async () => process.exit((await smoke()) ? 0 : 1),
  "install-startup": installStartup,
  "uninstall-startup": uninstallStartup,
};
const command = process.argv[2];
if (!command || !commands[command]) {
  console.error(`Usage: node scripts/local-prod.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(2);
}
await commands[command]();
