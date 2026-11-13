#!/usr/bin/env node
/**
 * Static bundle-size budget check (PORT-GAP-009).
 *
 * Usage: node scripts/bundle-budget.mjs [outputDir=.output] [reportFile]
 * Measures gzip sizes of the built client assets (.output/public/assets) and the server entry,
 * compares them with scripts/performance-budget.json and exits non-zero when a budget is exceeded.
 * Deterministic and offline, so it is safe to run in CI after `npm run build`.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(process.argv[2] ?? path.join(root, ".output"));
const reportFile = process.argv[3];
const budget = JSON.parse(
  readFileSync(path.join(root, "scripts", "performance-budget.json"), "utf8"),
).static;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;
const measure = (file) => {
  const raw = readFileSync(file);
  return {
    file: path.relative(outputDir, file).split(path.sep).join("/"),
    rawKb: kb(raw.length),
    gzipKb: kb(gzipSync(raw).length),
  };
};

const publicDir = path.join(outputDir, "public");
const assets = walk(publicDir).filter((file) => /\.(?:js|mjs|css)$/.test(file));
const js = assets.filter((file) => /\.(?:js|mjs)$/.test(file)).map(measure);
const css = assets.filter((file) => file.endsWith(".css")).map(measure);
const serverDir = path.join(outputDir, "server");
const serverFiles = walk(serverDir).filter(
  (file) => /\.(?:js|mjs)$/.test(file) && !file.includes("node_modules"),
);
const serverTotalGzipKb = kb(
  serverFiles.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0),
);
const images = walk(publicDir)
  .filter((file) => /\.(?:png|jpe?g|webp|avif|gif|svg|mp4)$/i.test(file))
  .map((file) => ({
    file: path.relative(publicDir, file).split(path.sep).join("/"),
    kb: kb(statSync(file).size),
  }))
  .sort((a, b) => b.kb - a.kb);

const total = (list) => Math.round(list.reduce((sum, item) => sum + item.gzipKb, 0) * 10) / 10;
const largest = js.reduce((a, b) => (b.gzipKb > a.gzipKb ? b : a), { gzipKb: 0, file: "-" });
const result = {
  measuredAt: new Date().toISOString(),
  client: {
    jsFiles: js.length,
    jsGzipKbTotal: total(js),
    jsLargestChunk: { file: largest.file, gzipKb: largest.gzipKb },
    cssGzipKbTotal: total(css),
  },
  server: { totalGzipKb: serverTotalGzipKb, files: serverFiles.length },
  images: {
    count: images.length,
    totalKb: Math.round(images.reduce((s, i) => s + i.kb, 0)),
    largest: images.slice(0, 5),
  },
  budgets: budget,
};

const checks = [
  ["client JS gzip total", result.client.jsGzipKbTotal, budget.clientJsGzipKbTotal],
  [
    "largest client JS chunk gzip",
    result.client.jsLargestChunk.gzipKb,
    budget.clientJsGzipKbLargestChunk,
  ],
  ["client CSS gzip total", result.client.cssGzipKbTotal, budget.clientCssGzipKbTotal],
  ["server bundle gzip total", result.server.totalGzipKb, budget.serverEntryGzipKbMax],
];
let failed = false;
console.log(`Bundle budget report for ${outputDir}`);
for (const [name, actual, limit] of checks) {
  const ok = actual <= limit;
  failed ||= !ok;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${actual} KB (budget ${limit} KB)`);
}
console.log(`INFO  largest chunk: ${result.client.jsLargestChunk.file}`);
console.log(
  `INFO  ${images.length} media files, ${result.images.totalKb} KB; largest: ${images[0]?.file} (${images[0]?.kb} KB)`,
);
result.passed = !failed;
if (reportFile) writeFileSync(reportFile, JSON.stringify(result, null, 2));
process.exit(failed ? 1 : 0);
