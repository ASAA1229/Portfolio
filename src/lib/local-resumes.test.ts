import { describe, expect, it } from "vitest";
import { getLocalResumeOptions } from "@/lib/local-resumes";

describe("local profile resumes", () => {
  it("keeps resume files scoped to the selected profile and sorts versions newest-first", () => {
    const resumes = getLocalResumeOptions("ammu", {
      "/src/assets/resumes/ammu/2024-01-resume.pdf": "/assets/old.pdf",
      "/src/assets/resumes/ammu/2025-03-resume.pdf": "/assets/new.pdf",
      "/src/assets/resumes/abhi/2026-01-resume.pdf": "/assets/other-profile.pdf",
    });

    expect(resumes).toEqual([
      { name: "2025-03-resume.pdf", url: "/assets/new.pdf" },
      { name: "2024-01-resume.pdf", url: "/assets/old.pdf" },
    ]);
  });

  it("returns no files for unsupported profiles or empty folders", () => {
    expect(getLocalResumeOptions("unknown", {})).toEqual([]);
    expect(getLocalResumeOptions("sai", {})).toEqual([]);
  });
});
