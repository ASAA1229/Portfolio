import { describe, expect, it } from "vitest";
import {
  appendHistory,
  emptyHistory,
  isPublishHistory,
  MAX_HISTORY_ENTRIES,
  planRollback,
  rollbackTargetIndex,
  snapshotOf,
} from "@/lib/resume-publish-history";

const record = (id: string, displayName = id) => ({
  id,
  profileId: "ammu",
  displayName,
  headline: "Data analyst",
  summary: "Summary",
  skills: ["SQL"],
  privateReviewNotes: "must never be snapshotted",
});

describe("resume publish history", () => {
  it("snapshots only public fields and keeps a bounded, versioned history", () => {
    const snapshot = snapshotOf(record("r1"), "2026-11-01T00:00:00.000Z");
    expect(snapshot).not.toHaveProperty("privateReviewNotes");
    let history = emptyHistory("ammu");
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 3; i++) {
      history = appendHistory(
        history,
        snapshotOf(record(`r${i}`), `2026-11-0${(i % 9) + 1}T00:00:00Z`),
      );
    }
    expect(history.entries).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(history.entries.at(-1)?.resumeId).toBe(`r${MAX_HISTORY_ENTRIES + 2}`);
    expect(isPublishHistory(history, "ammu")).toBe(true);
    expect(isPublishHistory(history, "sai")).toBe(false);
  });

  it("refuses to snapshot unassigned resumes", () => {
    expect(() => snapshotOf({ ...record("r1"), profileId: "unassigned" }, "t")).toThrow();
  });

  it("plans a rollback to the version before the current publication", () => {
    const history = appendHistory(
      appendHistory(emptyHistory("ammu"), snapshotOf(record("v1"), "t1")),
      snapshotOf(record("v2"), "t2"),
    );
    const plan = planRollback(history, "v2");
    expect(plan.ok && plan.target.resumeId).toBe("v1");
    expect(plan.ok && plan.remaining.entries.map((entry) => entry.resumeId)).toEqual(["v1"]);
    // After an unpublish nothing is current: the latest publication is restored.
    const afterUnpublish = planRollback(history, undefined);
    expect(afterUnpublish.ok && afterUnpublish.target.resumeId).toBe("v2");
    expect(planRollback(emptyHistory("ammu"), undefined).ok).toBe(false);
    expect(
      planRollback(appendHistory(emptyHistory("ammu"), snapshotOf(record("v1"), "t1")), "v1").ok,
    ).toBe(false);
  });

  it("marks the same entry for rollback in the admin list (newest first)", () => {
    const newestFirst = [{ resumeId: "v2" }, { resumeId: "v1" }];
    expect(rollbackTargetIndex(newestFirst, "v2")).toBe(1);
    expect(rollbackTargetIndex(newestFirst, null)).toBe(0);
    expect(rollbackTargetIndex([{ resumeId: "v1" }], "v1")).toBe(-1);
    expect(rollbackTargetIndex([], null)).toBe(-1);
  });
});
