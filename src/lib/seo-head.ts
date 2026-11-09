/**
 * Public site origin for canonical/Open Graph URLs and the sitemap.
 * Set VITE_SITE_URL (e.g. https://portfolio.example.com) in the deployment;
 * without it, head tags keep root-relative paths and the sitemap/robots routes
 * fall back to the request origin.
 */
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
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}

export interface SeoInput {
  title: string;
  description: string;
  path: string;
  /** Private pages (admin) must never be indexed. */
  noindex?: boolean;
}

/** Shared head builder: title, description, canonical, Open Graph and Twitter tags. */
export function seoHead({ title, description, path, noindex = false }: SeoInput) {
  const url = absoluteUrl(path);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: noindex ? "noindex, nofollow, noarchive" : "index, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: "Portfolio Collective" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: noindex ? [] : [{ rel: "canonical", href: url }],
  };
}
