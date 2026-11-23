// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  contentKey,
  emptyContentDocument,
  publishContentDraft,
  saveContentDraft,
  unpublishContent,
  type ContentOverrides,
  type ContentProfileId,
} from "@/lib/cms-content";
import { MemoryR2 } from "./helpers/memory-r2";

// SSR is replaced by a renderer that emits the same head tags the real app does (see seoHead).
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: (request: Request) => {
      const path = new URL(request.url).pathname;
      const head =
        `<html><head><title>Default — ${path}</title><meta name="description" content="default description"/>` +
        '<meta property="og:title" content="Default"/><meta property="og:description" content="default description"/>' +
        '<meta name="twitter:title" content="Default"/><meta name="twitter:description" content="default description"/>' +
        '<meta property="og:image" content="/default.png"/><meta name="twitter:image" content="/default.png"/>' +
        '<meta property="og:image:alt" content="default"/><meta name="twitter:image:alt" content="default"/>' +
        "</head><body>page</body></html>";
      return new Response(head, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  },
}));
const { default: server } = await import("@/server");

const NOW = "2026-01-01T00:00:00.000Z";
const ORIGIN = "https://portfolio.test";
const env = (r2: MemoryR2) => ({ ENVIRONMENT: "production", RESUME_BUCKET: r2 });
const html = async (r2: MemoryR2, path: string) =>
  (await server.fetch(new Request(ORIGIN + path), env(r2), {})).text();

async function publish(r2: MemoryR2, id: ContentProfileId, content: ContentOverrides) {
  const doc = publishContentDraft(saveContentDraft(emptyContentDocument(id), content, NOW), NOW);
  await r2.put(contentKey(id), JSON.stringify(doc));
}

describe("published SEO in server-rendered HTML", () => {
  it("serves curated defaults when nothing is published", async () => {
    const page = await html(new MemoryR2(), "/people/ammu/about");
    expect(page).toContain("default description");
    expect(page).toContain("Default — /people/ammu/about");
  });

  it("applies the published title and description to the right profile page only", async () => {
    const r2 = new MemoryR2();
    await publish(r2, "ammu", {
      seo: { about: { title: "Amulya — Data & AI", description: "Published words" } },
    });
    const about = await html(r2, "/people/ammu/about");
    expect(about).toContain("<title>Amulya — Data &amp; AI</title>");
    expect(about).toContain('<meta property="og:description" content="Published words"/>');
    expect(about).toContain('<meta name="twitter:title" content="Amulya — Data &amp; AI"/>');
    // Another section of the same profile, and other profiles, keep their defaults.
    expect(await html(r2, "/people/ammu/skills")).toContain("default description");
    expect(await html(r2, "/people/sai/about")).toContain("default description");
    expect(await html(r2, "/about")).toContain("default description");
  });

  it("covers Abhishek's root pages and follows unpublish and draft state", async () => {
    const r2 = new MemoryR2();
    await publish(r2, "abhishek", { seo: { home: { title: "Home title" } } });
    expect(await html(r2, "/")).toContain("<title>Home title</title>");
    // A later draft is not public.
    const published = JSON.parse(r2.text(contentKey("abhishek"))!);
    expect(published.publishedVersion).toBe(1);
    await r2.put(
      contentKey("abhishek"),
      JSON.stringify(saveContentDraft(published, { seo: { home: { title: "Draft title" } } }, NOW)),
    );
    expect(await html(r2, "/")).toContain("<title>Home title</title>");
    expect(await html(r2, "/")).not.toContain("Draft title");
    await r2.put(contentKey("abhishek"), JSON.stringify(unpublishContent(published)));
    expect(await html(r2, "/")).toContain("Default — /");
  });

  it("uses the CMS project title/description and an approved project image as social data", async () => {
    const r2 = new MemoryR2();
    await publish(r2, "sai", {
      projects: [{ slug: "fresh-page", title: "Fresh Page", overview: "Brand new work." }],
    });
    await r2.put(
      "private-admin/images/index.json",
      JSON.stringify([
        {
          id: "11111111-1111-4111-8111-111111111111",
          filename: "x.png",
          contentType: "image/png",
          size: 8,
          uploadedAt: NOW,
          profileId: "sai",
          status: "pending",
          slot: "project",
          projectSlug: "fresh-page",
          alt: "pending",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          filename: "x.png",
          contentType: "image/png",
          size: 8,
          uploadedAt: NOW,
          profileId: "sai",
          status: "approved",
          slot: "project",
          projectSlug: "fresh-page",
          alt: "Cover shot",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          filename: "x.png",
          contentType: "image/png",
          size: 8,
          uploadedAt: NOW,
          profileId: "ammu",
          status: "approved",
          slot: "project",
          projectSlug: "fresh-page",
          alt: "wrong profile",
        },
      ]),
    );
    const page = await html(r2, "/people/sai/projects/fresh-page");
    expect(page).toMatch(/<title>Fresh Page — [^<]+<\/title>/);
    expect(page).toContain('content="Brand new work."');
    expect(page).toContain(
      '<meta property="og:image" content="/api/published-images/22222222-2222-4222-8222-222222222222"/>',
    );
    expect(page).toContain('<meta property="og:image:alt" content="Cover shot"/>');
    expect(page).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(page).not.toContain("33333333-3333-4333-8333-333333333333");
  });

  it("never rewrites admin or non-HTML responses and survives unreadable CMS state", async () => {
    const r2 = new MemoryR2();
    await r2.put(contentKey("ammu"), "not json");
    expect(await html(r2, "/people/ammu/about")).toContain("default description");
    const admin = await server.fetch(new Request(`${ORIGIN}/admin`), env(r2), {});
    expect(admin.status).toBe(404);
  });

  // E2:D6.7 / E2:D6.9: one storage read of the content document per project page view, and no
  // cross-request memory, so an unpublish is visible on the very next request.
  it("reads the content document once per project page view and never across requests", async () => {
    const r2 = new MemoryR2();
    await publish(r2, "ammu", {
      projects: [{ slug: "scoped-read", title: "Scoped read", overview: "Brand new work." }],
    } as ContentOverrides);
    const key = contentKey("ammu");
    const original = r2.get.bind(r2);
    let reads = 0;
    r2.get = ((k: string, ...rest: unknown[]) => {
      if (k === key) reads += 1;
      return (original as (...a: unknown[]) => unknown)(k, ...rest);
    }) as typeof r2.get;
    const first = await server.fetch(
      new Request(ORIGIN + "/people/ammu/projects/scoped-read"),
      env(r2),
      {},
    );
    expect(first.status).toBe(200);
    expect(reads).toBe(1);
    await r2.put(key, JSON.stringify(unpublishContent(JSON.parse(r2.text(key)!))));
    const second = await server.fetch(
      new Request(ORIGIN + "/people/ammu/projects/scoped-read"),
      env(r2),
      {},
    );
    expect(second.status).toBe(404);
    expect(reads).toBe(2);
  });
});
