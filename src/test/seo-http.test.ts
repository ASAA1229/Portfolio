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
import { publicRoutes } from "@/lib/seo";
import { PERSON_PORTFOLIOS } from "@/lib/person-portfolios";
import { projectSlugs } from "@/lib/site-data";
import { MemoryR2 } from "./helpers/memory-r2";

// The SSR entry cannot boot under Vitest; it is replaced by an always-200 renderer so these tests
// observe exactly the status decisions made by the Worker (src/server.ts) on top of it.
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: (request: Request) =>
      new Response(`<html><body>${new URL(request.url).pathname}</body></html>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
  },
}));
const { default: server } = await import("@/server");

const ORIGIN = "https://portfolio.test";
const NOW = "2026-01-01T00:00:00.000Z";

async function publish(r2: MemoryR2, id: ContentProfileId, content: ContentOverrides) {
  const doc = publishContentDraft(saveContentDraft(emptyContentDocument(id), content, NOW), NOW);
  await r2.put(contentKey(id), JSON.stringify(doc));
}

const env = (r2: MemoryR2) => ({ ENVIRONMENT: "production", RESUME_BUCKET: r2 });
const get = (r2: MemoryR2, path: string) => server.fetch(new Request(ORIGIN + path), env(r2), {});

async function sitemapLocs(r2: MemoryR2): Promise<string[]> {
  const xml = await (await get(r2, "/sitemap.xml")).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.replace(ORIGIN, ""));
}

describe("sitemap reflects only what is really published", () => {
  it("serves XML with absolute URLs and a short revalidating cache", async () => {
    const response = await get(new MemoryR2(), "/sitemap.xml");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    expect(response.headers.get("cache-control")).toContain("must-revalidate");
    const xml = await response.text();
    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
    expect(xml).not.toMatch(/\/admin|\/api\//);
  });

  it("matches the curated routes when nothing has been published", async () => {
    expect(await sitemapLocs(new MemoryR2())).toEqual(publicRoutes());
  });

  it("drops archived projects, lists published additions and ignores drafts", async () => {
    const r2 = new MemoryR2();
    const archived = PERSON_PORTFOLIOS.ammu.projects[0]!.slug;
    await publish(r2, "ammu", {
      projects: [
        { slug: archived, title: "x", overview: "y", archived: true },
        { slug: "brand-new-project", title: "New", overview: "Fresh" },
      ],
    });
    // A draft-only addition for another profile must not appear.
    await r2.put(
      contentKey("sai"),
      JSON.stringify(
        saveContentDraft(
          emptyContentDocument("sai"),
          { projects: [{ slug: "draft-only", title: "D", overview: "D" }] },
          NOW,
        ),
      ),
    );
    // An unpublished (formerly published) addition must not appear either.
    const unpublished = unpublishContent(
      publishContentDraft(
        saveContentDraft(
          emptyContentDocument("bava"),
          { projects: [{ slug: "was-published", title: "W", overview: "W" }] },
          NOW,
        ),
        NOW,
      ),
    );
    await r2.put(contentKey("bava"), JSON.stringify(unpublished));

    const locs = await sitemapLocs(r2);
    expect(locs).not.toContain(`/people/ammu/projects/${archived}`);
    expect(locs).toContain("/people/ammu/projects/brand-new-project");
    expect(locs).not.toContain("/people/sai/projects/draft-only");
    expect(locs).not.toContain("/people/bava/projects/was-published");
    // Other profiles' curated projects are untouched.
    for (const project of PERSON_PORTFOLIOS.bava.projects) {
      expect(locs).toContain(`/people/bava/projects/${project.slug}`);
    }
  });

  it("applies Abhishek's root project edits and an explicit empty person list", async () => {
    const r2 = new MemoryR2();
    await publish(r2, "abhishek", {
      projects: [
        { slug: projectSlugs[0]!, title: "x", overview: "y", archived: true },
        { slug: "root-extra", title: "Extra", overview: "Extra" },
      ],
    });
    await publish(r2, "sai", { projects: [] });
    const locs = await sitemapLocs(r2);
    expect(locs).not.toContain(`/projects/${projectSlugs[0]}`);
    expect(locs).toContain("/projects/root-extra");
    expect(locs.filter((loc) => loc.startsWith("/people/sai/projects/"))).toEqual([]);
  });

  it("falls back to curated routes when the bucket is absent or unreadable", async () => {
    const response = await server.fetch(
      new Request(`${ORIGIN}/sitemap.xml`),
      { ENVIRONMENT: "production" },
      {},
    );
    expect(response.status).toBe(200);
    const r2 = new MemoryR2();
    await r2.put(contentKey("ammu"), "not json");
    expect((await sitemapLocs(r2)).length).toBe(publicRoutes().length);
  });
});

describe("robots.txt", () => {
  it("blocks private areas and points at the sitemap", async () => {
    const response = await get(new MemoryR2(), "/robots.txt");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Disallow: /admin");
    expect(text).toContain("Disallow: /api/");
    expect(text).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});

describe("real 404 status for missing project pages", () => {
  it("returns 200 for existing curated pages and 404 for unknown project slugs", async () => {
    const r2 = new MemoryR2();
    expect((await get(r2, `/projects/${projectSlugs[0]}`)).status).toBe(200);
    expect((await get(r2, "/projects/does-not-exist")).status).toBe(404);
    const ammu = PERSON_PORTFOLIOS.ammu.projects[0]!.slug;
    expect((await get(r2, `/people/ammu/projects/${ammu}`)).status).toBe(200);
    expect((await get(r2, "/people/ammu/projects/does-not-exist")).status).toBe(404);
    // A slug that belongs to another profile is not available under this one.
    const bava = PERSON_PORTFOLIOS.bava.projects[0]!.slug;
    if (!PERSON_PORTFOLIOS.ammu.projects.some((project) => project.slug === bava)) {
      expect((await get(r2, `/people/ammu/projects/${bava}`)).status).toBe(404);
    }
  });

  it("follows publish, archive and unpublish for project pages", async () => {
    const r2 = new MemoryR2();
    const slug = PERSON_PORTFOLIOS.sai.projects[0]!.slug;
    await publish(r2, "sai", { projects: [{ slug: "fresh-page", title: "F", overview: "F" }] });
    expect((await get(r2, "/people/sai/projects/fresh-page")).status).toBe(200);
    await publish(r2, "sai", { projects: [{ slug, title: "x", overview: "y", archived: true }] });
    expect((await get(r2, `/people/sai/projects/${slug}`)).status).toBe(404);
    expect((await get(r2, "/people/sai/projects/fresh-page")).status).toBe(404);
    await r2.put(
      contentKey("sai"),
      JSON.stringify(
        unpublishContent(
          publishContentDraft(
            saveContentDraft(emptyContentDocument("sai"), { projects: [] }, NOW),
            NOW,
          ),
        ),
      ),
    );
    expect((await get(r2, `/people/sai/projects/${slug}`)).status).toBe(200);
  });

  it("never disagrees with the sitemap: every listed project URL resolves, every archived one 404s", async () => {
    const r2 = new MemoryR2();
    await publish(r2, "bava", {
      projects: [
        {
          slug: PERSON_PORTFOLIOS.bava.projects[0]!.slug,
          title: "x",
          overview: "y",
          archived: true,
        },
        { slug: "added-page", title: "A", overview: "A" },
      ],
    });
    await publish(r2, "abhishek", {
      projects: [{ slug: projectSlugs[0]!, title: "x", overview: "y", archived: true }],
    });
    for (const loc of await sitemapLocs(r2)) {
      expect((await get(r2, loc)).status, loc).toBe(200);
    }
    expect(
      (await get(r2, `/people/bava/projects/${PERSON_PORTFOLIOS.bava.projects[0]!.slug}`)).status,
    ).toBe(404);
    expect((await get(r2, `/projects/${projectSlugs[0]}`)).status).toBe(404);
  });
});
