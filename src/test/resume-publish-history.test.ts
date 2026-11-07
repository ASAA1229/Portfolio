import { describe, expect, it } from "vitest";
import {
  appendHistory,
  emptyHistory,
  isPublishHistory,
  MAX_HISTORY_ENTRIES,
  planRollback,
  effectiveStack,
  redactDeletedResume,
  rollbackTargetPublishedAt,
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

  it("plans a rollback to the version before the current publication, appending to history", () => {
    const history = appendHistory(
      appendHistory(emptyHistory("ammu"), snapshotOf(record("v1"), "t1")),
      snapshotOf(record("v2"), "t2"),
    );
    const plan = planRollback(history, "v2", "t3");
    expect(plan.ok && plan.target.resumeId).toBe("v1");
    // Append-only: the newer entry is kept and a rollback entry is added.
    expect(plan.ok && plan.next.entries.map((entry) => [entry.resumeId, entry.kind])).toEqual([
      ["v1", "publish"],
      ["v2", "publish"],
      ["v1", "rollback"],
    ]);
    expect(plan.ok && effectiveStack(plan.next).map((entry) => entry.resumeId)).toEqual(["v1"]);
    // After an unpublish nothing is current: the latest effective version is restored.
    const afterUnpublish = planRollback(history, undefined);
    expect(afterUnpublish.ok && afterUnpublish.target.resumeId).toBe("v2");
    expect(planRollback(emptyHistory("ammu"), undefined).ok).toBe(false);
    expect(
      planRollback(appendHistory(emptyHistory("ammu"), snapshotOf(record("v1"), "t1")), "v1").ok,
    ).toBe(false);
  });

  it("repeated rollbacks walk further back without rewriting history", () => {
    let history = emptyHistory("ammu");
    for (const [id, at] of [
      ["v1", "t1"],
      ["v2", "t2"],
      ["v3", "t3"],
    ] as const) {
      history = appendHistory(history, snapshotOf(record(id), at));
    }
    const first = planRollback(history, "v3", "t4");
    expect(first.ok && first.target.resumeId).toBe("v2");
    const second = first.ok ? planRollback(first.next, "v2", "t5") : first;
    expect(second.ok && second.target.resumeId).toBe("v1");
    expect(second.ok && second.next.entries).toHaveLength(5);
    expect(rollbackTargetPublishedAt(history, "v3")).toBe("t2");
  });

  it("keeps only timestamps for a deleted resume's history entries", () => {
    const history = appendHistory(emptyHistory("ammu"), snapshotOf(record("v1"), "t1"));
    const redacted = redactDeletedResume(history, "v1");
    expect(redacted.entries[0]).toMatchObject({
      resumeId: "v1",
      publishedAt: "t1",
      summary: "",
      skills: [],
    });
  });
});
