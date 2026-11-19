// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  emptyContentDocument,
  isContentDocument,
  isProfileReviewCurrent,
  PROFILE_REVIEW_ITEMS,
  signOffProfile,
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

  it("records owner sign-off against the exact published version and invalidates it after a new publish", () => {
    let doc = publishContentDraft(
      saveContentDraft(
        emptyContentDocument("ammu"),
        { basics: { headline: "Approved profile" } },
        "t1",
      ),
      "t1",
    );
    const checks = Object.fromEntries(PROFILE_REVIEW_ITEMS.map((item) => [item, true]));
    doc = signOffProfile(
      doc,
      { reviewer: "Portfolio Owner", checks, exceptions: ["Certificate scan pending"] },
      "2026-11-12T10:00:00.000Z",
    );
    expect(isProfileReviewCurrent(doc)).toBe(true);
    expect(doc.review).toMatchObject({
      reviewer: "Portfolio Owner",
      publishedVersion: 1,
      exceptions: ["Certificate scan pending"],
    });
    const next = publishContentDraft(
      saveContentDraft(doc, { basics: { headline: "Updated profile" } }, "t2"),
      "t2",
    );
    expect(isProfileReviewCurrent(next)).toBe(false);
    expect(() => signOffProfile(next, { reviewer: "Owner", checks: {} }, "t3")).toThrow(
      /Complete every/,
    );
    expect(isContentDocument(doc, "ammu")).toBe(true);
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

  it("merges profile contact location and socials and permits empty managed collections", () => {
    const base = PERSON_PORTFOLIOS.ammu;
    const merged = mergePersonPortfolio(base, {
      basics: {
        location: "Remote",
        socials: [{ platform: "GitHub", handle: "amulya-custom" }],
      },
      skills: [],
      projects: [],
      experience: [],
      education: {
        college: "Owner College",
        qualification: "Owner Degree",
        period: "2024–2028",
      },
      certifications: [],
    });
    expect(merged.location).toBe("Remote");
    expect(merged.socialLabels).toEqual([{ platform: "GitHub", handle: "amulya-custom" }]);
    expect(merged.skills).toEqual([]);
    expect(merged.projects).toEqual([]);
    expect(merged.experience).toEqual([]);
    expect(merged.education.college).toBe("Owner College");
    expect(merged.certifications).toEqual([]);
  });

  it("merges overrides over curated data without mutating it", () => {
    const base = PERSON_PORTFOLIOS.ammu;
    const firstSlug = base.projects[0]!.slug;
    const merged = mergePersonPortfolio(base, {
      basics: { headline: "New headline" },
      skills: [{ cat: "Owner skills", desc: "Custom group", items: ["Python", "SQL"] }],
      projects: [
        { slug: firstSlug, title: "Hidden", overview: "x", archived: true },
        { slug: "brand-new", title: "Brand new", overview: "Fresh project" },
      ],
    });
    expect(merged.headline).toBe("New headline");
    expect(merged.skills).toEqual([{ category: "Owner skills", items: ["Python", "SQL"] }]);
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
    expect((await validateBackup(backup)).ok).toBe(true);
    expect(
      (await validateBackup({ ...backup, entries: { "private-admin/other.json": {} } })).ok,
    ).toBe(false);
    expect(
      (
        await validateBackup({
          ...backup,
          entries: { "private-admin/content/sai.json": { bad: true } },
        })
      ).ok,
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

describe("appearance overrides (theme and layout)", () => {
  it("accepts a known theme preset and unique non-home hidden sections", () => {
    const result = validateContentOverrides({
      appearance: { theme: "cobalt", hiddenSections: ["certifications", "skills"] },
    });
    expect(result).toEqual({
      ok: true,
      content: { appearance: { theme: "cobalt", hiddenSections: ["certifications", "skills"] } },
    });
  });

  it("rejects free-form themes, hiding home, duplicates and unknown keys", () => {
    for (const appearance of [
      { theme: "red; } body { display:none" },
      { hiddenSections: ["home"] },
      { hiddenSections: ["skills", "skills"] },
      { hiddenSections: ["blog"] },
      { css: ":root{}" },
    ]) {
      expect(validateContentOverrides({ appearance }).ok).toBe(false);
    }
  });
});

describe("theme presets", async () => {
  const { DEFAULT_THEME, THEME_PRESETS, themeCssVariables, themeForPreset } =
    await import("@/config/site-config");
  it("changes only accent tokens and falls back to the default theme", () => {
    expect(themeForPreset(undefined)).toBe(DEFAULT_THEME);
    expect(themeForPreset("crimson")).toBe(DEFAULT_THEME);
    const cobalt = themeForPreset("cobalt");
    expect(cobalt.colors.primary).toBe(THEME_PRESETS.cobalt.primary);
    expect(cobalt.colors.background).toBe(DEFAULT_THEME.colors.background);
    expect(themeCssVariables(cobalt)).toContain(
      `--primary-text: ${THEME_PRESETS.cobalt.primaryText};`,
    );
  });

  it("keeps preset small-text colours at WCAG AA contrast on the dark background", () => {
    // Background oklch(0.191 0 0) ≈ #1a1a1a.
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
    };
    const background = luminance("#1a1a1a");
    for (const preset of Object.values(THEME_PRESETS)) {
      const ratio = (luminance(preset.primaryText) + 0.05) / (background + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("CMS skill groups", () => {
  it("accepts bounded, unique skill groups", () => {
    const result = validateContentOverrides({
      skills: [
        { cat: "Frontend", desc: "Interface engineering", items: ["React", "TypeScript"] },
        { cat: "Backend", desc: "Service engineering", items: ["Node.js", "PostgreSQL"] },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content.skills?.[0]?.items).toEqual(["React", "TypeScript"]);
  });

  it("rejects duplicate categories, duplicate skills and unknown fields", () => {
    expect(
      validateContentOverrides({
        skills: [
          { cat: "Frontend", desc: "A", items: ["React"] },
          { cat: "frontend", desc: "B", items: ["Node.js"] },
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateContentOverrides({
        skills: [{ cat: "Frontend", desc: "A", items: ["React", "React"] }],
      }).ok,
    ).toBe(false);
    expect(
      validateContentOverrides({
        skills: [{ cat: "Frontend", desc: "A", items: ["React"], injected: true }],
      }).ok,
    ).toBe(false);
  });
});
