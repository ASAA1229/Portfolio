import { describe, expect, it } from "vitest";
import { buildRobots, buildSitemap, publicRoutes } from "@/lib/seo";
import { absoluteUrl, configuredSiteUrl, seoHead } from "@/lib/seo-head";
import { findProject, LEGACY_PROJECT_SLUGS, projectSlugs } from "@/lib/site-data";
import { getProject } from "@/lib/project-pages";

describe("SEO head helper", () => {
  it("emits title, description, Open Graph, Twitter and canonical tags", () => {
    const head = seoHead({ title: "About — Guda Abhishek", description: "Bio", path: "/about" });
    const meta = Object.fromEntries(
      head.meta.map((tag) => [
        "title" in tag ? "title" : "property" in tag ? tag.property : tag.name,
        "title" in tag ? tag.title : tag.content,
      ]),
    );
    expect(meta).toMatchObject({
      title: "About — Guda Abhishek",
      description: "Bio",
      robots: "index, follow",
      "og:title": "About — Guda Abhishek",
      "og:description": "Bio",
      "og:url": "/about",
      "twitter:card": "summary_large_image",
      "og:site_name": "ABHISHEK: THE SERIES",
      "og:image": "/images/profiles/abhishek/abhishek_main.jpeg",
      "twitter:image": "/images/profiles/abhishek/abhishek_main.jpeg",
    });
    expect(head.links).toEqual([{ rel: "canonical", href: "/about" }]);
  });

  it("uses profile-scoped social images and absolute social URLs", () => {
    const head = seoHead({
      title: "Amulya — Portfolio",
      description: "Profile",
      path: "/people/ammu",
      image: "/images/profiles/amulya/amulya_main.webp",
      imageAlt: "Amulya profile portrait",
    });
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: "/images/profiles/amulya/amulya_main.webp",
    });
    expect(head.meta).toContainEqual({
      name: "twitter:image:alt",
      content: "Amulya profile portrait",
    });
  });

  it("marks private pages noindex and omits their canonical link", () => {
    const head = seoHead({ title: "Admin", description: "x", path: "/admin", noindex: true });
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex, nofollow, noarchive" });
    expect(head.links).toEqual([]);
  });

  it("builds absolute URLs only from a valid configured origin", () => {
    expect(configuredSiteUrl("https://portfolio.example.com/some/path")).toBe(
      "https://portfolio.example.com",
    );
    expect(configuredSiteUrl("javascript:alert(1)")).toBeNull();
    expect(configuredSiteUrl("not a url")).toBeNull();
    expect(absoluteUrl("/about", "https://portfolio.example.com")).toBe(
      "https://portfolio.example.com/about",
    );
    expect(absoluteUrl("about", null)).toBe("/about");
  });
});

describe("sitemap and robots", () => {
  it("lists every public profile, section and project route, never admin or API", () => {
    const routes = publicRoutes();
    for (const path of [
      "/",
      "/about",
      "/contact",
      "/profiles",
      "/people/ammu",
      "/people/sai/contact",
    ]) {
      expect(routes).toContain(path);
    }
    for (const person of ["ammu", "bava", "sai"]) {
      expect(
        routes.filter((path) => path.startsWith(`/people/${person}/projects/`)).length,
      ).toBeGreaterThan(0);
    }
    expect(routes.some((path) => path.startsWith("/admin") || path.startsWith("/api"))).toBe(false);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("renders a valid sitemap with absolute, escaped URLs", () => {
    const xml = buildSitemap("https://portfolio.example.com");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://portfolio.example.com/people/bava/experience</loc>");
    expect(xml.match(/<loc>/g)).toHaveLength(publicRoutes().length);
  });

  it("disallows private areas and points to the sitemap", () => {
    const robots = buildRobots("https://portfolio.example.com");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Sitemap: https://portfolio.example.com/sitemap.xml");
  });
});

describe("project links", () => {
  it("every listed project slug resolves to a detail page", () => {
    for (const slug of projectSlugs) {
      expect(getProject(slug), slug).toBeDefined();
      expect(findProject(slug), slug).toBeDefined();
    }
  });

  it("legacy slugs map to existing project pages", () => {
    for (const [legacy, current] of Object.entries(LEGACY_PROJECT_SLUGS)) {
      expect(getProject(legacy), legacy).toBeUndefined();
      expect(getProject(current), current).toBeDefined();
    }
  });
});
