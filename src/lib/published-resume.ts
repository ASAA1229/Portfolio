import { useEffect, useState } from "react";
import type {
  ResumeSectionEntry,
  StructuredResumeEntry,
  StructuredResumeSections,
} from "@/lib/resume-types";

export type PublishedProfileResume = {
  id: string;
  profileId: string;
  displayName: string;
  headline: string;
  summary: string;
  skills: string[];
  contact?: { email?: string; phone?: string; linkedin?: string; github?: string };
  uploadedAt?: string;
  structuredSections?: Partial<StructuredResumeSections>;
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
    .filter(
      (skill): skill is string =>
        typeof skill === "string" && skill.trim().length > 0 && skill.trim().length <= 80,
    )
    .slice(0, 20)
    .map((skill) => skill.trim());
}

function normalizeStructuredEntry(value: unknown): ResumeSectionEntry | null {
  if (typeof value === "string") {
    const text = value.trim().slice(0, 2000);
    return text ? text : null;
  }
  if (!isRecord(value)) return null;
  const allowed = [
    "title",
    "organization",
    "role",
    "location",
    "startDate",
    "endDate",
    "description",
    "technologies",
    "url",
    "credentialId",
    "grade",
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return null;
  const entry: StructuredResumeEntry = {};
  for (const key of [
    "title",
    "organization",
    "role",
    "location",
    "startDate",
    "endDate",
    "description",
    "url",
    "credentialId",
    "grade",
  ] as const) {
    const field = value[key];
    if (typeof field === "string")
      entry[key] = field.trim().slice(0, key === "description" ? 2000 : 320);
  }
  if (Array.isArray(value["technologies"])) {
    entry.technologies = value["technologies"]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 30)
      .map((item) => item.trim().slice(0, 80));
  }
  if (entry.url && !/^https:\/\//i.test(entry.url)) delete entry.url;
  return Object.values(entry).some((field) => (Array.isArray(field) ? field.length > 0 : !!field))
    ? entry
    : null;
}

function normalizeSections(value: unknown): Partial<StructuredResumeSections> | undefined {
  if (!isRecord(value)) return undefined;
  const sections: Partial<StructuredResumeSections> = {};
  for (const name of ["experience", "education", "projects", "certifications"] as const) {
    const entries = value[name];
    if (Array.isArray(entries)) {
      sections[name] = entries
        .map(normalizeStructuredEntry)
        .filter((entry): entry is ResumeSectionEntry => entry !== null)
        .slice(0, 40);
    }
  }
  return Object.keys(sections).length ? sections : undefined;
}

function normalizeRecord(value: unknown, profileId: string): PublishedProfileResume | null {
  if (!isRecord(value) || value["profileId"] !== profileId) return null;
  if (typeof value["id"] !== "string" || !value["id"].trim() || value["id"].length > 160)
    return null;
  if (
    typeof value["displayName"] !== "string" ||
    !value["displayName"].trim() ||
    value["displayName"].length > 120
  )
    return null;
  if (typeof value["headline"] !== "string" || value["headline"].length > 240) return null;
  if (typeof value["summary"] !== "string" || value["summary"].length > 6000) return null;

  const rawContact = isRecord(value["contact"]) ? value["contact"] : undefined;
  const contact = rawContact
    ? (Object.fromEntries(
        (["email", "phone", "linkedin", "github"] as const)
          .filter(
            (key) =>
              typeof rawContact[key] === "string" &&
              ((key !== "linkedin" && key !== "github") ||
                /^https:\/\//i.test(String(rawContact[key]).trim())),
          )
          .map((key) => [key, String(rawContact[key]).trim().slice(0, 320)]),
      ) as NonNullable<PublishedProfileResume["contact"]>)
    : undefined;
  const uploadedAt =
    typeof value["uploadedAt"] === "string" && Number.isFinite(Date.parse(value["uploadedAt"]))
      ? value["uploadedAt"]
      : undefined;
  const structuredSections = normalizeSections(value["structuredSections"]);
  return {
    id: value["id"],
    profileId,
    displayName: value["displayName"].trim(),
    headline: value["headline"].trim(),
    summary: value["summary"].trim(),
    skills: normalizeSkills(value["skills"]),
    ...(contact ? { contact } : {}),
    ...(uploadedAt ? { uploadedAt } : {}),
    ...(structuredSections ? { structuredSections } : {}),
  };
}

/** Validate untrusted API data before it is rendered in a public profile. */
export function normalizePublishedProfileResume(
  payload: unknown,
  profileId: string,
): PublishedProfileResume | null {
  if (!isRecord(payload) || !Array.isArray(payload["resumes"])) return null;
  const candidates = payload["resumes"]
    .map((item) => normalizeRecord(item, profileId))
    .filter((item): item is PublishedProfileResume => item !== null);
  // Invalid or missing timestamps sort behind dated records. Date.parse("") is NaN,
  // and a NaN comparator is treated like a tie by Array#sort, which could leave
  // an undated first record ahead of a newer, valid publication.
  const timestamp = (value: PublishedProfileResume): number => {
    if (!value["uploadedAt"]) return 0;
    const parsed = Date.parse(value["uploadedAt"]);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  candidates.sort((a, b) => timestamp(b) - timestamp(a));
  return candidates[0] ?? null;
}

/** Normalize the compact resume list used by portfolio rules and lightweight views. */
export function normalizePublishedResumeHighlights(
  payload: unknown,
  profileId: string,
): PublishedResumeRecord[] {
  if (!isRecord(payload) || !Array.isArray(payload["resumes"])) return [];
  return payload["resumes"]
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

/** Accept only the same-origin published-image endpoint emitted by the server. */
export function normalizePublishedPortrait(payload: unknown, profileId: string): string | null {
  if (!isRecord(payload) || !Array.isArray(payload["images"])) return null;
  const candidates = payload["images"].filter(
    (image): image is Record<string, unknown> =>
      isRecord(image) &&
      image["profileId"] === profileId &&
      image["slot"] === "portrait" &&
      typeof image["src"] === "string" &&
      /^\/api\/published-images\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        image["src"],
      ),
  );
  return typeof candidates.at(-1)?.["src"] === "string"
    ? (candidates.at(-1)!["src"] as string)
    : null;
}


export type PublishedProfileImage = {
  id: string;
  profileId: string;
  src: string;
  alt: string;
  slot: "portrait" | "gallery";
};

export function normalizePublishedProfileImages(payload: unknown, profileId: string): PublishedProfileImage[] {
  if (!isRecord(payload) || !Array.isArray(payload["images"])) return [];
  return payload["images"]
    .filter((item): item is Record<string, unknown> =>
      isRecord(item) &&
      item["profileId"] === profileId &&
      typeof item["id"] === "string" &&
      typeof item["src"] === "string" &&
      /^\/api\/published-images\/[0-9a-f-]{36}$/i.test(item["src"]) &&
      (item["slot"] === "portrait" || item["slot"] === "gallery") &&
      typeof item["alt"] === "string"
    )
    .map((item) => ({
      id: item["id"] as string,
      profileId,
      src: item["src"] as string,
      alt: (item["alt"] as string).trim().slice(0, 300),
      slot: item["slot"] as "portrait" | "gallery",
    }));
}

/** Shared client hook for all currently published images belonging to a profile. */
export function usePublishedProfileImages(profileId: string): PublishedProfileImage[] {
  const [state, setState] = useState<{ profileId: string; images: PublishedProfileImage[] }>(() => ({ profileId, images: [] }));
  useEffect(() => {
    let active = true;
    fetch("/api/published-images", { headers: { accept: "application/json" }, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (active) setState({ profileId, images: normalizePublishedProfileImages(payload, profileId) });
      })
      .catch(() => { if (active) setState({ profileId, images: [] }); });
    return () => { active = false; };
  }, [profileId]);
  return state.profileId === profileId ? state.images : [];
}

/** Shared client hook: every profile consumes the same validated, latest-published resume feed. */
export function usePublishedProfileResume(profileId: string): PublishedProfileResume | null {
  const [state, setState] = useState<{ profileId: string; resume: PublishedProfileResume | null }>(
    () => ({
      profileId,
      resume: null,
    }),
  );
  useEffect(() => {
    let active = true;
    fetch("/api/published-resumes", {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (active)
          setState({ profileId, resume: normalizePublishedProfileResume(payload, profileId) });
      })
      .catch(() => {
        if (active) setState({ profileId, resume: null });
      });
    return () => {
      active = false;
    };
  }, [profileId]);
  return state.profileId === profileId ? state.resume : null;
}

/** Shared client hook for the validated portrait selected by the admin publisher. */
export function usePublishedProfilePortrait(profileId: string): string | null {
  const [state, setState] = useState<{ profileId: string; portrait: string | null }>(() => ({
    profileId,
    portrait: null,
  }));
  useEffect(() => {
    let active = true;
    fetch("/api/published-images", {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (active)
          setState({ profileId, portrait: normalizePublishedPortrait(payload, profileId) });
      })
      .catch(() => {
        if (active) setState({ profileId, portrait: null });
      });
    return () => {
      active = false;
    };
  }, [profileId]);
  return state.profileId === profileId ? state.portrait : null;
}
