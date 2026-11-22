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
