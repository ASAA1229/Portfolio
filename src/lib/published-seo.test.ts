import { describe, expect, it } from "vitest";
import { publishedSeoFor, rewriteSeoHead, seoTargetForPath } from "@/lib/published-seo";

const HEAD =
  '<head><title>About — X</title><meta name="description" content="old"/>' +
  '<meta property="og:title" content="About — X"/><meta property="og:description" content="old"/>' +
  '<meta name="twitter:title" content="About — X"/><meta name="twitter:description" content="old"/>' +
  '<meta property="og:image" content="/a.png"/><meta name="twitter:image" content="/a.png"/>' +
  '<meta property="og:image:alt" content="a"/><meta name="twitter:image:alt" content="a"/></head>';

describe("seoTargetForPath", () => {
  it.each([
    ["/", { profileId: "abhishek", page: "home" }],
    ["/about", { profileId: "abhishek", page: "about" }],
    ["/projects/neo-ai", { profileId: "abhishek", page: "projects", projectSlug: "neo-ai" }],
    ["/people/ammu", { profileId: "ammu", page: "home" }],
    ["/people/bava/education/", { profileId: "bava", page: "education" }],
    ["/people/sai/projects/x-1", { profileId: "sai", page: "projects", projectSlug: "x-1" }],
  ])("%s", (path, expected) => {
    expect(seoTargetForPath(path)).toEqual(expected);
  });

  it.each([
    "/admin",
    "/api/chat",
    "/people/nobody",
    "/people/ammu/nope",
    "/profiles",
    "/privacy",
    "/sitemap.xml",
  ])("does not target %s", (path) => {
    expect(seoTargetForPath(path)).toBeNull();
  });
});

describe("publishedSeoFor", () => {
  it("uses the published page entry and ignores absent or empty ones", () => {
    const seo = { about: { title: "Custom", description: "Desc" }, skills: {} };
    expect(publishedSeoFor({ profileId: "ammu", page: "about" }, { seo }, "Amulya")).toEqual({
      title: "Custom",
      description: "Desc",
    });
    expect(publishedSeoFor({ profileId: "ammu", page: "skills" }, { seo }, "Amulya")).toBeNull();
    expect(publishedSeoFor({ profileId: "ammu", page: "about" }, null, "Amulya")).toBeNull();
  });

  it("derives CMS-created project metadata and hides archived projects", () => {
    const projects = [
      { slug: "new-one", title: "New One", overview: "  An  overview\nthat wraps. " },
      { slug: "gone", title: "Gone", overview: "x", archived: true },
    ];
    expect(
      publishedSeoFor(
        { profileId: "sai", page: "projects", projectSlug: "new-one" },
        { projects },
        "Sai",
      ),
    ).toEqual({ title: "New One — Sai", description: "An overview that wraps." });
    expect(
      publishedSeoFor(
        { profileId: "sai", page: "projects", projectSlug: "gone" },
        { projects },
        "Sai",
      ),
    ).toBeNull();
    expect(
      publishedSeoFor(
        { profileId: "sai", page: "projects", projectSlug: "curated" },
        { projects },
        "Sai",
      ),
    ).toBeNull();
  });
});

describe("rewriteSeoHead", () => {
  it("replaces title, description, Open Graph, Twitter and image tags", () => {
    const out = rewriteSeoHead(HEAD, {
      title: "New title",
      description: "New description",
      image: "https://x.test/i.png",
      imageAlt: "alt text",
    });
    expect(out).toContain("<title>New title</title>");
    expect(out).toContain('<meta name="description" content="New description"/>');
    expect(out).toContain('<meta property="og:title" content="New title"/>');
    expect(out).toContain('<meta name="twitter:description" content="New description"/>');
    expect(out).toContain('<meta property="og:image" content="https://x.test/i.png"/>');
    expect(out).toContain('<meta name="twitter:image:alt" content="alt text"/>');
    expect(out).not.toContain("old");
  });

  it("escapes markup and leaves untouched fields alone", () => {
    const out = rewriteSeoHead(HEAD, { title: 'A "quoted" <b>&</b>' });
    expect(out).toContain("<title>A &quot;quoted&quot; &lt;b&gt;&amp;&lt;/b&gt;</title>");
    expect(out).not.toContain("<b>");
    expect(out).toContain('<meta name="description" content="old"/>');
  });
});
