// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  emptyContentDocument,
  isContentDocument,
  mergePersonPortfolio,
  publishContentDraft,
  publishedContent,
  rollbackContent,
  saveContentDraft,
  unpublishContent,
  validateContentOverrides,
} from "@/lib/cms-content";
import { createBackup, validateBackup } from "@/lib/admin-backup";
import { memoryAdapter } from "@/lib/storage-adapter";
import { PERSON_PORTFOLIOS } from "@/lib/person-portfolios";
import { createProfileFromTemplate } from "@/lib/profile-template";

describe("CMS content model (PORT-US-035)", () => {
  it("rejects unknown fields, bad slugs and duplicate slugs", () => {
    expect(validateContentOverrides({ secret: 1 }).ok).toBe(false);
    expect(
      validateContentOverrides({ projects: [{ slug: "Bad Slug", title: "x", overview: "y" }] }).ok,
    ).toBe(false);
    expect(
      validateContentOverrides({
        projects: [
          { slug: "a", title: "x", overview: "y" },
          { slug: "a", title: "x", overview: "y" },
        ],
      }).ok,
    ).toBe(false);
  });

  it("publishes, restores as a new version and never rewrites history", () => {
    let doc = emptyContentDocument("ammu");
    doc = publishContentDraft(saveContentDraft(doc, { basics: { headline: "v1" } }, "t1"), "t1");
    doc = publishContentDraft(saveContentDraft(doc, { basics: { headline: "v2" } }, "t2"), "t2");
    doc = rollbackContent(doc, 1, "t3");
    expect(doc.history.map((entry) => entry.version)).toEqual([1, 2, 3]);
    expect(doc.history[2]).toMatchObject({ kind: "rollback", restoredVersion: 1 });
    expect(publishedContent(doc)?.basics?.headline).toBe("v1");
    expect(isContentDocument(doc, "ammu")).toBe(true);
    expect(publishedContent(unpublishContent(doc))).toBeNull();
  });

  it("merges overrides over curated data without mutating it", () => {
    const base = PERSON_PORTFOLIOS.ammu;
    const firstSlug = base.projects[0]!.slug;
    const merged = mergePersonPortfolio(base, {
      basics: { headline: "New headline" },
      projects: [
        { slug: firstSlug, title: "Hidden", overview: "x", archived: true },
        { slug: "brand-new", title: "Brand new", overview: "Fresh project" },
      ],
    });
    expect(merged.headline).toBe("New headline");
    expect(merged.projects.some((project) => project.slug === firstSlug)).toBe(false);
    expect(merged.projects.some((project) => project.slug === "brand-new")).toBe(true);
    expect(base.headline).not.toBe("New headline");
    expect(base.projects.some((project) => project.slug === firstSlug)).toBe(true);
  });
});

describe("backup / restore (PORT-US-041)", () => {
  it("round-trips known documents and rejects unknown keys", async () => {
    const storage = memoryAdapter();
    const doc = publishContentDraft(
      saveContentDraft(emptyContentDocument("sai"), { basics: { headline: "h" } }, "t"),
      "t",
    );
    await storage.put("private-admin/content/sai.json", JSON.stringify(doc));
    await storage.put("private-admin/resumes/files/abc", "binary");
    const backup = await createBackup(storage);
    expect(Object.keys(backup.entries)).toEqual(["private-admin/content/sai.json"]);
    expect(validateBackup(backup).ok).toBe(true);
    expect(validateBackup({ ...backup, entries: { "private-admin/other.json": {} } }).ok).toBe(
      false,
    );
    expect(
      validateBackup({ ...backup, entries: { "private-admin/content/sai.json": { bad: true } } })
        .ok,
    ).toBe(false);
  });

  it("lists keys by prefix in the memory adapter", async () => {
    const storage = memoryAdapter();
    await storage.put("a/1", "x");
    await storage.put("b/1", "y");
    expect(await storage.list("a/")).toEqual(["a/1"]);
  });
});

describe("profile template (PORT-US-040)", () => {
  it("creates a valid empty profile and rejects reserved ids", () => {
    const profile = createProfileFromTemplate({
      id: "priya",
      name: "Priya Sharma",
      headline: "Analyst",
      summary: "Summary",
    });
    expect(profile.initials).toBe("PS");
    expect(profile.projects).toEqual([]);
    expect(() =>
      createProfileFromTemplate({ id: "admin", name: "X", headline: "", summary: "" }),
    ).toThrow();
  });
});
