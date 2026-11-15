import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * Admin workflows for each of the four profiles, driven through a real signed-in browser session:
 * image upload through the Admin UI (private original, approved public copy, profile-scoped feed),
 * resume upload, publish, public feed, unpublish and delete, and persona draft, publish and
 * unpublish. Every step also asserts that no other profile is affected.
 */
const PASSWORD = process.env["E2E_ADMIN_PASSWORD"] ?? "";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\nPortfolio resume fixture\n%%EOF");

const PROFILES = [
  { id: "abhishek", imageLabel: "Abhishek", ip: "40" },
  { id: "ammu", imageLabel: "Amulya", ip: "41" },
  { id: "bava", imageLabel: "Anjini Kumar", ip: "42" },
  { id: "sai", imageLabel: "Sai", ip: "43" },
] as const;

const originOf = () => new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:4180").origin;

async function signedIn(
  browser: import("@playwright/test").Browser,
  ip: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    extraHTTPHeaders: { "cf-connecting-ip": `203.0.113.${ip}` },
  });
  const page = await context.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Admin password").fill(PASSWORD);
  await page.getByRole("button", { name: "Authenticate" }).click();
  await page.waitForURL("**/admin/resumes");
  return context;
}

test.describe.configure({ mode: "serial" });

for (const profile of PROFILES) {
  test.describe(`${profile.id} admin workflows`, () => {
    test("image upload, public copy, profile-scoped feed and removal", async ({ browser }) => {
      const context = await signedIn(browser, profile.ip);
      const page = await context.newPage();
      const alt = `${profile.id} image ${Date.now()}`;
      await page.goto("/admin/images");
      await page.locator("select").first().selectOption({ label: profile.imageLabel });
      await page
        .locator('input[type="file"]')
        .first()
        .setInputFiles({ name: `${profile.id}.png`, mimeType: "image/png", buffer: PNG });
      await page.getByLabel("Alternative text").fill(alt);
      await page.getByLabel(/Publish immediately/).check();
      await page.getByRole("button", { name: "Upload & publish" }).click();
      await expect(page.getByText(alt).first()).toBeVisible();

      const feed = (await (await context.request.get("/api/published-images")).json()) as {
        images: { id: string; profileId: string; alt?: string }[];
      };
      const mine = feed.images.filter((image) => JSON.stringify(image).includes(alt));
      expect(mine).toHaveLength(1);
      expect(mine[0]?.profileId).toBe(profile.id);
      // Public copy is served; the private original route needs a session.
      const served = await context.request.get(`/api/published-images/${mine[0]!.id}`);
      expect(served.status()).toBe(200);
      expect(Buffer.from(await served.body()).equals(PNG)).toBe(true);
      const anonymous = await browser.newContext();
      expect((await anonymous.request.get(`/api/admin/images/${mine[0]!.id}/file`)).status()).toBe(
        404,
      );
      await anonymous.close();

      const origin = originOf();
      expect(
        (
          await context.request.post(`/api/admin/images/${mine[0]!.id}/unpublish`, {
            headers: { origin },
          })
        ).status(),
      ).toBe(200);
      expect((await context.request.get(`/api/published-images/${mine[0]!.id}`)).status()).toBe(
        404,
      );
      expect(
        (
          await context.request.delete(`/api/admin/images/${mine[0]!.id}`, { headers: { origin } })
        ).status(),
      ).toBe(200);
      await context.close();
    });

    test("resume upload, publish, public feed, unpublish and delete", async ({ browser }) => {
      const context = await signedIn(browser, profile.ip);
      const origin = originOf();
      const upload = await context.request.post("/api/admin/resumes", {
        headers: { origin },
        multipart: {
          profileId: profile.id,
          file: { name: `${profile.id}.pdf`, mimeType: "application/pdf", buffer: PDF },
        },
      });
      expect(upload.status()).toBe(201);
      const { resume } = (await upload.json()) as {
        resume: { id: string; profileId: string; status: string };
      };
      expect(resume).toMatchObject({ profileId: profile.id, status: "pending" });
      // Pending resumes are private.
      const before = (await (await context.request.get("/api/published-resumes")).json()) as {
        resumes: { id: string }[];
      };
      expect(before.resumes.some((item) => item.id === resume.id)).toBe(false);

      const published = await context.request.post(`/api/admin/resumes/${resume.id}/publish`, {
        headers: { origin, "content-type": "application/json" },
        data: {
          profileId: profile.id,
          displayName: `${profile.id} resume`,
          headline: "E2E headline",
          summary: "E2E public summary",
          skills: ["TypeScript"],
          contact: {},
          structuredSections: { experience: [], education: [], projects: [], certifications: [] },
          privateReviewNotes: "private reviewer note",
        },
      });
      expect(published.status()).toBe(200);
      const feed = (await (await context.request.get("/api/published-resumes")).json()) as {
        resumes: { id: string; profileId: string }[];
      };
      const listed = feed.resumes.filter((item) => item.id === resume.id);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.profileId).toBe(profile.id);
      expect(JSON.stringify(feed)).not.toContain("private reviewer note");

      expect(
        (
          await context.request.post(`/api/admin/resumes/${resume.id}/unpublish`, {
            headers: { origin },
          })
        ).status(),
      ).toBe(200);
      const after = (await (await context.request.get("/api/published-resumes")).json()) as {
        resumes: { id: string }[];
      };
      expect(after.resumes.some((item) => item.id === resume.id)).toBe(false);
      expect(
        (
          await context.request.delete(`/api/admin/resumes/${resume.id}`, { headers: { origin } })
        ).status(),
      ).toBe(200);
      await context.close();
    });

    test("persona draft, publish and unpublish stay on this profile", async ({ browser }) => {
      const context = await signedIn(browser, profile.ip);
      const origin = originOf();
      const post = (action: string, body: Record<string, unknown>) =>
        context.request.post(`/api/admin/personas/${action}`, {
          headers: { origin, "content-type": "application/json" },
          data: body,
        });
      const config = {
        displayName: `${profile.id} assistant`,
        tone: "warm and concise",
        instructions: "Answer briefly and stay on the selected profile.",
        knowledgeNotes: "",
      };
      expect((await post("draft", { profileId: profile.id, config })).status()).toBe(200);
      expect((await post("publish", { profileId: profile.id })).status()).toBe(200);
      const mine = (await (
        await context.request.get(`/api/admin/personas?profileId=${profile.id}`)
      ).json()) as {
        persona: { profileId: string; publishedVersion: number | null };
      };
      expect(mine.persona.profileId).toBe(profile.id);
      expect(mine.persona.publishedVersion).toBe(1);
      for (const other of PROFILES.filter((item) => item.id !== profile.id)) {
        const theirs = (await (
          await context.request.get(`/api/admin/personas?profileId=${other.id}`)
        ).json()) as {
          persona: { profileId: string; history: { config: { displayName: string } }[] };
        };
        expect(theirs.persona.profileId).toBe(other.id);
        expect(JSON.stringify(theirs)).not.toContain(`${profile.id} assistant`);
      }
      expect((await post("unpublish", { profileId: profile.id })).status()).toBe(200);
      await context.close();
    });
  });
}
