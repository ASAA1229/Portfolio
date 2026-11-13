import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminNavigation } from "@/components/AdminNavigation";
import { EyeOff, FileText, History, RotateCcw, Save, Send } from "lucide-react";
import {
  CONTENT_PAGES,
  PROFILE_REVIEW_ITEMS,
  isProfileReviewCurrent,
  THEME_PRESET_IDS,
  validateContentOverrides,
  type ContentDocument,
  type ContentOverrides,
  type ContentProfileId,
} from "@/lib/cms-content";
import {
  NAV_SECTIONS,
  THEME_PRESETS,
  themeCssVariables,
  themeForPreset,
} from "@/config/site-config";
import { clearPublishedContentCache } from "@/lib/published-content";

export const Route = createFileRoute("/admin/content")({
  head: () => ({
    meta: [
      { title: "Private Portfolio Content Manager" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ContentManager,
});

const PROFILES: ReadonlyArray<{ id: ContentProfileId; label: string }> = [
  { id: "abhishek", label: "Abhishek" },
  { id: "ammu", label: "Amulya (Ammu)" },
  { id: "bava", label: "Anjini Kumar (Bava)" },
  { id: "sai", label: "Sai (Darling)" },
];

type Basics = NonNullable<ContentOverrides["basics"]>;
const BASIC_FIELDS: ReadonlyArray<{
  key: keyof Omit<Basics, "socials">;
  label: string;
  multiline?: boolean;
}> = [
  { key: "headline", label: "Headline" },
  { key: "summary", label: "Summary", multiline: true },
  { key: "story", label: "Story / about", multiline: true },
  { key: "location", label: "Location" },
  { key: "email", label: "Public email" },
  { key: "phone", label: "Public phone" },
];

/** List sections are edited as JSON so every field of the content model is reachable. */
const LIST_TEMPLATE = {
  projects: [
    {
      slug: "new-project",
      title: "Project title",
      overview: "One-paragraph overview.",
      context: "Academic / internship / personal",
      points: ["What you built", "What it achieved"],
      tech: ["React", "Node.js"],
      archived: false,
    },
  ],
  skills: [{ cat: "Frontend", desc: "Interface engineering", items: ["React", "TypeScript"] }],
  experience: [
    {
      role: "Role",
      company: "Company",
      period: "2024 – 2025",
      points: ["Responsibility"],
      tech: [],
    },
  ],
  education: {
    college: "College",
    qualification: "Degree",
    period: "2020 – 2024",
    score: "8.5 CGPA",
  },
  certifications: [{ title: "Certification", issuer: "Issuer" }],
  socials: [{ platform: "LinkedIn", handle: "https://linkedin.com/in/…" }],
  seo: { home: { title: "Page title", description: "Search description" } },
};

type ListPart = Pick<
  ContentOverrides,
  "projects" | "skills" | "experience" | "education" | "certifications" | "seo"
> & {
  socials?: Basics["socials"];
};

function splitContent(content: ContentOverrides | undefined) {
  const { socials, ...basics } = content?.basics ?? {};
  const lists: ListPart = {
    ...(content?.projects ? { projects: content.projects } : {}),
    ...(content?.skills ? { skills: content.skills } : {}),
    ...(content?.experience ? { experience: content.experience } : {}),
    ...(content?.education ? { education: content.education } : {}),
    ...(content?.certifications ? { certifications: content.certifications } : {}),
    ...(content?.seo ? { seo: content.seo } : {}),
    ...(socials ? { socials } : {}),
  };
  return {
    basics,
    navigation: content?.navigation ?? {},
    appearance: content?.appearance ?? {},
    lists,
  };
}

function ContentManager() {
  const [profileId, setProfileId] = useState<ContentProfileId>("abhishek");
  const [doc, setDoc] = useState<ContentDocument | null>(null);
  const [basics, setBasics] = useState<Omit<Basics, "socials">>({});
  const [navigation, setNavigation] = useState<ContentOverrides["navigation"]>({});
  const [appearance, setAppearance] = useState<NonNullable<ContentOverrides["appearance"]>>({});
  const [listsJson, setListsJson] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reviewer, setReviewer] = useState("");
  const [reviewChecks, setReviewChecks] = useState<
    Record<(typeof PROFILE_REVIEW_ITEMS)[number], boolean>
  >(
    () =>
      Object.fromEntries(PROFILE_REVIEW_ITEMS.map((item) => [item, false])) as Record<
        (typeof PROFILE_REVIEW_ITEMS)[number],
        boolean
      >,
  );
  const [reviewExceptions, setReviewExceptions] = useState("");

  const applyDocument = useCallback((next: ContentDocument) => {
    setDoc(next);
    const published = next.history.find((entry) => entry.version === next.publishedVersion);
    const parts = splitContent(next.draft?.content ?? published?.content);
    setBasics(parts.basics);
    setNavigation(parts.navigation);
    setAppearance(parts.appearance);
    setListsJson(JSON.stringify(parts.lists, null, 2));
    setReviewChecks(
      Object.fromEntries(
        PROFILE_REVIEW_ITEMS.map((item) => [item, next.review?.checks?.[item] === true]),
      ) as Record<(typeof PROFILE_REVIEW_ITEMS)[number], boolean>,
    );
    setReviewer(next.review?.reviewer ?? "");
    setReviewExceptions(next.review?.exceptions.join("\n") ?? "");
  }, []);

  const load = useCallback(
    async (id: ContentProfileId) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/content?profileId=${encodeURIComponent(id)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          document?: ContentDocument;
          error?: string;
        } | null;
        if (!response.ok || !payload?.document)
          throw new Error(payload?.error ?? "Could not load.");
        applyDocument(payload.document);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load content.");
      } finally {
        setBusy(false);
      }
    },
    [applyDocument],
  );

  useEffect(() => {
    setMessage("");
    void load(profileId);
  }, [load, profileId]);

  function buildContent(): ContentOverrides | null {
    let lists: ListPart;
    try {
      lists = JSON.parse(listsJson || "{}") as ListPart;
    } catch {
      setError("The list sections are not valid JSON.");
      return null;
    }
    const { socials, ...rest } = lists ?? {};
    const cleanBasics = Object.fromEntries(
      Object.entries(basics).filter(([, value]) => typeof value === "string" && value.trim()),
    );
    const cleanNavigation = Object.fromEntries(
      Object.entries(navigation ?? {}).filter(
        ([, value]) => typeof value === "string" && value.trim(),
      ),
    );
    const content = {
      ...rest,
      ...(Object.keys(cleanBasics).length || socials
        ? { basics: { ...cleanBasics, ...(socials ? { socials } : {}) } }
        : {}),
      ...(Object.keys(cleanNavigation).length ? { navigation: cleanNavigation } : {}),
      ...(appearance.theme || appearance.hiddenSections?.length
        ? {
            appearance: {
              ...(appearance.theme ? { theme: appearance.theme } : {}),
              ...(appearance.hiddenSections?.length
                ? { hiddenSections: appearance.hiddenSections }
                : {}),
            },
          }
        : {}),
    };
    const validated = validateContentOverrides(content);
    if (!validated.ok) {
      setError(validated.errors.join(" "));
      return null;
    }
    return validated.content;
  }

  async function act(
    action: "draft" | "publish" | "rollback" | "unpublish" | "review",
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/content/${action}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId, ...extra }),
      });
      const payload = (await response.json().catch(() => null)) as {
        document?: ContentDocument;
        error?: string;
      } | null;
      if (!response.ok || !payload?.document)
        throw new Error(payload?.error ?? `${action} failed.`);
      applyDocument(payload.document);
      clearPublishedContentCache();
      setMessage(
        action === "draft"
          ? "Draft saved privately. Publish it to update the public pages."
          : action === "publish"
            ? `Published as version ${payload.document.publishedVersion}.`
            : action === "rollback"
              ? `Restored as new version ${payload.document.publishedVersion}; history is unchanged.`
              : action === "review"
                ? `Profile sign-off recorded for published version ${payload.document.review?.publishedVersion}.`
                : "Unpublished. Public pages now show the curated content.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  function saveDraft() {
    const content = buildContent();
    if (content) void act("draft", { content });
  }

  let previewLists: ListPart = {};
  let previewError = "";
  try {
    previewLists = JSON.parse(listsJson || "{}") as ListPart;
  } catch {
    previewError = "List data contains invalid JSON.";
  }
  const previewTitle =
    basics.headline?.trim() ||
    PROFILES.find((profile) => profile.id === profileId)?.label ||
    profileId;
  const previewTheme = themeForPreset(appearance.theme);
  const previewNavigation = NAV_SECTIONS.filter(
    (section) =>
      section.page === "home" || !(appearance.hiddenSections ?? []).includes(section.page),
  ).map((section) => navigation?.[section.page]?.trim() || section.label);
  const input = "mt-2 w-full rounded border border-border bg-background p-2 text-sm";

  return (
    <main className="site-container max-w-5xl py-10 sm:py-14">
      <AdminNavigation current="/admin/content" />
      <p className="font-mono text-xs text-primary">CONTENT WORKFLOW · PRIVATE</p>
      <h1 className="mt-3 flex items-center gap-3 text-4xl font-semibold">
        <FileText className="size-8" aria-hidden="true" /> Portfolio Content
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Edit each profile&apos;s public content without changing code. Saving creates a private
        draft; publishing creates a new version that overrides the curated content on the public
        pages. Every published version is kept and can be restored. Published resume sections keep
        precedence where they exist.
      </p>

      <label className="mt-6 block text-sm">
        Profile
        <select
          className={`${input} max-w-xs`}
          value={profileId}
          onChange={(event) => setProfileId(event.target.value as ContentProfileId)}
          disabled={busy}
        >
          {PROFILES.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {doc?.publishedVersion
          ? `Published version: ${doc.publishedVersion}.`
          : "Nothing published — public pages show curated content."}{" "}
        {doc?.draft
          ? `Unpublished draft saved ${new Date(doc.draft.updatedAt).toLocaleString()}.`
          : ""}
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded border border-red-400/40 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && <p className="mt-3 rounded border border-border p-3 text-sm">{message}</p>}

      <section className="mt-8 rounded-lg border border-border bg-card p-5 sm:p-7">
        <h2 className="text-2xl">Basics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          {BASIC_FIELDS.map((field) => (
            <label key={field.key} className={`text-sm ${field.multiline ? "sm:col-span-2" : ""}`}>
              {field.label}
              {field.multiline ? (
                <textarea
                  className={input}
                  rows={4}
                  value={basics[field.key] ?? ""}
                  onChange={(event) => setBasics({ ...basics, [field.key]: event.target.value })}
                />
              ) : (
                <input
                  className={input}
                  value={basics[field.key] ?? ""}
                  onChange={(event) => setBasics({ ...basics, [field.key]: event.target.value })}
                />
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-7">
        <h2 className="text-2xl">Navigation labels</h2>
        <p className="mt-2 text-sm text-muted-foreground">Leave blank to keep the default label.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-4 [&>*]:min-w-0">
          {NAV_SECTIONS.filter((section) =>
            (CONTENT_PAGES as readonly string[]).includes(section.page),
          ).map((section) => (
            <label key={section.page} className="text-sm">
              {section.label}
              <input
                className={input}
                placeholder={section.label}
                value={navigation?.[section.page] ?? ""}
                onChange={(event) =>
                  setNavigation({ ...navigation, [section.page]: event.target.value })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-7">
        <h2 className="text-2xl">Theme and layout</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Accent presets keep the accessible dark design. Hidden sections are removed from this
          profile's navigation; Home always stays.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <label className="text-sm">
            Accent theme
            <select
              className={input}
              value={appearance.theme ?? "crimson"}
              onChange={(event) =>
                setAppearance({
                  ...appearance,
                  theme: event.target.value as (typeof THEME_PRESET_IDS)[number],
                })
              }
            >
              {THEME_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {THEME_PRESETS[id].label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-sm">
            <legend>Hidden sections</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {NAV_SECTIONS.filter((section) => section.page !== "home").map((section) => {
                const hidden = appearance.hiddenSections?.includes(section.page) ?? false;
                return (
                  <label key={section.page} className="inline-flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hidden}
                      onChange={() => {
                        const current = appearance.hiddenSections ?? [];
                        setAppearance({
                          ...appearance,
                          hiddenSections: hidden
                            ? current.filter((page) => page !== section.page)
                            : [...current, section.page],
                        });
                      }}
                    />
                    {section.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-7">
        <h2 className="text-2xl">
          Projects, experience, education, certifications, socials and SEO
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          JSON. Projects merge by slug (set <code>archived: true</code> to hide one); experience and
          certifications replace the curated lists when present.
        </p>
        <textarea
          className={`${input} font-mono`}
          rows={18}
          spellCheck={false}
          value={listsJson}
          onChange={(event) => setListsJson(event.target.value)}
          aria-label="List sections as JSON"
        />
        <button
          type="button"
          className="mt-2 text-sm underline"
          onClick={() => setListsJson(JSON.stringify(LIST_TEMPLATE, null, 2))}
        >
          Insert example structure
        </button>
      </section>

      <section
        className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-7"
        aria-labelledby="profile-review-title"
      >
        <h2 id="profile-review-title" className="text-2xl">
          Profile completeness and owner sign-off
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review the currently published profile and its approved assets. Every check is an owner
          attestation; accepted exceptions are recorded with the exact published content version.
        </p>
        {doc?.review && (
          <p className="mt-3 text-sm" role="status">
            {isProfileReviewCurrent(doc)
              ? `Signed off by ${doc.review.reviewer} on ${new Date(doc.review.signedAt).toLocaleString()} for version ${doc.review.publishedVersion}.`
              : `Previous sign-off by ${doc.review.reviewer} is stale; the published version has changed.`}
          </p>
        )}
        <label className="mt-4 block text-sm">
          Reviewer / owner name
          <input
            className={input}
            maxLength={100}
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
            placeholder="Name of the person approving this profile"
          />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROFILE_REVIEW_ITEMS.map((item) => (
            <label key={item} className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={reviewChecks[item]}
                onChange={(event) =>
                  setReviewChecks((current) => ({ ...current, [item]: event.target.checked }))
                }
              />
              <span>
                {
                  (
                    {
                      biography: "Biography and identity are accurate and approved",
                      skills: "Skills and proficiency claims are accurate",
                      projects: "Project descriptions, links and ownership are accurate",
                      experience: "Experience and employment details are approved",
                      education: "Education details are approved",
                      certifications: "Certifications and issuers are accurate",
                      contact: "Public contact details and social links are correct",
                      imagery:
                        "Portraits/gallery/project imagery have approval, attribution and meaningful alt text",
                      profileIsolation:
                        "No other profile's private or incorrect content is exposed",
                    } as const
                  )[item]
                }
              </span>
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm">
          Accepted exceptions (one per line, optional)
          <textarea
            className={input}
            rows={3}
            maxLength={3000}
            value={reviewExceptions}
            onChange={(event) => setReviewExceptions(event.target.value)}
            placeholder="Document any explicitly accepted content or asset gaps."
          />
        </label>
        <button
          type="button"
          className="mt-4 inline-flex min-h-11 items-center rounded bg-primary px-4 text-primary-foreground disabled:opacity-50"
          disabled={
            busy ||
            !doc?.publishedVersion ||
            !reviewer.trim() ||
            !PROFILE_REVIEW_ITEMS.every((item) => reviewChecks[item])
          }
          onClick={() =>
            void act("review", {
              reviewer,
              checks: reviewChecks,
              exceptions: reviewExceptions
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
        >
          Record sign-off for published version {doc?.publishedVersion ?? "—"}
        </button>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4"
          onClick={() => setPreviewOpen((open) => !open)}
        >
          <FileText className="size-4" aria-hidden="true" />{" "}
          {previewOpen ? "Hide draft preview" : "Preview current draft"}
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4"
          disabled={busy}
          onClick={saveDraft}
        >
          <Save className="size-4" aria-hidden="true" /> Save draft
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-primary-foreground disabled:opacity-50"
          disabled={busy || !doc?.draft}
          onClick={() => void act("publish")}
        >
          <Send className="size-4" aria-hidden="true" /> Publish draft
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 disabled:opacity-50"
          disabled={busy || !doc?.publishedVersion}
          onClick={() => {
            if (
              window.confirm(
                "Unpublish this profile's content? Public pages return to curated content.",
              )
            )
              void act("unpublish");
          }}
        >
          <EyeOff className="size-4" aria-hidden="true" /> Unpublish
        </button>
      </div>

      {previewOpen && (
        <section
          className="mt-6 rounded-lg border border-primary/30 bg-card p-5 sm:p-7"
          aria-label="Draft preview"
        >
          <style>{".draft-appearance-preview { " + themeCssVariables(previewTheme) + " }"}</style>
          <div className="draft-appearance-preview rounded-lg border border-border bg-background p-5">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              Unpublished appearance preview · {THEME_PRESETS[appearance.theme ?? "crimson"].label}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{previewTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Profile: {PROFILES.find((profile) => profile.id === profileId)?.label}
            </p>
            <nav aria-label="Draft navigation preview" className="mt-4 flex flex-wrap gap-2">
              {previewNavigation.map((label) => (
                <span key={label} className="rounded border border-border px-3 py-2 text-xs">
                  {label}
                </span>
              ))}
            </nav>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Accent preview
              </span>
              <span className="text-sm text-primary">Accessible accent text</span>
            </div>
          </div>
          <h3 className="mt-6 text-xl font-semibold">Content preview</h3>
          <p className="mt-3 text-lg">{basics.summary || "No summary entered yet."}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
            {basics.story || "No story/about text entered yet."}
          </p>
          {previewError ? (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {previewError} Fix it before saving or publishing.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded border border-border p-4">
                <h3 className="font-semibold">Projects ({previewLists.projects?.length ?? 0})</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {(previewLists.projects ?? []).slice(0, 5).map((project) => (
                    <li key={project.slug} className="border-b border-border pb-2">
                      <span className="font-medium">{project.title}</span>
                      <p className="text-xs text-muted-foreground">{project.overview}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded border border-border p-4">
                <h3 className="font-semibold">Skills</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(previewLists.skills ?? [])
                    .flatMap((group) => group.items)
                    .slice(0, 18)
                    .map((skill) => (
                      <span key={skill} className="rounded border border-border px-2 py-1 text-xs">
                        {skill}
                      </span>
                    ))}
                </div>
              </div>
              <div className="rounded border border-border p-4">
                <h3 className="font-semibold">
                  Experience ({previewLists.experience?.length ?? 0})
                </h3>
                {(previewLists.experience ?? []).slice(0, 4).map((item, index) => (
                  <p key={index} className="mt-2 text-sm">
                    {item.role} · {item.company}{" "}
                    <span className="text-xs text-muted-foreground">{item.period}</span>
                  </p>
                ))}
              </div>
              <div className="rounded border border-border p-4">
                <h3 className="font-semibold">Education &amp; certifications</h3>
                <p className="mt-2 text-sm">
                  {previewLists.education?.qualification || "Education not entered"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {previewLists.certifications?.length ?? 0} certifications
                </p>
              </div>
            </div>
          )}
          <div className="mt-4 rounded border border-border p-4">
            <h3 className="font-semibold">Search metadata</h3>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {JSON.stringify(previewLists.seo ?? {}, null, 2)}
            </pre>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Preview reflects current editor values and does not change the public profile. Save and
            publish to make these changes live.
          </p>
        </section>
      )}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-2xl">
          <History className="size-5" aria-hidden="true" /> Version history
        </h2>
        {doc?.history.length ? (
          <ol className="mt-4 space-y-2">
            {[...doc.history].reverse().map((entry) => (
              <li
                key={entry.version}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3 text-sm"
              >
                <span>
                  v{entry.version} ·{" "}
                  {entry.kind === "rollback" ? `restored v${entry.restoredVersion}` : "published"} ·{" "}
                  {new Date(entry.publishedAt).toLocaleString()}
                  {entry.version === doc.publishedVersion ? " · current" : ""}
                </span>
                {entry.version !== doc.publishedVersion && (
                  <button
                    className="inline-flex items-center gap-1 underline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Restore version ${entry.version} as a new published version?`,
                        )
                      )
                        void act("rollback", { version: entry.version });
                    }}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" /> Restore
                  </button>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No versions published yet.</p>
        )}
      </section>
    </main>
  );
}
