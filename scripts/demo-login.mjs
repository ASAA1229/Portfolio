#!/usr/bin/env node
/**
 * Development-only demo admin sign-in (E3:D6.11).
 *
 * The Admin password form checks one server secret, PORTFOLIO_ADMIN_PASSWORD (constant-time, rate limited,
 * 8-hour HttpOnly session). This script points that secret at the owner's demo password so the demo
 * identity can sign in on a LOCAL machine. It reuses the existing mechanism and adds no new auth path.
 *
 * Inputs (never committed): DEMO_USER_EMAIL and DEMO_USER_PASSWORD, read from the process environment or from
 * a git-ignored local file (.dev.vars, then .env.local, then .env). The password is never printed or logged.
 *
 * Usage: node scripts/demo-login.mjs apply [--target local-prod|dev-vars]   (default: local-prod)
 *        node scripts/demo-login.mjs status [--target ...]
 *   local-prod  writes .local-prod/.dev.vars (used by `npm run local:deploy` / `local:start`, port 8300)
 *   dev-vars    writes .dev.vars (used by wrangler dev)
 * `vite dev` (port 5174) already skips the Admin gate locally and needs no demo login.
 * The existing second factor stays in force: SSO sign-in still requires the portfolio-admin role and MFA.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEYS = ["DEMO_USER_EMAIL", "DEMO_USER_PASSWORD"];
export const TEST_DATA_COMMENT =
  "# TEMPORARY / TEST DATA – local demo admin login, never use in production"; // E3:D6.13
const MANAGED_KEYS = ["PORTFOLIO_ADMIN_PASSWORD", "PORTFOLIO_ADMIN_SESSION_SECRET"];
const MIN_PASSWORD_CHARS = 12; // the server rejects shorter admin passwords
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/** Reasons this machine must not be configured with a demo identity (production/CI/hosted contexts). */
export function productionIndicators(env) {
  const reasons = [];
  if (env.NODE_ENV === "production") reasons.push("NODE_ENV=production");
  if (String(env.ENVIRONMENT ?? "").toLowerCase() === "production")
    reasons.push("ENVIRONMENT=production");
  for (const name of [
    "CI",
    "GITHUB_ACTIONS",
    "JENKINS_URL",
    "BUILD_NUMBER",
    "CF_PAGES",
    "CLOUDFLARE_ACCOUNT_ID",
    "WORKERS_CI",
  ]) {
    if (env[name]) reasons.push(`${name} is set`);
  }
  return reasons;
}

/** Parse KEY=VALUE lines; only the requested keys are returned. */
export function parseEnvFile(text, wanted = KEYS) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || !wanted.includes(match[1])) continue;
    let value = match[2];
    if (value.length >= 2 && /^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    out[match[1]] = value;
  }
  return out;
}

export function readDemoIdentity(env, rootDir = root) {
  const found = {};
  for (const key of KEYS) if (env[key]) found[key] = env[key];
  for (const file of [".dev.vars", ".env.local", ".env"]) {
    const full = path.join(rootDir, file);
    if (!existsSync(full)) continue;
    const parsed = parseEnvFile(readFileSync(full, "utf8"));
    for (const key of KEYS) if (!found[key] && parsed[key]) found[key] = parsed[key];
  }
  return { email: found.DEMO_USER_EMAIL?.trim(), password: found.DEMO_USER_PASSWORD };
}

export function validateIdentity({ email, password }) {
  const problems = [];
  if (!email || !EMAIL.test(email))
    problems.push("DEMO_USER_EMAIL is missing or not a valid email address.");
  if (!password || Array.from(password).length < MIN_PASSWORD_CHARS)
    problems.push(
      `DEMO_USER_PASSWORD is missing or shorter than ${MIN_PASSWORD_CHARS} characters.`,
    );
  if (password && /[\r\n]/.test(password))
    problems.push("DEMO_USER_PASSWORD must not contain line breaks.");
  return problems;
}

/** Replace/insert the demo password (and a signing secret when absent) while keeping every other line. */
export function applyDemoSecrets(
  existing,
  password,
  newSecret = () => randomBytes(48).toString("hex"),
) {
  const lines = existing
    ? existing.split(/\r?\n/).filter((l, i, a) => !(i === a.length - 1 && l === ""))
    : [];
  const has = (name) => lines.some((l) => l.startsWith(`${name}=`));
  const set = (name, value) => {
    const i = lines.findIndex((l) => l.startsWith(`${name}=`));
    if (i >= 0) lines[i] = `${name}=${value}`;
    else lines.push(`${name}=${value}`);
  };
  set("PORTFOLIO_ADMIN_PASSWORD", password);
  if (!has("PORTFOLIO_ADMIN_SESSION_SECRET")) set("PORTFOLIO_ADMIN_SESSION_SECRET", newSecret());
  // Label the managed keys: exactly one marker comment, directly above the first of them.
  for (let i = lines.length - 1; i >= 0; i--)
    if (lines[i] === TEST_DATA_COMMENT) lines.splice(i, 1);
  lines.splice(
    Math.min(
      ...MANAGED_KEYS.map((name) => lines.findIndex((l) => l.startsWith(`${name}=`))).filter(
        (i) => i >= 0,
      ),
    ),
    0,
    TEST_DATA_COMMENT,
  );
  return `${lines.join("\n")}\n`;
}

function targetFile(target) {
  if (target === "dev-vars") return path.join(root, ".dev.vars");
  if (target === "local-prod") return path.join(root, ".local-prod", ".dev.vars");
  throw new Error("Unknown --target (use local-prod or dev-vars).");
}

function gitIgnored(file) {
  return spawnSync("git", ["check-ignore", "-q", file], { cwd: root }).status === 0;
}

export function run(argv, env = process.env) {
  const command = argv[0];
  const targetFlag = argv.indexOf("--target");
  const target = targetFlag >= 0 ? argv[targetFlag + 1] : "local-prod";
  if (!["apply", "status"].includes(command ?? "")) {
    return {
      code: 2,
      message: "Usage: node scripts/demo-login.mjs <apply|status> [--target local-prod|dev-vars]",
    };
  }
  const blocked = productionIndicators(env);
  if (blocked.length) {
    return {
      code: 1,
      message: `Refused: the demo login is for local development only (${blocked.join(", ")}).`,
    };
  }
  let file;
  try {
    file = targetFile(target);
  } catch (error) {
    return { code: 2, message: error.message };
  }
  const identity = readDemoIdentity(env);
  const problems = validateIdentity(identity);
  if (problems.length) return { code: 1, message: `Cannot continue:\n- ${problems.join("\n- ")}` };
  if (!gitIgnored(file))
    return { code: 1, message: `Refused: ${path.relative(root, file)} is not git-ignored.` };
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const configured =
    parseEnvFile(current, ["PORTFOLIO_ADMIN_PASSWORD"]).PORTFOLIO_ADMIN_PASSWORD ===
    identity.password;
  if (command === "status") {
    return {
      code: 0,
      message: `Demo identity ${identity.email}: ${configured ? "configured" : "not configured"} in ${path.relative(root, file)}.`,
    };
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, applyDemoSecrets(current, identity.password), { mode: 0o600 });
  return {
    code: 0,
    message:
      `Demo admin password for ${identity.email} written to ${path.relative(root, file)} (git-ignored; value not shown).\n` +
      "Restart the local server (npm run local:deploy) and sign in at /admin/login with that password.",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { code, message } = run(process.argv.slice(2));
  (code === 0 ? console.log : console.error)(message);
  process.exit(code);
}
