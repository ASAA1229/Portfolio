/**
 * Owner-managed portfolio content (PORT-US-035).
 *
 * Each profile has one private content document with a draft, the currently
 * published version and an append-only history (publish / rollback entries).
 * Published overrides are merged over the curated static data at read time —
 * the static source files are never modified. Published resume sections keep
 * their existing precedence in the page components, on top of these overrides.
 */
import type { PersonPortfolio, PersonProject } from "@/lib/person-portfolios";

export type ContentProfileId = "abhishek" | "ammu" | "bava" | "sai";
export const CONTENT_PROFILE_IDS: readonly ContentProfileId[] = ["abhishek", "ammu", "bava", "sai"];

export const CONTENT_PAGES = [
  "home",
  "about",
  "skills",
  "projects",
  "experience",
  "certifications",
  "education",
  "contact",
] as const;
export type ContentPage = (typeof CONTENT_PAGES)[number];

export interface ContentOverrides {
  basics?: {
    headline?: string;
    summary?: string;
    story?: string;
    location?: string;
    email?: string;
    phone?: string;
    socials?: { platform: string; handle: string }[];
  };
  /** Merged by slug: edits existing projects, adds new ones; archived hides one. */
  projects?: {
    slug: string;
    title: string;
    overview: string;
    context?: string;
    points?: string[];
    tech?: string[];
    archived?: boolean;
  }[];
  /** Replaces the curated list when provided. */
  experience?: {
    role: string;
    company?: string;
    period: string;
    context?: string;
    points?: string[];
    tech?: string[];
  }[];
  education?: {
    college: string;
    qualification: string;
    period: string;
    score?: string;
    location?: string;
  };
  certifications?: { title: string; issuer: string }[];
  seo?: Partial<Record<ContentPage, { title?: string; description?: string }>>;
  /** Navigation label per page id, e.g. { projects: "Originals" }. */
  navigation?: Partial<Record<ContentPage, string>>;
  /** Theme preset and layout choices; presets are fixed token sets, never free-form CSS. */
  appearance?: {
    theme?: ThemePresetId;
    /** Sections removed from navigation (home always stays). */
    hiddenSections?: ContentPage[];
  };
}

export const THEME_PRESET_IDS = ["crimson", "cobalt", "emerald", "amber", "violet"] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

export interface ContentVersion {
  version: number;
  kind: "publish" | "rollback";
  publishedAt: string;
  content: ContentOverrides;
  restoredVersion?: number;
}

export interface ContentDocument {
  schemaVersion: 1;
  profileId: ContentProfileId;
  draft: { content: ContentOverrides; updatedAt: string } | null;
  publishedVersion: number | null;
  history: ContentVersion[];
}

export const CONTENT_LIMITS = {
  shortText: 160,
  text: 2000,
  listItems: 40,
  points: 12,
  tags: 30,
  historyEntries: 50,
} as const;

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function isContentProfileId(value: unknown): value is ContentProfileId {
  return typeof value === "string" && (CONTENT_PROFILE_IDS as readonly string[]).includes(value);
}

export function contentKey(profileId: ContentProfileId): string {
  return `private-admin/content/${profileId}.json`;
}

export function emptyContentDocument(profileId: ContentProfileId): ContentDocument {
  return { schemaVersion: 1, profileId, draft: null, publishedVersion: null, history: [] };
}

type Errors = string[];

function text(
  value: unknown,
  name: string,
  errors: Errors,
  options: { required?: boolean; max?: number } = {},
): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (options.required) errors.push(`${name} is required.`);
    return undefined;
  }
  if (typeof value !== "string") {
    errors.push(`${name} must be text.`);
    return undefined;
  }
  const max = options.max ?? CONTENT_LIMITS.shortText;
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  if (cleaned.length > max) errors.push(`${name} must be at most ${max} characters.`);
  return cleaned.slice(0, max) || undefined;
}

function list<T>(
  value: unknown,
  name: string,
  errors: Errors,
  max: number,
  item: (entry: Record<string, unknown>, label: string) => T | undefined,
): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    errors.push(`${name} must be a list.`);
    return undefined;
  }
  if (value.length > max) errors.push(`${name} may contain at most ${max} items.`);
  const out: T[] = [];
  value.slice(0, max).forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${name}[${index}] must be an object.`);
      return;
    }
    const parsed = item(entry as Record<string, unknown>, `${name}[${index}]`);
    if (parsed) out.push(parsed);
  });
  return out;
}

function strings(value: unknown, name: string, errors: Errors, max: number): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${name} must be a list of text.`);
    return undefined;
  }
  return (value as string[])
    .slice(0, max)
    .map((item) => item.replace(CONTROL_CHARS, "").trim().slice(0, CONTENT_LIMITS.text))
    .filter(Boolean);
}

function unknownKeys(
  input: Record<string, unknown>,
  allowed: string[],
  name: string,
  errors: Errors,
) {
  const extra = Object.keys(input).filter((key) => !allowed.includes(key));
  if (extra.length) errors.push(`Unknown fields in ${name}: ${extra.join(", ")}.`);
}

/** Validate and normalize owner content. Unknown fields are rejected. */
export function validateContentOverrides(
  value: unknown,
): { ok: true; content: ContentOverrides } | { ok: false; errors: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Content must be an object."] };
  }
  const input = value as Record<string, unknown>;
  const errors: Errors = [];
  unknownKeys(
    input,
    [
      "basics",
      "projects",
      "experience",
      "education",
      "certifications",
      "seo",
      "navigation",
      "appearance",
    ],
    "content",
    errors,
  );
  const content: ContentOverrides = {};

  if (input["basics"] !== undefined) {
    const basics = input["basics"] as Record<string, unknown>;
    if (!basics || typeof basics !== "object" || Array.isArray(basics)) {
      errors.push("basics must be an object.");
    } else {
      unknownKeys(
        basics,
        ["headline", "summary", "story", "location", "email", "phone", "socials"],
        "basics",
        errors,
      );
      const email = text(basics["email"], "basics.email", errors, { max: 320 });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        errors.push("basics.email is invalid.");
      const socials = list(basics["socials"], "basics.socials", errors, 10, (entry, label) => {
        const platform = text(entry["platform"], `${label}.platform`, errors, {
          required: true,
          max: 40,
        });
        const handle = text(entry["handle"], `${label}.handle`, errors, {
          required: true,
          max: 200,
        });
        return platform && handle ? { platform, handle } : undefined;
      });
      const pick = {
        headline: text(basics["headline"], "basics.headline", errors),
        summary: text(basics["summary"], "basics.summary", errors, { max: CONTENT_LIMITS.text }),
        story: text(basics["story"], "basics.story", errors, { max: CONTENT_LIMITS.text }),
        location: text(basics["location"], "basics.location", errors, { max: 120 }),
        email,
        phone: text(basics["phone"], "basics.phone", errors, { max: 40 }),
        socials,
      };
      content.basics = Object.fromEntries(
        Object.entries(pick).filter(([, item]) => item !== undefined),
      ) as NonNullable<ContentOverrides["basics"]>;
    }
  }

  const projects = list(
    input["projects"],
    "projects",
    errors,
    CONTENT_LIMITS.listItems,
    (entry, label) => {
      const slug = text(entry["slug"], `${label}.slug`, errors, { required: true, max: 80 });
      if (slug && !SLUG.test(slug))
        errors.push(`${label}.slug must use lowercase letters, digits and hyphens.`);
      const title = text(entry["title"], `${label}.title`, errors, { required: true });
      const overview = text(entry["overview"], `${label}.overview`, errors, {
        required: true,
        max: CONTENT_LIMITS.text,
      });
      if (entry["archived"] !== undefined && typeof entry["archived"] !== "boolean") {
        errors.push(`${label}.archived must be true or false.`);
      }
      if (!slug || !title || !overview) return undefined;
      const context = text(entry["context"], `${label}.context`, errors);
      const points = strings(entry["points"], `${label}.points`, errors, CONTENT_LIMITS.points);
      const tech = strings(entry["tech"], `${label}.tech`, errors, CONTENT_LIMITS.tags);
      return {
        slug,
        title,
        overview,
        ...(context ? { context } : {}),
        ...(points ? { points } : {}),
        ...(tech ? { tech } : {}),
        ...(entry["archived"] === true ? { archived: true } : {}),
      };
    },
  );
  if (projects) {
    const slugs = projects.map((project) => project.slug);
    if (new Set(slugs).size !== slugs.length) errors.push("Project slugs must be unique.");
    content.projects = projects;
  }

  const experience = list(
    input["experience"],
    "experience",
    errors,
    CONTENT_LIMITS.listItems,
    (entry, label) => {
      const role = text(entry["role"], `${label}.role`, errors, { required: true });
      const period = text(entry["period"], `${label}.period`, errors, { required: true, max: 60 });
      if (!role || !period) return undefined;
      const company = text(entry["company"], `${label}.company`, errors);
      const context = text(entry["context"], `${label}.context`, errors);
      const points = strings(entry["points"], `${label}.points`, errors, CONTENT_LIMITS.points);
      const tech = strings(entry["tech"], `${label}.tech`, errors, CONTENT_LIMITS.tags);
      return {
        role,
        period,
        ...(company ? { company } : {}),
        ...(context ? { context } : {}),
        ...(points ? { points } : {}),
        ...(tech ? { tech } : {}),
      };
    },
  );
  if (experience) content.experience = experience;

  if (input["education"] !== undefined) {
    const education = input["education"] as Record<string, unknown>;
    if (!education || typeof education !== "object" || Array.isArray(education)) {
      errors.push("education must be an object.");
    } else {
      const college = text(education["college"], "education.college", errors, { required: true });
      const qualification = text(education["qualification"], "education.qualification", errors, {
        required: true,
      });
      const period = text(education["period"], "education.period", errors, {
        required: true,
        max: 60,
      });
      const score = text(education["score"], "education.score", errors, { max: 60 });
      const location = text(education["location"], "education.location", errors, { max: 120 });
      if (college && qualification && period) {
        content.education = {
          college,
          qualification,
          period,
          ...(score ? { score } : {}),
          ...(location ? { location } : {}),
        };
      }
    }
  }

  const certifications = list(
    input["certifications"],
    "certifications",
    errors,
    CONTENT_LIMITS.listItems,
    (entry, label) => {
      const title = text(entry["title"], `${label}.title`, errors, { required: true });
      const issuer = text(entry["issuer"], `${label}.issuer`, errors, { required: true });
      return title && issuer ? { title, issuer } : undefined;
    },
  );
  if (certifications) content.certifications = certifications;

  for (const key of ["seo", "navigation"] as const) {
    const raw = input[key];
    if (raw === undefined) continue;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`${key} must be an object.`);
      continue;
    }
    const record = raw as Record<string, unknown>;
    unknownKeys(record, [...CONTENT_PAGES], key, errors);
    if (key === "navigation") {
      const navigation: ContentOverrides["navigation"] = {};
      for (const page of CONTENT_PAGES) {
        const label = text(record[page], `navigation.${page}`, errors, { max: 32 });
        if (label) navigation[page] = label;
      }
      content.navigation = navigation;
    } else {
      const seo: ContentOverrides["seo"] = {};
      for (const page of CONTENT_PAGES) {
        const entry = record[page] as Record<string, unknown> | undefined;
        if (entry === undefined) continue;
        if (!entry || typeof entry !== "object") {
          errors.push(`seo.${page} must be an object.`);
          continue;
        }
        const title = text(entry["title"], `seo.${page}.title`, errors, { max: 70 });
        const description = text(entry["description"], `seo.${page}.description`, errors, {
          max: 200,
        });
        seo[page] = { ...(title ? { title } : {}), ...(description ? { description } : {}) };
      }
      content.seo = seo;
    }
  }

  if (input["appearance"] !== undefined) {
    const appearance = input["appearance"] as Record<string, unknown>;
    if (!appearance || typeof appearance !== "object" || Array.isArray(appearance)) {
      errors.push("appearance must be an object.");
    } else {
      unknownKeys(appearance, ["theme", "hiddenSections"], "appearance", errors);
      const result: NonNullable<ContentOverrides["appearance"]> = {};
      const theme = appearance["theme"];
      if (theme !== undefined) {
        if ((THEME_PRESET_IDS as readonly unknown[]).includes(theme)) {
          result.theme = theme as ThemePresetId;
        } else {
          errors.push(`appearance.theme must be one of: ${THEME_PRESET_IDS.join(", ")}.`);
        }
      }
      const hidden = appearance["hiddenSections"];
      if (hidden !== undefined) {
        if (
          !Array.isArray(hidden) ||
          !hidden.every(
            (page) => (CONTENT_PAGES as readonly unknown[]).includes(page) && page !== "home",
          ) ||
          new Set(hidden).size !== hidden.length
        ) {
          errors.push("appearance.hiddenSections must list unique non-home section ids.");
        } else {
          result.hiddenSections = hidden as ContentPage[];
        }
      }
      content.appearance = result;
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, content };
}

export function isContentDocument(
  value: unknown,
  profileId: ContentProfileId,
): value is ContentDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<ContentDocument>;
  return (
    doc.schemaVersion === 1 &&
    doc.profileId === profileId &&
    Array.isArray(doc.history) &&
    doc.history.length <= CONTENT_LIMITS.historyEntries &&
    (doc.publishedVersion === null ||
      (typeof doc.publishedVersion === "number" &&
        doc.history.some((entry) => entry.version === doc.publishedVersion))) &&
    doc.history.every(
      (entry) =>
        !!entry &&
        typeof entry.version === "number" &&
        (entry.kind === "publish" || entry.kind === "rollback") &&
        typeof entry.publishedAt === "string" &&
        validateContentOverrides(entry.content).ok,
    )
  );
}

function nextVersion(doc: ContentDocument): number {
  return doc.history.reduce((max, entry) => Math.max(max, entry.version), 0) + 1;
}

function appendVersion(doc: ContentDocument, entry: ContentVersion): ContentDocument {
  return {
    ...doc,
    publishedVersion: entry.version,
    history: [...doc.history, entry].slice(-CONTENT_LIMITS.historyEntries),
  };
}

export function saveContentDraft(
  doc: ContentDocument,
  content: ContentOverrides,
  now: string,
): ContentDocument {
  return { ...doc, draft: { content, updatedAt: now } };
}

export function publishContentDraft(doc: ContentDocument, now: string): ContentDocument {
  if (!doc.draft) throw new Error("There is no draft to publish.");
  return appendVersion(doc, {
    version: nextVersion(doc),
    kind: "publish",
    publishedAt: now,
    content: doc.draft.content,
  });
}

/** Restore an earlier version as a new history entry; history is never rewritten. */
export function rollbackContent(
  doc: ContentDocument,
  version: number,
  now: string,
): ContentDocument {
  const target = doc.history.find((entry) => entry.version === version);
  if (!target) throw new Error("That content version is not in the history.");
  if (doc.publishedVersion === version) throw new Error("That version is already published.");
  return appendVersion(doc, {
    version: nextVersion(doc),
    kind: "rollback",
    publishedAt: now,
    content: target.content,
    restoredVersion: version,
  });
}

export function unpublishContent(doc: ContentDocument): ContentDocument {
  return { ...doc, publishedVersion: null };
}

export function publishedContent(doc: ContentDocument): ContentOverrides | null {
  if (doc.publishedVersion === null) return null;
  return doc.history.find((entry) => entry.version === doc.publishedVersion)?.content ?? null;
}

// ---------------------------------------------------------------------------
// Read-time merge over curated static data (static files are never mutated).
// ---------------------------------------------------------------------------

export function mergePersonPortfolio(
  profile: PersonPortfolio,
  overrides: ContentOverrides | null,
): PersonPortfolio {
  if (!overrides) return profile;
  const merged: PersonPortfolio = { ...profile };
  const basics = overrides.basics;
  if (basics) {
    if (basics.headline) merged.headline = basics.headline;
    if (basics.summary) merged.summary = basics.summary;
    if (basics.story) merged.story = basics.story;
    if (basics.email) merged.email = basics.email;
    if (basics.phone) merged.phone = basics.phone;
    if (basics.socials) merged.socialLabels = basics.socials.map((social) => ({ ...social }));
  }
  if (overrides.projects) {
    const bySlug = new Map<string, PersonProject>(
      profile.projects.map((project) => [project.slug, project]),
    );
    for (const edit of overrides.projects) {
      if (edit.archived) {
        bySlug.delete(edit.slug);
        continue;
      }
      const base = bySlug.get(edit.slug);
      bySlug.set(edit.slug, {
        ...(base ?? { points: [], tech: [], context: "" }),
        slug: edit.slug,
        title: edit.title,
        overview: edit.overview,
        context: edit.context ?? base?.context ?? "",
        points: edit.points ?? base?.points ?? [],
        tech: edit.tech ?? base?.tech ?? [],
      });
    }
    merged.projects = [...bySlug.values()];
  }
  if (overrides.experience) {
    merged.experience = overrides.experience.map((item) => ({
      role: item.role,
      company: item.company ?? null,
      period: item.period,
      ...(item.context ? { context: item.context } : {}),
      points: item.points ?? [],
      tech: item.tech ?? [],
    }));
  }
  if (overrides.education) {
    merged.education = {
      college: overrides.education.college,
      qualification: overrides.education.qualification,
      period: overrides.education.period,
      score: overrides.education.score ?? "",
      ...(overrides.education.location ? { location: overrides.education.location } : {}),
    };
  }
  if (overrides.certifications)
    merged.certifications = overrides.certifications.map((item) => ({ ...item }));
  return merged;
}

/** Navigation label for a page id, falling back to the configured default. */
export function navigationLabel(
  overrides: ContentOverrides | null,
  page: ContentPage,
  fallback: string,
): string {
  return overrides?.navigation?.[page] || fallback;
}
