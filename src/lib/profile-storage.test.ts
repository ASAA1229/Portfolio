import { describe, expect, it } from "vitest";
import { summarizeAiBudget, summarizeProfileStorage } from "@/lib/profile-storage";
import { parseUsageDay } from "@/lib/ai-usage";

describe("per-profile storage summary", () => {
  it("counts each profile's media and documents only against that profile", () => {
    const report = summarizeProfileStorage(
      [
        { profileId: "ammu", size: 100, status: "approved" },
        { profileId: "ammu", size: 50, status: "pending" },
        { profileId: "sai", size: 7, status: "pending" },
      ],
      [
        { profileId: "bava", size: 10, status: "approved" },
        { profileId: "unassigned", size: 4, status: "pending" },
      ],
      { imagesPerProfile: 100, resumesPerProfile: 50 },
    );
    expect(report.profiles.ammu.images).toMatchObject({ count: 2, bytes: 150, published: 1 });
    expect(report.profiles.sai.images).toMatchObject({ count: 1, bytes: 7, published: 0 });
    expect(report.profiles.abhishek.images.count).toBe(0);
    expect(report.profiles.bava.resumes).toMatchObject({ count: 1, bytes: 10, published: 1 });
    expect(report.profiles.ammu.resumes.count).toBe(0);
    expect(report.unassignedResumes).toEqual({ count: 1, bytes: 4 });
  });
});

describe("AI budget summary", () => {
  it("reports remaining budget and per-profile counters for today only", () => {
    const day = parseUsageDay(
      {
        total: 5,
        byOutcome: { ok: 3, upstream_error: 1, rate_limited: 1 },
        byProfile: { sai: 4, ammu: 1 },
      },
      "2026-11-22",
    );
    const report = summarizeAiBudget(day, "2026-11-22", 10);
    expect(report.billableToday).toBe(4);
    expect(report.remaining).toBe(6);
    expect(report.byProfile.sai).toBe(4);
    expect(summarizeAiBudget(day, "2026-11-23", 10).billableToday).toBe(0);
    expect(summarizeAiBudget(undefined, "2026-11-22", null).remaining).toBeNull();
  });
});
