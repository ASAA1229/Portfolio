/**
 * Profile template factory (PORT-US-040).
 *
 * Produces a complete, empty-but-valid profile record in the shared shape every
 * person page renders, so a new profile (or a future client) starts from the
 * template with its own content and media — no copying of business logic.
 * See docs/PROFILE_TEMPLATES.md for the end-to-end "new profile" flow.
 * Multi-tenancy, billing and client roles are intentionally out of scope.
 */
import type { PersonPortfolio } from "@/lib/person-portfolios";
import { monogramFor } from "@/lib/monogram";

export type ProfileTemplate = Omit<PersonPortfolio, "id"> & { id: string };

export interface NewProfileInput {
  /** URL id: lowercase letters, digits and hyphens, e.g. "priya". */
  id: string;
  /** Full legal/display name, e.g. "Priya Sharma". */
  name: string;
  /** Short name used in navigation and the assistant, defaults to the first name. */
  nickname?: string;
  headline: string;
  summary: string;
  email?: string | null;
  phone?: string | null;
  /** Public path of an approved portrait in /public, e.g. "/images/profiles/priya/main.webp". */
  portrait?: string;
}

const PROFILE_ID = /^[a-z0-9][a-z0-9-]{1,31}$/;
const RESERVED_IDS = new Set(["abhishek", "admin", "api", "people", "profiles", "privacy"]);

export function createProfileFromTemplate(input: NewProfileInput): ProfileTemplate {
  if (!PROFILE_ID.test(input.id) || RESERVED_IDS.has(input.id)) {
    throw new Error(
      "Profile id must be 2-32 lowercase letters, digits or hyphens and not reserved.",
    );
  }
  const name = input.name.trim();
  if (!name) throw new Error("Profile name is required.");
  const nickname = input.nickname?.trim() || name.split(/\s+/)[0]!;
  return {
    id: input.id,
    name,
    displayName: nickname,
    nickname,
    initials: monogramFor(name),
    portrait: input.portrait ?? "",
    gallery: [],
    headline: input.headline.trim(),
    story: input.summary.trim(),
    summary: input.summary.trim(),
    email: input.email ?? null,
    phone: input.phone ?? null,
    socialLabels: [
      { platform: "LinkedIn", handle: null },
      { platform: "GitHub", handle: null },
    ],
    strengths: [],
    skills: [],
    experience: [],
    projects: [],
    certifications: [],
    education: { college: "", qualification: "", period: "", score: "" },
    leadership: [],
    training: [],
  };
}
