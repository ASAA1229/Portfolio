export type PublishedProfileResume = {
  id: string;
  profileId: string;
  displayName: string;
  headline: string;
  summary: string;
  skills: string[];
  uploadedAt?: string;
  structuredSections?: {
    experience?: string[];
    education?: string[];
    projects?: string[];
    certifications?: string[];
  };
};

type PublishedResumeRecord = {
  id: string;
  profileId: string;
  displayName: string;
  headline: string;
  summary: string;
  skills: string[];
  uploadedAt?: string;
  structuredSections?: PublishedProfileResume["structuredSections"];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((skill): skill is string => typeof skill === "string" && skill.trim().length > 0 && skill.trim().length <= 80)
    .slice(0, 20)
    .map((skill) => skill.trim());
}

function normalizeSections(value: unknown): PublishedProfileResume["structuredSections"] {
  if (!isRecord(value)) return undefined;
  const sections: NonNullable<PublishedProfileResume["structuredSections"]> = {};
  for (const name of ["experience", "education", "projects", "certifications"] as const) {
    const entries = value[name];
    if (Array.isArray(entries)) {
      sections[name] = entries
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .slice(0, 20)
        .map((entry) => entry.trim().slice(0, 2000));
    }
  }
  return Object.keys(sections).length ? sections : undefined;
}

function normalizeRecord(value: unknown, profileId: string): PublishedProfileResume | null {
  if (!isRecord(value) || value.profileId !== profileId) return null;
  if (typeof value.id !== "string" || !value.id.trim() || value.id.length > 160) return null;
  if (typeof value.displayName !== "string" || !value.displayName.trim() || value.displayName.length > 120) return null;
  if (typeof value.headline !== "string" || value.headline.length > 240) return null;
  if (typeof value.summary !== "string" || value.summary.length > 6000) return null;

  const uploadedAt = typeof value.uploadedAt === "string" && Number.isFinite(Date.parse(value.uploadedAt))
    ? value.uploadedAt
    : undefined;
  const structuredSections = normalizeSections(value.structuredSections);
  return {
    id: value.id,
    profileId,
    displayName: value.displayName.trim(),
    headline: value.headline.trim(),
    summary: value.summary.trim(),
    skills: normalizeSkills(value.skills),
    ...(uploadedAt ? { uploadedAt } : {}),
    ...(structuredSections ? { structuredSections } : {}),
  };
}

/** Validate untrusted API data before it is rendered in a public profile. */
export function normalizePublishedProfileResume(payload: unknown, profileId: string): PublishedProfileResume | null {
  if (!isRecord(payload) || !Array.isArray(payload.resumes)) return null;
  const candidates = payload.resumes
    .map((item) => normalizeRecord(item, profileId))
    .filter((item): item is PublishedProfileResume => item !== null);
  // Invalid or missing timestamps sort behind dated records. Date.parse("") is NaN,
  // and a NaN comparator is treated like a tie by Array#sort, which could leave
  // an undated first record ahead of a newer, valid publication.
  const timestamp = (value: PublishedProfileResume): number => {
    if (!value.uploadedAt) return 0;
    const parsed = Date.parse(value.uploadedAt);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  candidates.sort((a, b) => timestamp(b) - timestamp(a));
  return candidates[0] ?? null;
}

/** Normalize the compact resume list used by portfolio rules and lightweight views. */
export function normalizePublishedResumeHighlights(payload: unknown, profileId: string): PublishedResumeRecord[] {
  if (!isRecord(payload) || !Array.isArray(payload.resumes)) return [];
  return payload.resumes
    .map((item) => normalizeRecord(item, profileId))
    .filter((item): item is PublishedProfileResume => item !== null)
    .map(({ id, profileId: owner, displayName, headline, summary, skills }) => ({
      id,
      profileId: owner,
      displayName,
      headline,
      summary,
      skills,
    }));
}
