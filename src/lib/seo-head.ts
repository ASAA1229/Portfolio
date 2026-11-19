/**
 * Shared canonical and social metadata. Public pages use profile-scoped,
 * locally hosted images so crawlers do not depend on third-party image hosts.
 */
export const SEO_SITE_NAME = "ABHISHEK: THE SERIES";
export const DEFAULT_SOCIAL_IMAGE = "/images/profiles/abhishek/abhishek_main.jpeg";

export function configuredSiteUrl(
  raw: string | undefined = import.meta.env["VITE_SITE_URL"] as string | undefined,
): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function absoluteUrl(path: string, origin: string | null = configuredSiteUrl()): string {
  if (/^https:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}

export interface SeoInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  siteName?: string;
  /** Private pages (admin) must never be indexed. */
  noindex?: boolean;
}

/** Shared head builder: title, description, canonical, Open Graph and Twitter tags. */
export function seoHead({
  title,
  description,
  path,
  image = DEFAULT_SOCIAL_IMAGE,
  imageAlt = SEO_SITE_NAME,
  siteName = SEO_SITE_NAME,
  noindex = false,
}: SeoInput) {
  const url = absoluteUrl(path);
  const socialImage = absoluteUrl(image);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: noindex ? "noindex, nofollow, noarchive" : "index, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: siteName },
      { property: "og:locale", content: "en_IN" },
      { property: "og:image", content: socialImage },
      { property: "og:image:alt", content: imageAlt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: socialImage },
      { name: "twitter:image:alt", content: imageAlt },
    ],
    links: noindex ? [] : [{ rel: "canonical", href: url }],
  };
}
