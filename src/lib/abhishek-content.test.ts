// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mergeAbhishekContact, mergeSkills } from "@/lib/abhishek-content";
import { SKILLS } from "@/lib/portfolio-data";
import { CONTACT } from "@/lib/portfolio-data";

describe("Abhishek published contact overrides", () => {
  it("uses CMS email, phone and location while preserving curated defaults", () => {
    expect(
      mergeAbhishekContact({
        basics: { email: "owner@example.com", phone: "+1 555 0100", location: "Remote" },
      }),
    ).toMatchObject({
      email: "owner@example.com",
      phone: "+1 555 0100",
      location: "Remote",
      github: CONTACT.github,
      linkedin: CONTACT.linkedin,
    });
  });

  it("accepts only HTTPS social URLs on their expected domains", () => {
    const result = mergeAbhishekContact({
      basics: {
        socials: [
          { platform: "github", handle: "https://github.com/example-owner" },
          { platform: "linkedin", handle: "javascript:alert(1)" },
        ],
      },
    });
    expect(result.github).toBe("https://github.com/example-owner");
    expect(result.linkedin).toBe(CONTACT.linkedin);
  });

  it("matches social platform names case-insensitively", () => {
    const result = mergeAbhishekContact({
      basics: { socials: [{ platform: "LinkedIn", handle: "https://www.linkedin.com/in/example" }] },
    });
    expect(result.linkedin).toBe("https://www.linkedin.com/in/example");
  });
});


describe("Abhishek published skill groups", () => {
  it("uses curated skill groups when no CMS override is published", () => {
    expect(mergeSkills(null)).toEqual(SKILLS);
  });

  it("uses owner-published groups instead of the curated list", () => {
    expect(
      mergeSkills({
        skills: [{ cat: "Custom", desc: "Owner-managed", items: ["TypeScript", "React"] }],
      }),
    ).toEqual([{ cat: "Custom", desc: "Owner-managed", items: ["TypeScript", "React"] }]);
  });
});
