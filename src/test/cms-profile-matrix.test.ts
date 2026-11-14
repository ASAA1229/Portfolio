// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CONTENT_PROFILE_IDS,
  PERSON_FIELD_COVERAGE,
  mergePersonPortfolio,
  validateContentOverrides,
  type ContentDocument,
  type ContentOverrides,
  type ContentProfileId,
} from "@/lib/cms-content";
import { PERSON_PORTFOLIOS } from "@/lib/person-portfolios";
import {
  mergeAbhishekContact,
  mergeCerts,
  mergeMissions,
  mergeSiteProjects,
  mergeSkills,
} from "@/lib/abhishek-content";
import server from "@/server";
import { MemoryR2 } from "./helpers/memory-r2";

const ORIGIN = "http://portfolio.test";

function makeEnv(r2: MemoryR2) {
  return { ENVIRONMENT: "development", PORTFOLIO_ADMIN_AUTH_BYPASS: "true", RESUME_BUCKET: r2 };
}

async function api(env: unknown, method: string, path: string, body?: unknown) {
  const headers = new Headers();
  if (method !== "GET") {
    headers.set("origin", ORIGIN);
    headers.set("content-type", "application/json");
  }
  return server.fetch(
    new Request(ORIGIN + path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
    {},
  );
}

async function action(env: unknown, name: string, body: Record<string, unknown>) {
  const response = await api(env, "POST", `/api/admin/content/${name}`, body);
  const payload = (await response.json()) as { document?: ContentDocument; error?: string };
  return { status: response.status, ...payload };
}

async function publicContent(env: unknown, profileId: string) {
  const response = await api(env, "GET", `/api/published-content?profileId=${profileId}`);
  return ((await response.json()) as { content: ContentOverrides | null }).content;
}

/** One representative edit per CMS field group; each must be visible after publishing. */
const FIELD_EDITS: { field: string; content: ContentOverrides }[] = [
  {
    field: "basics",
    content: {
      basics: {
        headline: "Matrix headline",
        summary: "Matrix summary",
        story: "Matrix story",
        location: "Matrix City",
        email: "matrix@example.com",
        phone: "+1 555 0100",
        socials: [{ platform: "GitHub", handle: "https://github.com/matrix" }],
      },
    },
  },
  {
    field: "projects",
    content: {
      projects: [
        { slug: "matrix-project", title: "Matrix Project", overview: "Overview", tech: ["TS"] },
      ],
    },
  },
  {
    field: "skills",
    content: { skills: [{ cat: "Matrix", desc: "Desc", items: ["Alpha", "Beta"] }] },
  },
  {
    field: "experience",
    content: { experience: [{ role: "Matrix Engineer", company: "Matrix Co", period: "2025" }] },
  },
  {
    field: "education",
    content: {
      education: { college: "Matrix College", qualification: "BSc", period: "2020", score: "9" },
    },
  },
  {
    field: "certifications",
    content: { certifications: [{ title: "Matrix Cert", issuer: "Matrix Issuer" }] },
  },
  {
    field: "strengths",
    content: { strengths: [{ title: "Matrix Strength", text: "Matrix strength text" }] },
  },
  {
    field: "leadership",
    content: {
      leadership: [{ title: "Matrix Lead", period: "2024", description: "Led the matrix" }],
    },
  },
  {
    field: "training",
    content: {
      training: [{ title: "Matrix Course", provider: "Matrix U", status: "Done", topics: ["T"] }],
    },
  },
  { field: "seo", content: { seo: { home: { title: "Matrix SEO", description: "Matrix desc" } } } },
  { field: "navigation", content: { navigation: { projects: "Originals" } } },
  {
    field: "appearance",
    content: { appearance: { theme: "cobalt", hiddenSections: ["certifications"] } },
  },
];

describe("content model coverage", () => {
  it("accounts for every public person-profile field with an Admin or curated disposition", () => {
    // Optional fields (e.g. location) may be absent on some curated profiles: use the union.
    const present = new Set(
      Object.values(PERSON_PORTFOLIOS).flatMap((profile) => Object.keys(profile)),
    );
    for (const field of present) expect(PERSON_FIELD_COVERAGE, field).toHaveProperty(field);
    const curated = Object.entries(PERSON_FIELD_COVERAGE)
      .filter(([, mode]) => mode === "curated")
      .map(([field]) => field)
      .sort();
    // Only identity fields stay in source control; everything else is owner-manageable.
    expect(curated).toEqual(["displayName", "id", "initials", "name", "nickname"]);
  });

  it("validates every edit sample and rejects unknown or oversized fields", () => {
    for (const { field, content } of FIELD_EDITS) {
      expect(validateContentOverrides(content), field).toMatchObject({ ok: true });
    }
    expect(validateContentOverrides({ nonsense: [] }).ok).toBe(false);
    expect(validateContentOverrides({ strengths: [{ title: "x", text: "y", extra: 1 }] }).ok).toBe(
      false,
    );
    expect(validateContentOverrides({ training: [{ title: "x" }] }).ok).toBe(false);
    expect(validateContentOverrides({ basics: { headline: "<script>".repeat(100) } }).ok).toBe(
      false,
    );
  });
});

describe.each(CONTENT_PROFILE_IDS)("%s content lifecycle through the Admin API", (profileId) => {
  it("moves through draft, preview, publish, edit, rollback, unpublish with history", async () => {
    const r2 = new MemoryR2();
    const env = makeEnv(r2);

    // Draft is private: nothing public yet.
    const draft = await action(env, "draft", {
      profileId,
      content: { basics: { headline: `${profileId} v1` } },
    });
    expect(draft.status).toBe(200);
    expect(draft.document?.draft?.content.basics?.headline).toBe(`${profileId} v1`);
    expect(await publicContent(env, profileId)).toBeNull();

    // Publishing without a draft is refused.
    const second = await action(env, "publish", { profileId });
    expect(second.status).toBe(200);
    expect(await publicContent(env, profileId)).toMatchObject({
      basics: { headline: `${profileId} v1` },
    });

    await action(env, "draft", { profileId, content: { basics: { headline: `${profileId} v2` } } });
    // An unpublished draft must not leak while v1 is live.
    expect((await publicContent(env, profileId))?.basics?.headline).toBe(`${profileId} v1`);
    await action(env, "publish", { profileId });
    expect((await publicContent(env, profileId))?.basics?.headline).toBe(`${profileId} v2`);

    const rolled = await action(env, "rollback", { profileId, version: 1 });
    expect(rolled.status).toBe(200);
    expect((await publicContent(env, profileId))?.basics?.headline).toBe(`${profileId} v1`);
    expect(rolled.document?.history.map((entry) => entry.kind)).toEqual([
      "publish",
      "publish",
      "rollback",
    ]);
    expect(rolled.document?.history.map((entry) => entry.version)).toEqual([1, 2, 3]);

    const unpublished = await action(env, "unpublish", { profileId });
    expect(unpublished.status).toBe(200);
    expect(await publicContent(env, profileId)).toBeNull();
    // History is retained after unpublish so the owner can restore.
    expect(unpublished.document?.history).toHaveLength(3);
    const restored = await action(env, "rollback", { profileId, version: 2 });
    expect(restored.status).toBe(200);
    expect((await publicContent(env, profileId))?.basics?.headline).toBe(`${profileId} v2`);
  });

  it("publishes every field group and shows it through the public merge", async () => {
    const r2 = new MemoryR2();
    const env = makeEnv(r2);
    for (const { field, content } of FIELD_EDITS) {
      expect((await action(env, "draft", { profileId, content })).status, field).toBe(200);
      expect((await action(env, "publish", { profileId })).status, field).toBe(200);
      const published = await publicContent(env, profileId);
      expect(published, field).toMatchObject(JSON.parse(JSON.stringify(content)));
    }
  });

  it("never leaks content to other profiles", async () => {
    const r2 = new MemoryR2();
    const env = makeEnv(r2);
    await action(env, "draft", {
      profileId,
      content: { basics: { headline: `only-${profileId}` } },
    });
    await action(env, "publish", { profileId });
    for (const other of CONTENT_PROFILE_IDS.filter((id) => id !== profileId)) {
      expect(await publicContent(env, other)).toBeNull();
    }
  });
});

describe("published content drives each profile's public data", () => {
  it.each(["ammu", "bava", "sai"] as const)("%s person pages merge every field group", (id) => {
    const base = PERSON_PORTFOLIOS[id];
    const all: ContentOverrides = Object.assign({}, ...FIELD_EDITS.map((entry) => entry.content));
    const merged = mergePersonPortfolio(base, all);
    expect(merged.headline).toBe("Matrix headline");
    expect(merged.summary).toBe("Matrix summary");
    expect(merged.story).toBe("Matrix story");
    expect(merged.location).toBe("Matrix City");
    expect(merged.email).toBe("matrix@example.com");
    expect(merged.phone).toBe("+1 555 0100");
    expect(merged.socialLabels).toEqual([
      { platform: "GitHub", handle: "https://github.com/matrix" },
    ]);
    expect(merged.projects.some((project) => project.slug === "matrix-project")).toBe(true);
    expect(merged.skills).toEqual([{ category: "Matrix", items: ["Alpha", "Beta"] }]);
    expect(merged.experience.map((item) => item.role)).toEqual(["Matrix Engineer"]);
    expect(merged.education.college).toBe("Matrix College");
    expect(merged.certifications).toEqual([{ title: "Matrix Cert", issuer: "Matrix Issuer" }]);
    expect(merged.strengths).toEqual([{ title: "Matrix Strength", text: "Matrix strength text" }]);
    expect(merged.leadership).toEqual([
      { title: "Matrix Lead", period: "2024", description: "Led the matrix" },
    ]);
    expect(merged.training).toEqual([
      { title: "Matrix Course", provider: "Matrix U", status: "Done", topics: ["T"] },
    ]);
    // Curated identity and the originals are untouched; other profiles are unaffected.
    expect(merged.name).toBe(base.name);
    expect(base.headline).not.toBe("Matrix headline");
    expect(mergePersonPortfolio(base, null)).toBe(base);
  });

  it("preserves curated data when a field is omitted and clears it when explicitly empty", () => {
    const base = PERSON_PORTFOLIOS.bava;
    expect(mergePersonPortfolio(base, { basics: { headline: "x" } }).skills).toEqual(base.skills);
    const cleared = mergePersonPortfolio(base, {
      skills: [],
      projects: [],
      experience: [],
      certifications: [],
      strengths: [],
      leadership: [],
      training: [],
    });
    expect(cleared.skills).toEqual([]);
    expect(cleared.projects).toEqual([]);
    expect(cleared.experience).toEqual([]);
    expect(cleared.certifications).toEqual([]);
    expect(cleared.strengths).toEqual([]);
    expect(cleared.leadership).toEqual([]);
    expect(cleared.training).toEqual([]);
  });

  it("abhishek root pages merge the CMS fields they render", () => {
    const all: ContentOverrides = Object.assign({}, ...FIELD_EDITS.map((entry) => entry.content));
    expect(mergeSiteProjects(all).some((project) => project.slug === "matrix-project")).toBe(true);
    expect(mergeSkills(all)).toEqual([{ cat: "Matrix", desc: "Desc", items: ["Alpha", "Beta"] }]);
    expect(mergeMissions(all)[0]?.role).toBe("Matrix Engineer");
    expect(mergeCerts(all)).toEqual([["Matrix Cert", "Matrix Issuer"]]);
    expect(mergeAbhishekContact(all)).toMatchObject({
      email: "matrix@example.com",
      phone: "+1 555 0100",
      location: "Matrix City",
      github: "https://github.com/matrix",
    });
    expect(mergeSiteProjects(null).length).toBeGreaterThan(0);
  });
});

describe("optimistic concurrency on content documents", () => {
  it("rejects a write based on a stale read instead of silently overwriting", async () => {
    const r2 = new MemoryR2();
    r2.interleave = true;
    const env = makeEnv(r2);
    const results = await Promise.all(
      ["a", "b", "c", "d"].map((tag) =>
        api(env, "POST", "/api/admin/content/draft", {
          profileId: "sai",
          content: { basics: { headline: `writer ${tag}` } },
        }),
      ),
    );
    const statuses = results.map((response) => response.status).sort();
    // Exactly one writer can win each round; losers are told to reload (409), never lost silently.
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(3);
    const body = (await results.find((r) => r.status === 409)!.json()) as { code: string };
    expect(body.code).toBe("CONCURRENT_MODIFICATION");
    const stored = JSON.parse(r2.text("private-admin/content/sai.json")!) as ContentDocument;
    expect(stored.draft?.content.basics?.headline).toMatch(/^writer [a-d]$/);
  });
});
