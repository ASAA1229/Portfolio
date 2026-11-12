import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CONTACT, MISSIONS, MILESTONES, PROJECTS } from "@/lib/portfolio-data";
import { getPersonPortfolio, PEOPLE, PERSON_PORTFOLIOS } from "@/lib/person-portfolios";
import { contactSchema, PORTFOLIO_FILES } from "@/lib/contact-schema";
import { normalizePublishedResumeHighlights, normalizePublishedProfileImages } from "@/lib/published-resume";

describe("Portfolio factual and contact rules", () => {
  it("keeps the four profile identifiers unique", () => {
    const ids = PEOPLE.map((person) => person.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(["abhishek", "ammu", "bava", "sai"]);
  });
  it("uses the same approved primary portrait in Amulya's profile selector and portfolio", () => {
    const selectorProfile = PEOPLE.find((person) => person.id === "ammu");
    const portfolioProfile = PERSON_PORTFOLIOS.ammu;
    expect(selectorProfile?.avatar).toBe("/images/profiles/amulya/amulya_main.webp");
    expect(portfolioProfile.portrait).toBe(selectorProfile?.avatar);
  });
  it("references only profile image assets that exist in the public directory", () => {
    const imagePaths = new Set<string>();

    for (const person of PEOPLE) imagePaths.add(person.avatar);
    for (const profile of Object.values(PERSON_PORTFOLIOS)) {
      imagePaths.add(profile.portrait);
      for (const image of profile.gallery) imagePaths.add(image.src);
    }

    const missing = [...imagePaths].filter(
      (assetPath) => !existsSync(resolve(process.cwd(), "public", assetPath.replace(/^\/+/, ""))),
    );

    expect(missing).toEqual([]);
  });
  it("keeps the profile directory and portfolio data aligned for supported profile routes", () => {
    for (const person of PEOPLE) {
      if (person.id === "abhishek") continue;
      expect(getPersonPortfolio(person.id)?.id).toBe(person.id);
    }
    expect(getPersonPortfolio("unknown-profile")).toBeUndefined();
  });
  it("keeps profile project slugs unique within each profile", () => {
    for (const profile of Object.values(PERSON_PORTFOLIOS)) {
      const slugs = profile.projects.map((project) => project.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });
  it("uses the exact supplied social profile URLs", () => {
    expect(CONTACT.linkedin).toBe("https://linkedin.com/in/Guda-Abhishek");
    expect(CONTACT.github).toBe("https://github.com/Guda-Abhishek");
    expect(CONTACT.socialName).toBe("Guda-Abhishek");
  });
  it("does not enable a resume without a real file", () => {
    expect(PORTFOLIO_FILES.resume).toBeNull();
  });
  it("uses the supplied contact information", () => {
    expect(CONTACT.email).toBe("abhishek.guda123@gmail.com");
    expect(CONTACT.phone).toBe("+91 9391732446");
    expect(CONTACT.location).toBe("Hyderabad, India");
  });
  it("keeps the supplied internship dates", () => {
    expect(MISSIONS.map((m) => m.period)).toEqual(["May 2026 – Present", "Feb 2025 – Apr 2025"]);
  });
  it("preserves the approximate 25 percent impact", () => {
    expect(MISSIONS[1]?.projects[0]?.points.some((p) => p.includes("approximately 25%"))).toBe(
      true,
    );
  });
  it("preserves honest leadership impact", () => {
    expect(MILESTONES[0]?.[2]).toContain("around 15%");
    expect(MILESTONES[1]?.[2]).toContain("250");
    expect(MILESTONES[3]?.[2]).toContain("two innovation projects");
  });
  it("identifies the marketplace as a concept", () => {
    expect(PROJECTS[0].overview).toContain("concept");
  });
  it("rejects empty, malformed, and overlong drafts", () => {
    const valid = {
      name: "Recruiter",
      email: "recruiter@example.com",
      subject: "Opportunity",
      message: "Let's discuss a role.",
    };
    expect(contactSchema.safeParse(valid).success).toBe(true);
    expect(contactSchema.safeParse({ ...valid, name: " " }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, subject: " " }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: " " }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: "x".repeat(2001) }).success).toBe(false);
  });
  it("normalizes published resume highlights and rejects malformed or cross-profile records", () => {
    const normalized = normalizePublishedResumeHighlights(
      {
        resumes: [
          {
            id: "resume-1",
            profileId: "ammu",
            displayName: "Amulya",
            headline: "Analyst",
            summary: "Profile summary",
            skills: ["SQL", 42, "Python", "", "x".repeat(81)],
          },
          {
            id: "resume-2",
            profileId: "sai",
            displayName: "Sai",
            headline: "Developer",
            summary: "Other profile",
            skills: ["Java"],
          },
          {
            id: "resume-3",
            profileId: "ammu",
            displayName: {},
            headline: "Invalid",
            summary: "Invalid display name",
            skills: ["Java"],
          },
          null,
        ],
      },
      "ammu",
    );

    expect(normalized).toEqual([
      {
        id: "resume-1",
        profileId: "ammu",
        displayName: "Amulya",
        headline: "Analyst",
        summary: "Profile summary",
        skills: ["SQL", "Python"],
      },
    ]);
  });

  it("bounds published resume skills and safely handles unexpected API payloads", () => {
    const skills = Array.from({ length: 25 }, (_, index) => `Skill ${index}`);
    const normalized = normalizePublishedResumeHighlights(
      {
        resumes: [
          {
            id: "resume-1",
            profileId: "bava",
            displayName: "Anjini",
            headline: "",
            summary: "",
            skills,
          },
        ],
      },
      "bava",
    );

    expect(normalized[0]?.skills).toHaveLength(20);
    expect(normalizePublishedResumeHighlights(null, "bava")).toEqual([]);
    expect(normalizePublishedResumeHighlights({ resumes: "not-an-array" }, "bava")).toEqual([]);
  });

  it("validates published profile resume details and bounds structured sections", async () => {
    const { normalizePublishedProfileResume } = await import("@/lib/published-resume");
    const normalized = normalizePublishedProfileResume(
      {
        resumes: [
          {
            id: "newer",
            profileId: "ammu",
            displayName: "Amulya",
            headline: "Data Analyst",
            summary: "Profile summary",
            skills: ["SQL", 12, "Python", "x".repeat(81)],
            uploadedAt: "not-a-date",
            structuredSections: {
              experience: ["Analyst role", 42, " "],
              education: ["B.Tech"],
              ignored: ["must not be surfaced"],
            },
          },
          {
            id: "other-profile",
            profileId: "sai",
            displayName: "Sai",
            headline: "Developer",
            summary: "Private to another profile",
            skills: ["Java"],
          },
          {
            id: "invalid",
            profileId: "ammu",
            displayName: " ",
            headline: "Bad",
            summary: "Bad",
            skills: [],
          },
        ],
      },
      "ammu",
    );

    expect(normalized).toEqual({
      id: "newer",
      profileId: "ammu",
      displayName: "Amulya",
      headline: "Data Analyst",
      summary: "Profile summary",
      skills: ["SQL", "Python"],
      structuredSections: {
        experience: ["Analyst role"],
        education: ["B.Tech"],
      },
    });
  });

  it("accepts only same-origin published portrait paths for the matching profile", async () => {
    const { normalizePublishedPortrait } = await import("@/lib/published-resume");
    expect(
      normalizePublishedPortrait(
        {
          images: [
            {
              profileId: "ammu",
              slot: "portrait",
              src: "/api/published-images/123e4567-e89b-12d3-a456-426614174000",
            },
            {
              profileId: "sai",
              slot: "portrait",
              src: "/api/published-images/123e4567-e89b-12d3-a456-426614174001",
            },
          ],
        },
        "ammu",
      ),
    ).toBe("/api/published-images/123e4567-e89b-12d3-a456-426614174000");
    expect(
      normalizePublishedPortrait(
        {
          images: [
            {
              profileId: "ammu",
              slot: "portrait",
              src: "/api/published-images/123e4567-e89b-02d3-a456-426614174000",
            },
            {
              profileId: "ammu",
              slot: "portrait",
              src: "/api/published-images/123e4567-e89b-12d3-c456-426614174000",
            },
            {
              profileId: "ammu",
              slot: "portrait",
              src: "/api/published-images/123e4567e89b12d3a456426614174000",
            },
          ],
        },
        "ammu",
      ),
    ).toBeNull();
    expect(
      normalizePublishedPortrait(
        {
          images: [
            { profileId: "ammu", slot: "portrait", src: "https://attacker.example/image.png" },
          ],
        },
        "ammu",
      ),
    ).toBeNull();
    expect(
      normalizePublishedPortrait(
        {
          images: [
            {
              profileId: "ammu",
              slot: "gallery",
              src: "/api/published-images/123e4567-e89b-12d3-a456-426614174000",
            },
          ],
        },
        "ammu",
      ),
    ).toBeNull();
    expect(normalizePublishedPortrait(null, "ammu")).toBeNull();
  });

  it("selects the newest valid published resume and rejects non-object payloads", async () => {
    const { normalizePublishedProfileResume } = await import("@/lib/published-resume");
    const payload = {
      resumes: [
        {
          id: "old",
          profileId: "bava",
          displayName: "Anjini",
          headline: "Old",
          summary: "Old",
          skills: [],
          uploadedAt: "2025-01-01",
        },
        {
          id: "new",
          profileId: "bava",
          displayName: "Anjini",
          headline: "New",
          summary: "New",
          skills: [],
          uploadedAt: "2026-01-01",
        },
      ],
    };
    expect(normalizePublishedProfileResume(payload, "bava")?.id).toBe("new");
    const undatedFirst = {
      resumes: [
        {
          id: "undated",
          profileId: "bava",
          displayName: "Anjini",
          headline: "Undated",
          summary: "No valid timestamp",
          skills: [],
          uploadedAt: "not-a-date",
        },
        {
          id: "dated",
          profileId: "bava",
          displayName: "Anjini",
          headline: "Dated",
          summary: "Valid timestamp",
          skills: [],
          uploadedAt: "2026-01-01",
        },
      ],
    };
    expect(normalizePublishedProfileResume(undatedFirst, "bava")?.id).toBe("dated");
    expect(normalizePublishedProfileResume([], "bava")).toBeNull();
    expect(normalizePublishedProfileResume({ resumes: "invalid" }, "bava")).toBeNull();
  });

  it("normalizes project images only for the matching profile and exact project slug", () => {
    const payload = {
      images: [
        {
          id: "image-1",
          profileId: "ammu",
          slot: "project",
          projectSlug: "data-analysis-ai",
          alt: "Analytics dashboard",
          src: "/api/published-images/123e4567-e89b-12d3-a456-426614174000",
        },
        {
          id: "other-profile",
          profileId: "sai",
          slot: "project",
          projectSlug: "data-analysis-ai",
          alt: "Wrong profile",
          src: "/api/published-images/123e4567-e89b-12d3-a456-426614174001",
        },
        {
          id: "invalid-slug",
          profileId: "ammu",
          slot: "project",
          projectSlug: "../other-project",
          alt: "Invalid slug",
          src: "/api/published-images/123e4567-e89b-12d3-a456-426614174002",
        },
        {
          id: "missing-slug",
          profileId: "ammu",
          slot: "project",
          alt: "Missing slug",
          src: "/api/published-images/123e4567-e89b-12d3-a456-426614174003",
        },
      ],
    };
    expect(normalizePublishedProfileImages(payload, "ammu")).toEqual([
      {
        id: "image-1",
        profileId: "ammu",
        slot: "project",
        projectSlug: "data-analysis-ai",
        alt: "Analytics dashboard",
        src: "/api/published-images/123e4567-e89b-12d3-a456-426614174000",
      },
    ]);
    expect(normalizePublishedProfileImages(payload, "sai")).toHaveLength(1);
    expect(normalizePublishedProfileImages(null, "ammu")).toEqual([]);
  });
});
