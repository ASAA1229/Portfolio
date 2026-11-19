import type { PersonPortfolio } from "@/lib/person-portfolios";

type KnowledgeMode = "chat" | "intro";

type KnowledgeSection = {
  name: string;
  keywords: string[];
  value: unknown;
};

/**
 * Build a fresh, question-aware context from the profile source of truth.
 * The index is intentionally derived per request so edits to a profile are
 * reflected immediately and no stale persisted index can leak old facts.
 */
export function buildRelevantProfileKnowledge(
  profile: PersonPortfolio,
  question: string,
  mode: KnowledgeMode = "chat",
): string {
  const sections: KnowledgeSection[] = [
    {
      name: "identity",
      keywords: ["name", "who", "about", "headline", "summary", "introduce", "intro", "profile"],
      value: {
        name: profile.name,
        displayName: profile.displayName,
        nickname: profile.nickname,
        headline: profile.headline,
        story: profile.story,
        summary: profile.summary,
      },
    },
    {
      name: "strengths",
      keywords: ["strength", "good at", "special", "focus", "expertise", "strengths"],
      value: profile.strengths,
    },
    {
      name: "skills",
      keywords: [
        "skill",
        "technology",
        "technologies",
        "tech",
        "stack",
        "language",
        "tool",
        "framework",
        "database",
      ],
      value: profile.skills,
    },
    {
      name: "experience",
      keywords: ["experience", "work", "job", "intern", "company", "employer", "role", "career"],
      value: profile.experience,
    },
    {
      name: "projects",
      keywords: ["project", "built", "developed", "application", "app", "portfolio", "achievement"],
      value: profile.projects,
    },
    {
      name: "certifications",
      keywords: ["certification", "certificate", "certified", "course", "issuer"],
      value: profile.certifications,
    },
    {
      name: "education",
      keywords: [
        "education",
        "degree",
        "college",
        "university",
        "study",
        "gpa",
        "cgpa",
        "graduation",
      ],
      value: profile.education,
    },
    {
      name: "leadership",
      keywords: ["leadership", "leader", "coordinator", "team", "volunteer"],
      value: profile.leadership,
    },
    { name: "training", keywords: ["training", "workshop", "learning"], value: profile.training },
    {
      name: "contact",
      keywords: ["contact", "email", "phone", "reach", "linkedin", "github", "hire"],
      value: {
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        socialLabels: profile.socialLabels,
      },
    },
  ];
  const normalized = question.toLowerCase().replace(/[^a-z0-9+.#\s-]/g, " ");
  const terms = normalized.split(/\s+/).filter((term) => term.length > 2);
  const scored = sections.map((section) => {
    const score =
      section.keywords.reduce((total, keyword) => {
        const k = keyword.toLowerCase();
        return total + (normalized.includes(k) ? (k.includes(" ") ? 2 : 1) : 0);
      }, 0) + terms.reduce((total, term) => total + (section.name === term ? 2 : 0), 0);
    return { ...section, score };
  });
  const selected =
    mode === "intro"
      ? scored.filter((section) =>
          ["identity", "strengths", "skills", "experience", "projects", "education"].includes(
            section.name,
          ),
        )
      : scored.filter((section) => section.score > 0);
  const chosen =
    selected.length > 0
      ? selected
      : scored.filter((section) =>
          ["identity", "strengths", "skills", "experience", "projects", "education"].includes(
            section.name,
          ),
        );
  const payload = {
    profileId: profile.id,
    source: "current profile data; generated on each request",
    relevantSections: chosen.map(({ name, value }) => ({ section: name, facts: value })),
    omittedSections: sections
      .filter((section) => !chosen.some((item) => item.name === section.name))
      .map((section) => section.name),
  };
  return JSON.stringify(payload, null, 2);
}
