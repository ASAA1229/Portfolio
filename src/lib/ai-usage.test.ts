import { describe, expect, it } from "vitest";
import { AiUsageTracker, parseUsageDay, usageTrackerFor } from "@/lib/ai-usage";
import { summarizeAiBudget } from "@/lib/profile-storage";

describe("AI budget without a storage binding", () => {
  it("still enforces the cap per isolate", async () => {
    const tracker = new AiUsageTracker(null);
    expect((await tracker.checkBudget(2)).allowed).toBe(true);
    tracker.record({ profile: "abhishek", outcome: "ok" });
    tracker.record({ profile: "ammu", outcome: "upstream_error" });
    const decision = await tracker.checkBudget(2);
    expect(decision.allowed).toBe(false);
  });

  it("returns a shared tracker for a missing bucket", () => {
    expect(usageTrackerFor(null)).toBe(usageTrackerFor(undefined));
  });
});

describe("isolate fallback view (E2:D6.4 / E2:D6.8)", () => {
  it("matches what the no-storage cap enforces and counts every outcome per profile", async () => {
    const tracker = new AiUsageTracker(null);
    tracker.record({ profile: "ammu", outcome: "ok" });
    tracker.record({ profile: "ammu", outcome: "invalid" });
    tracker.record({ profile: "sai", outcome: "upstream_error" });
    const view = tracker.isolateToday();
    expect(view.billable).toBe(2);
    expect(view.byProfile).toEqual({ abhishek: 0, ammu: 2, bava: 0, sai: 1 });
    expect((await tracker.checkBudget(2)).allowed).toBe(false);
    expect((await tracker.checkBudget(3)).allowed).toBe(true);
  });
});

describe("usage counter split (E2:D6.4 / E2:D6.8)", () => {
  it("separates requests counted against the cap from refused/invalid attempts per profile", () => {
    const tracker = new AiUsageTracker(null);
    tracker.record({ profile: "ammu", outcome: "ok" });
    tracker.record({ profile: "ammu", outcome: "invalid" });
    tracker.record({ profile: "ammu", outcome: "budget_exhausted" });
    tracker.record({ profile: "sai", outcome: "upstream_error" });
    const view = tracker.isolateToday();
    expect(view.byProfileBilled).toEqual({ abhishek: 0, ammu: 1, bava: 0, sai: 1 });
    const sum = Object.values(view.byProfileBilled).reduce((a, b) => a + b, 0);
    expect(sum).toBe(view.billable);
  });

  it("budget used per profile sums to what the cap enforces; older documents stay readable", () => {
    const doc = parseUsageDay(
      {
        total: 5,
        byOutcome: { ok: 2, upstream_error: 1, invalid: 2 },
        byProfile: { ammu: 4, sai: 1 },
        byProfileBilled: { ammu: 2, sai: 1 },
      },
      "2026-11-22",
    );
    const report = summarizeAiBudget(doc, "2026-11-22", 10);
    expect(report.billableToday).toBe(3);
    expect(report.byProfileBilled).toEqual({ abhishek: 0, ammu: 2, bava: 0, sai: 1 });
    expect(report.byProfileRefused).toEqual({ abhishek: 0, ammu: 2, bava: 0, sai: 0 });

    const legacy = parseUsageDay(
      { total: 5, byOutcome: { ok: 3, invalid: 2 }, byProfile: { ammu: 5 } },
      "2026-11-22",
    );
    const legacyReport = summarizeAiBudget(legacy, "2026-11-22", 10);
    expect(legacyReport.billableToday).toBe(3);
    expect(legacyReport.byProfile.ammu).toBe(5);
    expect(legacyReport.byProfileBilled).toBeNull();
    expect(legacyReport.byProfileRefused).toBeNull();
  });
});
