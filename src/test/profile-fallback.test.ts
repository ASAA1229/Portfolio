import { describe, expect, it } from "vitest";
import { PERSON_PORTFOLIOS } from "@/lib/person-portfolios";
import { fallbackProfileAnswer } from "@/lib/profile-fallback";

describe("profile-grounded AI fallback", () => {
  it("answers skills questions from the selected profile", () => {
    const answer = fallbackProfileAnswer(PERSON_PORTFOLIOS.bava, "What skills does she have?");
    expect(answer).toContain("Power BI");
    expect(answer).toContain("SQL");
    expect(answer).not.toContain("Guda Abhishek");
  });

  it("answers project questions with published project facts", () => {
    const answer = fallbackProfileAnswer(PERSON_PORTFOLIOS.sai, "Tell me about projects");
    expect(answer).toContain("Weather Web App");
    expect(answer).toContain("OpenWeatherMap API");
  });

  it("creates an introduction without claiming to be the person", () => {
    const answer = fallbackProfileAnswer(PERSON_PORTFOLIOS.ammu, "Introduce this portfolio", "intro");
    expect(answer).toContain("AI assistant presenting Dudala Amulya");
    expect(answer).toContain("not the person speaking");
  });

  it("does not invent contact handles when they are absent", () => {
    const answer = fallbackProfileAnswer(PERSON_PORTFOLIOS.sai, "How can I contact you?");
    expect(answer).toContain("LinkedIn: not provided");
    expect(answer).toContain("GitHub: not provided");
    expect(answer).not.toMatch(/LinkedIn: https?:|GitHub: https?:/);
  });

  it("offers useful guidance for questions outside known sections", () => {
    const answer = fallbackProfileAnswer(PERSON_PORTFOLIOS.bava, "What is your favorite movie?");
    expect(answer).toContain("Live AI is currently unavailable");
    expect(answer).toContain("published portfolio facts");
  });
});
