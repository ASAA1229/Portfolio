import { PERSON_PORTFOLIOS, PERSON_SECTIONS } from "@/lib/person-portfolios";
import { projectSlugs } from "@/lib/site-data";
import { absoluteUrl } from "@/lib/seo-head";
import type { ContentOverrides, ContentProfileId } from "@/lib/cms-content";

/** Currently *published* CMS overrides per profile (null/absent = none, curated data applies). */
export type PublishedByProfile = Partial<Record<ContentProfileId, ContentOverrides | null>>;

/**
 * Project slugs that are really public for a profile: curated slugs, minus projects the owner
 * archived, plus owner-published additions. Mirrors the page merge so the sitemap never lists a
 * URL that answers 404 and never omits a published one. An explicit empty list clears person
 * profile projects (as mergePersonPortfolio does); Abhishek's root catalogue keeps its curated set.
 */
function publicProjectSlugs(
  curated: string[],
  overrides: ContentOverrides | null | undefined,
  emptyClears: boolean,
): string[] {
  const edits = overrides?.projects;
  if (!edits) return curated;
  if (edits.length === 0) return emptyClears ? [] : curated;
  const slugs = new Set(curated);
  for (const edit of edits) {
    if (edit.archived) slugs.delete(edit.slug);
    else slugs.add(edit.slug);
  }
  return [...slugs];
}

/** Every public, indexable route. Admin and API routes are deliberately excluded. */
export function publicRoutes(published: PublishedByProfile = {}): string[] {
  const root = [
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
  ];
  const rootProjects = publicProjectSlugs([...projectSlugs], published.abhishek, false).map(
    (slug) => `/projects/${slug}`,
  );
  const people = Object.values(PERSON_PORTFOLIOS).flatMap((profile) => [
    `/people/${profile.id}`,
    ...PERSON_SECTIONS.map((section) => `/people/${profile.id}/${section.id}`),
    ...publicProjectSlugs(
      profile.projects.map((project) => project.slug),
      published[profile.id],
      true,
    ).map((slug) => `/people/${profile.id}/projects/${slug}`),
  ]);
  return [...new Set([...root, ...rootProjects, ...people])];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSitemap(origin: string, published: PublishedByProfile = {}): string {
  const urls = publicRoutes(published)
    .map((path) => `  <url><loc>${escapeXml(absoluteUrl(path, origin))}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobots(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}
