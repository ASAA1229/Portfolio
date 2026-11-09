import { describe, expect, it } from "vitest";
import { getPersonPortfolio } from "@/lib/person-portfolios";
import { buildRelevantProfileKnowledge } from "@/lib/portfolio-knowledge";

describe("buildRelevantProfileKnowledge", () => {
  const profile = getPersonPortfolio("ammu");

  it("retrieves skills when the question asks about technologies", () => {
    expect(profile).toBeDefined();
    const result = JSON.parse(
      buildRelevantProfileKnowledge(profile!, "Which technologies and tools does she know?"),
    );
    expect(
      result.relevantSections.some((section: { section: string }) => section.section === "skills"),
    ).toBe(true);
  });

  it("retrieves contact details for contact questions", () => {
    const result = JSON.parse(
      buildRelevantProfileKnowledge(profile!, "How can I contact her by email?"),
    );
    expect(
      result.relevantSections.some((section: { section: string }) => section.section === "contact"),
    ).toBe(true);
  });

  it("uses a curated set of sections for introductions", () => {
    const result = JSON.parse(
      buildRelevantProfileKnowledge(profile!, "Introduce this portfolio", "intro"),
    );
    const names = result.relevantSections.map((section: { section: string }) => section.section);
    expect(names).toContain("identity");
    expect(names).toContain("skills");
    expect(names).toContain("experience");
    expect(names).toContain("projects");
    expect(names).not.toContain("contact");
  });

  it("returns general professional context when no section matches", () => {
    const result = JSON.parse(buildRelevantProfileKnowledge(profile!, "Tell me something"));
    expect(
      result.relevantSections.some(
        (section: { section: string }) => section.section === "identity",
      ),
    ).toBe(true);
    expect(
      result.relevantSections.some(
        (section: { section: string }) => section.section === "projects",
      ),
    ).toBe(true);
  });
});
