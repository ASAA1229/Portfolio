#!/usr/bin/env node
/**
 * Package-manager authority guard (PORT-GAP-016): npm + package-lock.json are authoritative.
 * Fails on competing lockfiles other than the tolerated legacy bun.lock, a missing/old
 * package-lock.json, or a package.json whose packageManager field is not npm. bun.lock (used only by
 * the Lovable editor) is reported as non-authoritative.
 */
import { existsSync, readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const problems = [];
if (!/^npm@\d+\.\d+\.\d+/.test(pkg.packageManager ?? ""))
  problems.push("package.json packageManager must be npm@<version>.");
if (!existsSync("package-lock.json")) problems.push("package-lock.json is missing.");
else if (JSON.parse(readFileSync("package-lock.json", "utf8")).lockfileVersion < 3)
  problems.push("package-lock.json must be lockfileVersion 3.");
for (const file of ["yarn.lock", "pnpm-lock.yaml", "bun.lockb"])
  if (existsSync(file)) problems.push(`${file} competes with package-lock.json.`);
if (existsSync("bun.lock"))
  console.log("NOTE: bun.lock is present but non-authoritative; CI installs with `npm ci` only.");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Package manager OK: npm is authoritative (package-lock.json).");
