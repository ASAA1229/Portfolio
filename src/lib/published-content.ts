import { useEffect, useState } from "react";
import {
  isContentProfileId,
  mergePersonPortfolio,
  validateContentOverrides,
  type ContentOverrides,
} from "@/lib/cms-content";
import type { PersonPortfolio } from "@/lib/person-portfolios";

/**
 * Client access to owner-published content overrides (PORT-US-035).
 * One request per profile per minute is shared by every component on the page.
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<ContentOverrides | null> }>();

export function fetchPublishedContent(profileId: string): Promise<ContentOverrides | null> {
  if (!isContentProfileId(profileId) || typeof fetch === "undefined") return Promise.resolve(null);
  const cached = cache.get(profileId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise;
  const promise = fetch(`/api/published-content?profileId=${encodeURIComponent(profileId)}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload: unknown) => {
      const content = (payload as { content?: unknown } | null)?.content;
      if (!content) return null;
      // Re-validate on the client: never render a shape the server should not have sent.
      const validated = validateContentOverrides(content);
      return validated.ok ? validated.content : null;
    })
    .catch(() => null);
  cache.set(profileId, { at: Date.now(), promise });
  return promise;
}

export function usePublishedContent(profileId: string | undefined): ContentOverrides | null {
  const [state, setState] = useState<{ id: string | undefined; content: ContentOverrides | null }>({
    id: profileId,
    content: null,
  });
  useEffect(() => {
    let active = true;
    if (!profileId) return;
    void fetchPublishedContent(profileId).then((content) => {
      if (active) setState({ id: profileId, content });
    });
    return () => {
      active = false;
    };
  }, [profileId]);
  return state.id === profileId ? state.content : null;
}

/** Curated profile data with published owner overrides applied (static data untouched). */
export function useMergedPersonPortfolio<T extends PersonPortfolio | undefined>(profile: T): T {
  const overrides = usePublishedContent(profile?.id);
  return (profile ? mergePersonPortfolio(profile, overrides) : profile) as T;
}
