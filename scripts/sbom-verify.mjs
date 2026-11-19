#!/usr/bin/env node
/**
 * Local SBOM verification (JARVIS-GAP-018). No network access.
 *
 *   node scripts/sbom-verify.mjs <sbom.cdx.json> [package-lock.json]
 *
 * Checks that the CycloneDX SBOM is structurally valid, has unique bom-refs and
 * purls, and (when a lockfile is supplied) that every production/dev package in
 * the lockfile appears in the SBOM with the same version, and the SBOM contains
 * no component the lockfile does not know about. Exits non-zero on any problem.
 */
import { readFileSync, statSync } from "node:fs";

const MAX_BYTES = 32 * 1024 * 1024;

function load(path, label) {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > MAX_BYTES)
    throw new Error(`${label} must be a regular file under 32 MB.`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

export function verifySbom(sbom, lock) {
  const problems = [];
  if (!sbom || typeof sbom !== "object" || Array.isArray(sbom))
    return ["SBOM must be a JSON object."];
  if (sbom.bomFormat !== "CycloneDX") problems.push("bomFormat must be CycloneDX.");
  if (typeof sbom.specVersion !== "string" || !/^1\.\d+$/.test(sbom.specVersion))
    problems.push("specVersion is missing or invalid.");
  if (!Number.isInteger(sbom.version) || sbom.version < 1)
    problems.push("SBOM version must be a positive integer.");
  if (typeof sbom.serialNumber === "string" && !/^urn:uuid:[0-9a-f-]{36}$/i.test(sbom.serialNumber))
    problems.push("serialNumber is malformed.");
  const components = Array.isArray(sbom.components) ? sbom.components : null;
  if (!components || components.length === 0) problems.push("SBOM has no components.");
  const refs = new Set();
  const purls = new Set();
  const sbomVersions = new Map();
  for (const component of components ?? []) {
    if (
      !component ||
      typeof component.name !== "string" ||
      !component.name ||
      typeof component.version !== "string" ||
      !component.version
    ) {
      problems.push("A component is missing name or version.");
      continue;
    }
    const ref = component["bom-ref"];
    if (typeof ref === "string") {
      if (refs.has(ref)) problems.push(`Duplicate bom-ref: ${ref}.`);
      refs.add(ref);
    }
    if (typeof component.purl === "string") {
      if (purls.has(component.purl)) problems.push(`Duplicate purl: ${component.purl}.`);
      purls.add(component.purl);
    } else problems.push(`Component ${component.name} has no purl.`);
    const key = component.name;
    const list = sbomVersions.get(key) ?? new Set();
    list.add(component.version);
    sbomVersions.set(key, list);
  }
  if (lock) {
    if (!lock.packages || typeof lock.packages !== "object")
      problems.push("Lockfile has no packages section.");
    else {
      const locked = new Map();
      for (const [path, info] of Object.entries(lock.packages)) {
        if (path === "" || !info?.version || info.link) continue;
        const name =
          info.name ?? path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
        const entry = locked.get(name) ?? { versions: new Set(), required: false };
        entry.versions.add(info.version);
        // Optional platform-specific packages are legitimately absent from a host-generated SBOM.
        if (!info.optional) entry.required = true;
        locked.set(name, entry);
      }
      for (const [name, { versions, required }] of locked) {
        const present = sbomVersions.get(name);
        if (!present) {
          if (required) problems.push(`Lockfile package missing from SBOM: ${name}.`);
          continue;
        }
        for (const version of versions)
          if (required && !present.has(version))
            problems.push(`SBOM lacks ${name}@${version} from the lockfile.`);
      }
      for (const [name, versions] of sbomVersions) {
        const known = locked.get(name);
        if (!known) {
          problems.push(`SBOM component not in lockfile: ${name}.`);
          continue;
        }
        for (const version of versions)
          if (!known.versions.has(version))
            problems.push(`SBOM lists ${name}@${version} that the lockfile does not.`);
      }
    }
  }
  return problems;
}

if (
  import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("sbom-verify.mjs")
) {
  const [sbomPath, lockPath] = process.argv.slice(2);
  if (!sbomPath) {
    console.error("Usage: sbom-verify.mjs <sbom.cdx.json> [package-lock.json]");
    process.exit(2);
  }
  try {
    const problems = verifySbom(
      load(sbomPath, "SBOM"),
      lockPath ? load(lockPath, "Lockfile") : undefined,
    );
    if (problems.length) {
      for (const problem of problems.slice(0, 20)) console.error(`SBOM problem: ${problem}`);
      process.exit(1);
    }
    console.log(`SBOM verification PASSED${lockPath ? " (cross-checked against lockfile)" : ""}.`);
  } catch (error) {
    console.error(`SBOM verification error: ${error.message}`);
    process.exit(1);
  }
}
