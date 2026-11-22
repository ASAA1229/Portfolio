import { describe, expect, it } from "vitest";
import { AiUsageTracker, usageTrackerFor } from "@/lib/ai-usage";

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
