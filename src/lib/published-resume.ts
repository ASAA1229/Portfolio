export type PublishedResumeHighlight = {
  id: string;
  profileId: string;
  displayName: string;
  headline: string;
  summary: string;
  skills: string[];
};

/**
 * Treat published-resume API data as untrusted runtime input.
 * Only retain bounded strings for the requested profile.
 */
export function normalizePublishedResumeHighlights(
  payload: unknown,
  profileId: string,
): PublishedResumeHighlight[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { resumes?: unknown }).resumes)) {
    return [];
  }

  return (payload as { resumes: unknown[] }).resumes.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    if (
      item.profileId !== profileId ||
      typeof item.id !== "string" || !item.id.trim() || item.id.length > 128 ||
      typeof item.displayName !== "string" || item.displayName.length > 120 ||
      typeof item.headline !== "string" || item.headline.length > 240 ||
      typeof item.summary !== "string" || item.summary.length > 4000 ||
      !Array.isArray(item.skills)
    ) return [];

    const skills = item.skills
      .filter((skill): skill is string => typeof skill === "string" && !!skill.trim() && skill.length <= 80)
      .slice(0, 20);

    return [{
      id: item.id,
      profileId,
      displayName: item.displayName,
      headline: item.headline,
      summary: item.summary,
      skills,
    }];
  });
}
