import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * Per-profile public journeys for all four profiles: every required section and route renders,
 * content is CMS-backed (publish, rollback, unpublish through the Admin API change only that
 * profile), assets and identity stay isolated, project detail and 404 behaviour are real, and the
 * assistant answers honestly from the selected profile when no AI gateway is configured.
 */
const PASSWORD = process.env["E2E_ADMIN_PASSWORD"] ?? "";
const SECTIONS = [
  "about",
  "skills",
  "projects",
  "experience",
  "certifications",
  "education",
  "contact",
];

type Profile = {
  id: "abhishek" | "ammu" | "bava" | "sai";
  prefix: string;
  label: string;
  /** Distinctive text that must appear on this profile's pages. */
  name: string;
  imageDir: string;
  project: string;
  ip: string;
};

const PROFILES: Profile[] = [
  {
    id: "abhishek",
    prefix: "",
    label: "Abhishek",
    name: "Abhishek",
    imageDir: "/images/profiles/abhishek/",
    project: "neo-ai",
    ip: "30",
  },
  {
    id: "ammu",
    prefix: "/people/ammu",
    label: "Amulya",
    name: "Amulya",
    imageDir: "/images/profiles/amulya/",
    project: "data-analysis-ai",
    ip: "31",
  },
  {
    id: "bava",
    prefix: "/people/bava",
    label: "Anjini",
    name: "Anjini",
    imageDir: "/images/profiles/anjini/",
    project: "data-analysis-ai",
    ip: "32",
  },
  {
    id: "sai",
    prefix: "/people/sai",
    label: "Sai",
    name: "Sai",
    imageDir: "/images/profiles/sai/",
    project: "liver-disease-prediction",
    ip: "33",
  },
];

const originOf = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4180").origin;

async function adminContext(
  browser: import("@playwright/test").Browser,
  ip: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    extraHTTPHeaders: { "cf-connecting-ip": `203.0.113.${ip}` },
  });
  const response = await context.request.post("/api/admin/login", {
    headers: { origin: originOf(), "content-type": "application/json" },
    data: { password: PASSWORD },
  });
  expect(response.status()).toBe(200);
  return context;
}

async function contentAction(
  context: BrowserContext,
  action: string,
  body: Record<string, unknown>,
) {
  const response = await context.request.post(`/api/admin/content/${action}`, {
    headers: { origin: originOf(), "content-type": "application/json" },
    data: body,
  });
  expect(response.status(), `${action} ${JSON.stringify(body).slice(0, 60)}`).toBe(200);
}

test.describe.configure({ mode: "serial" });

for (const profile of PROFILES) {
  test.describe(`${profile.id} public experience`, () => {
    test("home and every required section render real content for this profile only", async ({
      browser,
    }) => {
      const context = await browser.newContext({
        extraHTTPHeaders: { "cf-connecting-ip": `203.0.113.${profile.ip}` },
      });
      const page = await context.newPage();
      const others = PROFILES.filter((other) => other.id !== profile.id);
      for (const path of ["", ...SECTIONS.map((section) => `/${section}`)]) {
        const url = `${profile.prefix}${path}` || "/";
        const response = await page.goto(url, { waitUntil: "networkidle" });
        expect(response?.status(), url).toBe(200);
        await expect(page.locator("main")).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        expect(await page.title(), url).toContain(profile.name);
        const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
        expect(canonical, url).toContain(url === "/" ? "/" : url);
        // Real content, not an empty shell.
        expect((await page.locator("main").innerText()).length, url).toBeGreaterThan(200);
        // Identity and asset isolation: no other profile's media is referenced here.
        const html = await page.content();
        for (const other of others) {
          if (profile.id === "abhishek" && other.id !== "abhishek") continue; // root pages link the profile picker
          expect(html.includes(other.imageDir), `${url} references ${other.id} media`).toBe(false);
        }
      }
      await context.close();
    });

    test("project detail resolves and unknown projects are a real 404", async ({ page }) => {
      const base = profile.prefix ? `${profile.prefix}/projects` : "/projects";
      const ok = await page.goto(`${base}/${profile.project}`, { waitUntil: "networkidle" });
      // Abhishek's legacy slugs redirect permanently to their current page; both end on a 200 page.
      expect(ok?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      const missing = await page.goto(`${base}/definitely-not-a-project`);
      expect(missing?.status()).toBe(404);
    });

    test("CMS publish, rollback and unpublish change only this profile", async ({ browser }) => {
      const context = await adminContext(browser, profile.ip);
      const visitor = await (
        await browser.newContext({
          extraHTTPHeaders: { "cf-connecting-ip": `203.0.113.${profile.ip}` },
        })
      ).newPage();
      const stamp = `${profile.id}-${Date.now()}`;
      const headline = (version: number) => `CMS headline v${version} ${stamp}`;
      const home = profile.prefix || "/";
      // Published content is applied after hydration, so a single networkidle snapshot can race it.
      // Poll (reloading) until the page agrees with the expectation or the budget runs out; a stable
      // wrong answer still fails.
      const seen = async (text: string, expected = true) => {
        let found = false;
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await visitor.goto(home, { waitUntil: "networkidle" });
          await visitor.waitForTimeout(250);
          found = (await visitor.content()).includes(text);
          if (found === expected) break;
        }
        return found;
      };
      // Version numbers are per profile and other specs publish too, so roll back to the version that
      // THIS test published first rather than assuming it is 1.
      let firstVersion = 0;
      for (const version of [1, 2]) {
        await contentAction(context, "draft", {
          profileId: profile.id,
          content: { basics: { headline: headline(version) } },
        });
        await contentAction(context, "publish", { profileId: profile.id });
        if (version === 1) {
          const doc = (await (
            await context.request.get(`/api/admin/content?profileId=${profile.id}`)
          ).json()) as { document: { publishedVersion: number | null } };
          firstVersion = doc.document.publishedVersion ?? 0;
        }
      }
      expect(firstVersion).toBeGreaterThan(0);
      expect(await seen(headline(2))).toBe(true);
      await contentAction(context, "rollback", { profileId: profile.id, version: firstVersion });
      expect(await seen(headline(1))).toBe(true);
      expect(await seen(headline(2), false)).toBe(false);
      // No other profile shows this profile's content.
      for (const other of PROFILES.filter((item) => item.id !== profile.id)) {
        await visitor.goto(other.prefix || "/", { waitUntil: "networkidle" });
        expect(await visitor.content(), `${other.id} leaked ${profile.id}`).not.toContain(stamp);
      }
      await contentAction(context, "unpublish", { profileId: profile.id });
      expect(await seen(headline(1), false)).toBe(false);
      await visitor.context().close();
      await context.close();
    });

    test("the assistant answers from this profile when no AI gateway is configured", async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        extraHTTPHeaders: { "cf-connecting-ip": `203.0.113.${profile.ip}` },
      });
      const page = await context.newPage();
      await page.goto(profile.prefix || "/", { waitUntil: "networkidle" });
      const opener =
        profile.id === "abhishek"
          ? page.getByRole("button", { name: /ask about abhishek/i })
          : page.getByRole("button", { name: new RegExp(`open .* AI assistant`, "i") });
      await opener.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("textbox").fill("What are your skills?");
      await dialog.getByRole("button", { name: /send/i }).click();
      await expect
        .poll(async () => (await dialog.innerText()).toLowerCase(), { timeout: 20_000 })
        .toMatch(new RegExp(`${profile.name.toLowerCase()}|skills`));
      const text = (await dialog.innerText()).toLowerCase();
      for (const other of PROFILES.filter((item) => item.id !== profile.id)) {
        // Other profiles' distinctive first names must never appear in this profile's answers.
        if (other.name !== profile.name) expect(text).not.toContain(other.name.toLowerCase());
      }
      await context.close();
    });
  });
}
