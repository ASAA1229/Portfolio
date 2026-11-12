/**
 * Owner-published CMS overrides for Abhishek's root pages (PORT-US-035, P-E02).
 *
 * The person profiles merge overrides through mergePersonPortfolio; Abhishek's
 * root routes use their own curated data (portfolio-data / site-data), so these
 * helpers apply the same published overrides to that shape. The static files are
 * never mutated, and missing/invalid overrides fall back to curated content.
 *
 * Precedence per page: an approved published resume section (where a page shows
 * one) stays first; CMS overrides replace the curated fallback; basics (headline,
 * summary) prefer the explicit CMS edit over resume-derived text.
 */
import { useMemo } from "react";
import { CERTS, CONTACT, MISSIONS, SKILLS } from "@/lib/portfolio-data";
import { siteProjects } from "@/lib/site-data";
import { usePublishedContent } from "@/lib/published-content";
import type { ContentOverrides } from "@/lib/cms-content";

export type SiteProject = (typeof siteProjects)[number];

export function mergeAbhishekContact(overrides: ContentOverrides | null) {
  const basics = overrides?.basics;
  const socials = basics?.socials ?? [];
  const secureSocial = (platform: string, fallback: string | null) => {
    const candidate = socials.find((item) => item.platform.trim().toLowerCase() === platform)?.handle.trim();
    if (!candidate) return fallback;
    try {
      const url = new URL(candidate);
      return url.protocol === "https:" &&
        (url.hostname === `${platform}.com` || url.hostname.endsWith(`.${platform}.com`))
        ? url.toString()
        : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    email: basics?.email || CONTACT.email,
    phone: basics?.phone || CONTACT.phone,
    location: basics?.location || CONTACT.location,
    linkedin: secureSocial("linkedin", CONTACT.linkedin),
    github: secureSocial("github", CONTACT.github),
  };
}
export type Mission = (typeof MISSIONS)[number];
type Cert = readonly [string, string];

export function mergeSiteProjects(overrides: ContentOverrides | null): SiteProject[] {
  const edits = overrides?.projects;
  if (!edits?.length) return siteProjects;
  const bySlug = new Map(edits.map((edit) => [edit.slug, edit]));
  const merged: SiteProject[] = [];
  for (const project of siteProjects) {
    const edit = bySlug.get(project.slug);
    if (!edit) {
      merged.push(project);
      continue;
    }
    if (edit.archived) continue;
    merged.push({
      ...project,
      title: edit.title,
      overview: edit.overview,
      ...(edit.context ? { problem: edit.context } : {}),
      ...(edit.points?.length ? { role: edit.points.join(" ") } : {}),
      ...(edit.tech?.length ? { tech: edit.tech } : {}),
    } as SiteProject);
  }
  const known = new Set(siteProjects.map((project) => project.slug));
  let index = siteProjects.length;
  for (const edit of edits) {
    if (known.has(edit.slug) || edit.archived) continue;
    merged.push({
      title: edit.title,
      badge: "Project",
      hue: "primary",
      overview: edit.overview,
      problem: edit.context ?? "",
      role: edit.points?.join(" ") ?? "",
      flow: [],
      tech: edit.tech ?? [],
      slug: edit.slug,
      index: index++,
    } as unknown as SiteProject);
  }
  return merged;
}

export function mergeSkills(overrides: ContentOverrides | null) {
  const groups = overrides?.skills;
  if (!groups?.length) return SKILLS;
  return groups.map((group) => ({
    cat: group.cat,
    desc: group.desc,
    items: [...group.items],
  }));
}

export function mergeMissions(overrides: ContentOverrides | null): Mission[] {
  const experience = overrides?.experience;
  if (!experience?.length) return MISSIONS;
  return experience.map(
    (entry, i) =>
      ({
        id: String(i + 1).padStart(2, "0"),
        company: entry.company ?? entry.role,
        role: entry.role,
        period: entry.period,
        location: "",
        projects: [
          {
            name: entry.context || entry.role,
            points: entry.points ?? [],
          },
        ],
        tags: entry.tech ?? [],
      }) as unknown as Mission,
  );
}

export function mergeCerts(overrides: ContentOverrides | null): readonly Cert[] {
  const certifications = overrides?.certifications;
  if (!certifications?.length) return CERTS as readonly Cert[];
  return certifications.map((cert) => [cert.title, cert.issuer] as const);
}

/** Published CMS overrides for Abhishek's root pages, merged over curated data. */
export function useAbhishekContent() {
  const overrides = usePublishedContent("abhishek");
  return useMemo(
    () => ({
      overrides,
      headline: overrides?.basics?.headline,
      summary: overrides?.basics?.summary,
      story: overrides?.basics?.story,
      projects: mergeSiteProjects(overrides),
      missions: mergeMissions(overrides),
      skills: mergeSkills(overrides),
      certs: mergeCerts(overrides),
      hasCustomExperience: Boolean(overrides?.experience?.length),
      hasCustomCerts: Boolean(overrides?.certifications?.length),
      education: overrides?.education,
      contact: mergeAbhishekContact(overrides),
    }),
    [overrides],
  );
}
