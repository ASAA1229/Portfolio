import { PERSON_PORTFOLIOS, PERSON_SECTIONS } from "@/lib/person-portfolios";
import { projectSlugs } from "@/lib/site-data";
import { absoluteUrl } from "@/lib/seo-head";

/** Every public, indexable route. Admin and API routes are deliberately excluded. */
export function publicRoutes(): string[] {
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
  ];
  const rootProjects = projectSlugs.map((slug) => `/projects/${slug}`);
  const people = Object.values(PERSON_PORTFOLIOS).flatMap((profile) => [
    `/people/${profile.id}`,
    ...PERSON_SECTIONS.map((section) => `/people/${profile.id}/${section.id}`),
    ...profile.projects.map((project) => `/people/${profile.id}/projects/${project.slug}`),
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

export function buildSitemap(origin: string): string {
  const urls = publicRoutes()
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
