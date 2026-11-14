#!/usr/bin/env node
/**
 * Real-browser accessibility and performance audit (PORT-GAP-008/009).
 *
 * Usage: node scripts/browser-audit.mjs <baseUrl> [reportFile]
 *   e.g. start the production build (NITRO_PRESET=node-server npm run build &&
 *        PORT=4173 node .output/server/index.mjs) then
 *        node scripts/browser-audit.mjs http://localhost:4173 audit-report.json
 *
 * Uses playwright-core with an already installed browser (BROWSER_CHANNEL=chrome|msedge, or
 * BROWSER_PATH); nothing is downloaded. For each page and viewport it:
 *   - runs axe-core with colour contrast enabled (WCAG 2.x A/AA + best practice),
 *   - checks 320px reflow (no horizontal scroll) and that the skip link works from the keyboard,
 *   - records LCP, CLS, long-task time and transferred JS/CSS/image bytes,
 *   - checks real HTTP statuses (404 for unknown pages, private areas not served).
 * Local numbers have no network throttling: they are regression guards, not field Web Vitals.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.argv[2] ?? "http://localhost:4173").replace(/\/$/, "");
const reportFile = process.argv[3];
const budget = JSON.parse(
  readFileSync(path.join(root, "scripts", "performance-budget.json"), "utf8"),
).runtime;
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const PAGES = [
  "/",
  "/about",
  "/skills",
  "/projects",
  "/experience",
  "/certifications",
  "/education",
  "/contact",
  "/profiles",
  "/privacy",
  "/people/ammu",
  "/people/ammu/projects",
  "/people/bava",
  "/people/bava/contact",
  "/people/sai",
  "/people/sai/skills",
  "/admin/login",
];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
];
const STATUS_CHECKS = [
  ["/does-not-exist", 404],
  ["/projects/does-not-exist", 404],
  ["/people/ammu/projects/does-not-exist", 404],
  ["/people/nobody", 404],
  ["/admin", 404],
  ["/api/admin/audit", 404],
  ["/sitemap.xml", 200],
  ["/robots.txt", 200],
];

const launchOptions = process.env.BROWSER_PATH
  ? { executablePath: process.env.BROWSER_PATH }
  : { channel: process.env.BROWSER_CHANNEL ?? "chrome" };
const browser = await chromium.launch({ ...launchOptions, headless: true });
const findings = [];
const pageReports = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce",
  });
  for (const route of PAGES) {
    const page = await context.newPage();
    let jsBytes = 0;
    let cssBytes = 0;
    let imageBytes = 0;
    page.on("response", async (response) => {
      try {
        const type = response.request().resourceType();
        // Decoded size (what the browser must parse), so numbers do not depend on server compression.
        const length = (await response.body()).length;
        if (type === "script") jsBytes += length;
        else if (type === "stylesheet") cssBytes += length;
        else if (type === "image" || type === "media") imageBytes += length;
      } catch {
        /* body unavailable (redirect/aborted) */
      }
    });
    await page.addInitScript(() => {
      window.__vitals = { lcp: 0, cls: 0, longTasks: 0, shifts: [] };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__vitals.lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__vitals.cls += entry.value;
          // Keep each shift's sources so a failing budget can be attributed to an element.
          window.__vitals.shifts.push({
            value: Math.round(entry.value * 1000) / 1000,
            at: Math.round(entry.startTime),
            sources: (entry.sources || [])
              .slice(0, 3)
              .map((source) =>
                String(
                  (source.node && (source.node.className || source.node.tagName)) || "?",
                ).slice(0, 60),
              ),
            fontsStatus: document.fonts ? document.fonts.status : "n/a",
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__vitals.longTasks += entry.duration;
      }).observe({ type: "longtask", buffered: true });
    });
    const response = await page.goto(baseUrl + route, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    await page.addScriptTag({ content: axeSource });
    const axeResult = await page.evaluate(async () =>
      axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
        },
        rules: { region: { enabled: false } },
      }),
    );
    const vitals = await page.evaluate(() => window.__vitals);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    const entry = {
      route,
      viewport: viewport.name,
      status: response?.status() ?? 0,
      lcpMs: Math.round(vitals.lcp),
      cls: Math.round(vitals.cls * 1000) / 1000,
      shifts: vitals.cls > budget.clsMax ? vitals.shifts : undefined,
      longTaskMs: Math.round(vitals.longTasks),
      jsKb: Math.round(jsBytes / 1024),
      cssKb: Math.round(cssBytes / 1024),
      imageKb: Math.round(imageBytes / 1024),
      horizontalOverflowPx: overflow,
      axeViolations: axeResult.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        sample: v.nodes[0]?.target?.join(" "),
        detail: v.nodes[0]?.any?.[0]?.message ?? v.nodes[0]?.failureSummary?.slice(0, 160),
      })),
    };
    pageReports.push(entry);
    for (const violation of entry.axeViolations)
      findings.push(
        `${viewport.name} ${route}: axe ${violation.id} (${violation.impact}) x${violation.nodes} ${violation.sample ?? ""}`,
      );
    if (entry.status !== 200) findings.push(`${viewport.name} ${route}: HTTP ${entry.status}`);
    if (overflow > 1) findings.push(`${viewport.name} ${route}: horizontal overflow ${overflow}px`);
    if (entry.lcpMs > budget.lcpMsMax)
      findings.push(`${viewport.name} ${route}: LCP ${entry.lcpMs}ms > ${budget.lcpMsMax}ms`);
    if (entry.cls > budget.clsMax)
      findings.push(`${viewport.name} ${route}: CLS ${entry.cls} > ${budget.clsMax}`);
    if (entry.jsKb > budget.jsDecodedKbMax)
      findings.push(`${viewport.name} ${route}: JS ${entry.jsKb}KB > ${budget.jsDecodedKbMax}KB`);
    if (entry.longTaskMs > budget.totalBlockingLikeLongTaskMsMax)
      findings.push(`${viewport.name} ${route}: long tasks ${entry.longTaskMs}ms`);
    await page.close();
  }
  await context.close();
}

// Keyboard: the first Tab stop is the skip link and it moves focus to the main landmark.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(baseUrl + "/about", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
  if (!/skip to main content/i.test(first ?? ""))
    findings.push(`keyboard: first Tab stop is "${first}", expected the skip link`);
  await page.keyboard.press("Enter");
  const target = await page.evaluate(() => document.activeElement?.id);
  if (target !== "main-content")
    findings.push(`keyboard: skip link focused "${target}", expected main-content`);
  // 320px reflow (WCAG 1.4.10)
  await page.setViewportSize({ width: 320, height: 640 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  if (overflow > 1)
    findings.push(`reflow: /about overflows horizontally by ${overflow}px at 320px`);
  await context.close();
}

const statusResults = [];
for (const [route, expected] of STATUS_CHECKS) {
  const response = await fetch(baseUrl + route, { redirect: "manual" });
  statusResults.push({ route, expected, actual: response.status });
  if (response.status !== expected)
    findings.push(`HTTP ${route}: expected ${expected}, got ${response.status}`);
}
await browser.close();

const summary = {
  baseUrl,
  browser: launchOptions.channel ?? launchOptions.executablePath,
  measuredAt: new Date().toISOString(),
  pages: pageReports.length,
  axeViolationTotal: pageReports.reduce((n, p) => n + p.axeViolations.length, 0),
  worstLcpMs: Math.max(...pageReports.map((p) => p.lcpMs)),
  worstCls: Math.max(...pageReports.map((p) => p.cls)),
  worstJsKb: Math.max(...pageReports.map((p) => p.jsKb)),
  worstImageKb: Math.max(...pageReports.map((p) => p.imageKb)),
  statusResults,
  findings,
  budget,
};
if (reportFile) writeFileSync(reportFile, JSON.stringify({ summary, pageReports }, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(findings.length ? 1 : 0);
