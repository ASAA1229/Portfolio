import { readFileSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const PASSWORD = process.env["E2E_ADMIN_PASSWORD"] ?? "";
// 1x1 PNG: real signature and dimensions so server-side image validation accepts it.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// The server throttles by client address; each journey uses its own address so they stay independent.
const ip = (label: string) => ({ "cf-connecting-ip": `203.0.113.${label}` });
const originOf = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4180").origin;

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Admin password").fill(PASSWORD);
  await page.getByRole("button", { name: "Authenticate" }).click();
  await page.waitForURL("**/admin/resumes");
}

async function signedInContext(browser: Browser, address: string): Promise<BrowserContext> {
  const context = await browser.newContext({ extraHTTPHeaders: ip(address) });
  await login(await context.newPage());
  return context;
}

test.describe.configure({ mode: "serial" });

test("the run uses generated credentials", () => {
  expect(PASSWORD.length).toBeGreaterThanOrEqual(12);
});

test("Admin pages and APIs are invisible without a session", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: ip("10") });
  const page = await context.newPage();
  for (const path of ["/admin", "/admin/content", "/admin/images", "/admin/backup"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
  const api = await context.request.get("/api/admin/audit");
  expect(api.status()).toBe(404);
  expect(api.headers()["x-robots-tag"]).toContain("noindex");
  await context.close();
});

test("a wrong password is rejected and the right one starts a hardened session", async ({
  browser,
}) => {
  const context = await browser.newContext({ extraHTTPHeaders: ip("11") });
  const page = await context.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Admin password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Authenticate" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid credentials");

  await page.getByLabel("Admin password").fill(PASSWORD);
  await page.getByRole("button", { name: "Authenticate" }).click();
  await page.waitForURL("**/admin/resumes");
  const cookie = (await context.cookies()).find((c) => c.name === "portfolio_admin_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  expect((await context.request.get("/api/admin/session")).status()).toBe(200);
  await context.close();
});

test("repeated failed logins are throttled, even for the correct password", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: ip("12") });
  const origin = originOf();
  const attempt = (password: string) =>
    context.request.post("/api/admin/login", {
      headers: { origin, "content-type": "application/json" },
      data: { password },
    });
  for (let i = 0; i < 5; i += 1) expect((await attempt("wrong-password-value")).status()).toBe(401);
  const blocked = await attempt("wrong-password-value");
  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
  expect((await attempt(PASSWORD)).status()).toBe(429);
  // A different client is unaffected.
  const other = await browser.newContext({ extraHTTPHeaders: ip("13") });
  const ok = await other.request.post("/api/admin/login", {
    headers: { origin, "content-type": "application/json" },
    data: { password: PASSWORD },
  });
  expect(ok.status()).toBe(200);
  await context.close();
  await other.close();
});

test("cross-origin and origin-less mutations are rejected even with a valid session", async ({
  browser,
}) => {
  const context = await signedInContext(browser, "14");
  const origin = originOf();
  const body = { profileId: "ammu", content: { basics: { headline: "csrf probe" } } };
  const draft = (headers: Record<string, string>) =>
    context.request.post("/api/admin/content/draft", { headers, data: body });
  expect((await draft({ origin: "https://evil.example" })).status()).toBe(404);
  expect((await draft({ origin: "null" })).status()).toBe(404);
  expect((await draft({ origin, "sec-fetch-site": "cross-site" })).status()).toBe(404);
  expect((await draft({})).status()).toBe(404);
  // Nothing was written by the rejected attempts.
  const doc = (await (await context.request.get("/api/admin/content?profileId=ammu")).json()) as {
    document: { draft: unknown };
  };
  expect(doc.document.draft).toBeNull();
  expect((await draft({ origin })).status()).toBe(200);
  await context.close();
});

test("content edit, publish and public view (draft stays private until published)", async ({
  browser,
}) => {
  const context = await signedInContext(browser, "15");
  const page = await context.newPage();
  const headline = `E2E headline ${Date.now()}`;
  await page.goto("/admin/content");
  // The profile picker is the first select on the page (its label wraps the option text).
  await page.locator("select").first().selectOption({ label: "Amulya (Ammu)" });
  await page.getByLabel("Headline", { exact: true }).fill(headline);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved privately")).toBeVisible();

  const visitor = await browser.newContext({ extraHTTPHeaders: ip("16") });
  const publicPage = await visitor.newPage();
  await publicPage.goto("/people/ammu");
  await expect(publicPage.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(publicPage.getByText(headline)).toHaveCount(0);

  await page.getByRole("button", { name: "Publish draft" }).click();
  await expect(page.getByText("Published as version 1")).toBeVisible();
  await publicPage.goto("/people/ammu");
  await expect(publicPage.getByText(headline).first()).toBeVisible();
  // Another profile never shows it.
  await publicPage.goto("/people/sai");
  await expect(publicPage.getByText(headline)).toHaveCount(0);
  await visitor.close();
  await context.close();
});

test("image upload through the Admin UI becomes a published, profile-scoped image", async ({
  browser,
}) => {
  const context = await signedInContext(browser, "17");
  const page = await context.newPage();
  const alt = `E2E gallery image ${Date.now()}`;
  await page.goto("/admin/images");
  await page.locator("select").first().selectOption({ label: "Sai" });
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "e2e.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("Alternative text").fill(alt);
  await page.getByLabel(/Publish immediately/).check();
  await page.getByRole("button", { name: "Upload & publish" }).click();
  await expect(page.getByText(alt).first()).toBeVisible();

  const feed = await context.request.get("/api/published-images");
  expect(JSON.stringify(await feed.json())).toContain(alt);
  // The private original is only reachable with a session.
  const anonymous = await browser.newContext({ extraHTTPHeaders: ip("18") });
  expect((await anonymous.request.get("/api/admin/images")).status()).toBe(404);
  await anonymous.close();
  await context.close();
});

test("backup export contains the edited content and the uploaded image bytes", async ({
  browser,
}) => {
  const context = await signedInContext(browser, "19");
  const page = await context.newPage();
  await page.goto("/admin/backup");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download backup" }).click(),
  ]);
  const path = await download.path();
  const backup = JSON.parse(readFileSync(path, "utf8")) as {
    format: string;
    entries: Record<string, unknown>;
    files: Record<string, { sha256: string; size: number }>;
  };
  expect(backup.format).toBe("portfolio-admin-backup");
  expect(Object.keys(backup.entries)).toContain("private-admin/content/ammu.json");
  const imageFiles = Object.keys(backup.files).filter((key) => key.includes("/images/files/"));
  expect(imageFiles.length).toBeGreaterThan(0);
  expect(backup.files[imageFiles[0]!]!.size).toBe(PNG.length);
  await context.close();
});

test("logout-everywhere revokes the session", async ({ browser }) => {
  const context = await signedInContext(browser, "20");
  const origin = originOf();
  expect((await context.request.get("/api/admin/session")).status()).toBe(200);
  const out = await context.request.post("/api/admin/logout-all", { headers: { origin } });
  expect(out.status()).toBe(200);
  expect((await context.request.get("/api/admin/session")).status()).toBe(404);
  await context.close();
});
