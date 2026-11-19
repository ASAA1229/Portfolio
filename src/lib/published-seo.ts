/**
 * Published SEO overrides in server-rendered HTML (PORT-US-044).
 *
 * The owner can set per-page SEO titles and descriptions (and publish CMS-created projects) in the
 * content manager. Page components only know the curated defaults, so the Worker applies the
 * currently *published* overrides to the SSR HTML head before the response is sent: crawlers and
 * social previews see the published values, drafts never appear, and unpublish or rollback take
 * effect on the next request.
 */
import type { ContentOverrides, ContentPage, ContentProfileId } from "@/lib/cms-content";
import { CONTENT_PAGES } from "@/lib/cms-content";

export type SeoTarget = {
  profileId: ContentProfileId;
  page: ContentPage;
  projectSlug?: string;
};

const PERSON_IDS = ["ammu", "bava", "sai"] as const;

/** Map a public URL path to the profile and CMS page it renders, or null when it is not a profile page. */
export function seoTargetForPath(path: string): SeoTarget | null {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === "/") return { profileId: "abhishek", page: "home" };
  const root = /^\/([a-z]+)$/.exec(clean);
  if (root && (CONTENT_PAGES as readonly string[]).includes(root[1]!) && root[1] !== "home") {
    return { profileId: "abhishek", page: root[1] as ContentPage };
  }
  const rootProject = /^\/projects\/([a-z0-9][a-z0-9-]{0,79})$/.exec(clean);
  if (rootProject) return { profileId: "abhishek", page: "projects", projectSlug: rootProject[1]! };

  const person = /^\/people\/([a-z]+)(?:\/([a-z]+))?$/.exec(clean);
  if (person && (PERSON_IDS as readonly string[]).includes(person[1]!)) {
    const section = person[2];
    if (!section) return { profileId: person[1] as ContentProfileId, page: "home" };
    if ((CONTENT_PAGES as readonly string[]).includes(section) && section !== "home") {
      return { profileId: person[1] as ContentProfileId, page: section as ContentPage };
    }
    return null;
  }
  const personProject = /^\/people\/([a-z]+)\/projects\/([a-z0-9][a-z0-9-]{0,79})$/.exec(clean);
  if (personProject && (PERSON_IDS as readonly string[]).includes(personProject[1]!)) {
    return {
      profileId: personProject[1] as ContentProfileId,
      page: "projects",
      projectSlug: personProject[2]!,
    };
  }
  return null;
}

export type SeoValues = {
  title?: string;
  description?: string;
  /** Public social image URL (already absolute when a site origin is configured). */
  image?: string;
  imageAlt?: string;
};

/** The published values for a target, or null when the owner set none (curated defaults stay). */
export function publishedSeoFor(
  target: SeoTarget,
  overrides: ContentOverrides | null,
  siteName: string,
): SeoValues | null {
  if (!overrides) return null;
  if (target.projectSlug) {
    const edit = overrides.projects?.find((project) => project.slug === target.projectSlug);
    if (!edit || edit.archived) return null;
    return {
      title: `${edit.title} — ${siteName}`.slice(0, 120),
      description: edit.overview.replace(/\s+/g, " ").trim().slice(0, 200),
    };
  }
  const entry = overrides.seo?.[target.page];
  if (!entry || (!entry.title && !entry.description)) return null;
  return {
    ...(entry.title ? { title: entry.title } : {}),
    ...(entry.description ? { description: entry.description } : {}),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setMetaContent(html: string, attribute: "name" | "property", key: string, value: string) {
  const tag = new RegExp(`<meta\\s+[^>]*${attribute}="${key}"[^>]*>`, "i");
  return html.replace(tag, (match) =>
    match.replace(/content="[^"]*"/i, () => `content="${escapeHtml(value)}"`),
  );
}

/** Replace title/description and the matching Open Graph and Twitter tags in an SSR HTML document. */
export function rewriteSeoHead(html: string, values: SeoValues): string {
  let out = html;
  if (values.title) {
    out = out.replace(
      /<title>[\s\S]*?<\/title>/i,
      () => `<title>${escapeHtml(values.title!)}</title>`,
    );
    out = setMetaContent(out, "property", "og:title", values.title);
    out = setMetaContent(out, "name", "twitter:title", values.title);
  }
  if (values.description) {
    out = setMetaContent(out, "name", "description", values.description);
    out = setMetaContent(out, "property", "og:description", values.description);
    out = setMetaContent(out, "name", "twitter:description", values.description);
  }
  if (values.image) {
    out = setMetaContent(out, "property", "og:image", values.image);
    out = setMetaContent(out, "name", "twitter:image", values.image);
    if (values.imageAlt) {
      out = setMetaContent(out, "property", "og:image:alt", values.imageAlt);
      out = setMetaContent(out, "name", "twitter:image:alt", values.imageAlt);
    }
  }
  return out;
}
