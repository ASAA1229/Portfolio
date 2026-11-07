import { PROJECTS } from "@/lib/portfolio-data";
import { seoHead } from "@/lib/seo-head";
import { PROJECT_PAGES } from "@/lib/project-pages";

// Slugs come from the project detail route's source of truth. The former
// "ai-farmer-marketplace" and "neo-ai" slugs linked to 404 pages from Home.
export const projectSlugs = PROJECT_PAGES.map((project) => project.slug);
/** Old slugs that may exist in shared links, mapped to their current pages. */
export const LEGACY_PROJECT_SLUGS: Readonly<Record<string, string>> = {
  "ai-farmer-marketplace": "farmer-marketplace",
  "neo-ai": "neo-ai-interface",
};
export const siteProjects = PROJECTS.map((project, index) => ({
  ...project,
  slug: projectSlugs[index] ?? "",
  index,
}));
export function findProject(slug: string) {
  return siteProjects.find((project) => project.slug === slug);
}
export function pageHead(title: string, description: string, path: string) {
  return seoHead({ title: `${title} — Guda Abhishek`, description, path });
}
