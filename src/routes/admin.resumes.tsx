import { useEffect, useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminNavigation } from "@/components/AdminNavigation";
import { PublishHistoryPanel } from "@/components/PublishHistoryPanel";
import {
  FileLock2,
  LogOut,
  ShieldCheck,
  UploadCloud,
  Trash2,
  Download,
  Save,
  RefreshCw,
  FilePenLine,
  ListTree,
} from "lucide-react";
import {
  mapResumeSections,
  suggestStructuredResumeEntries,
  suggestResumeContactDetails,
} from "@/lib/resume-mapping";
import {
  createEmptyResumeEntry,
  type ResumeSectionEntry,
  type StructuredResumeEntry,
  type StructuredResumeSections,
  type ResumeSectionName,
} from "@/lib/resume-types";

type ResumeRecord = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  status: "pending" | "approved";
  profileId?: "abhishek" | "ammu" | "bava" | "sai" | "unassigned";
  displayName: string;
  headline: string;
  summary: string;
  skills: string[];
  contact?: { email?: string; phone?: string; linkedin?: string; github?: string };
  structuredSections?: StructuredResumeSections;
  privateReviewNotes?: string;
};

function StructuredEntryEditor({
  entry,
  section,
  index,
  onChange,
}: {
  entry: ResumeSectionEntry;
  section: ResumeSectionName;
  index: number;
  onChange: (entry: ResumeSectionEntry) => void;
}) {
  if (typeof entry === "string") {
    return (
      <textarea
        aria-label={section + " entry " + (index + 1)}
        value={entry}
        onChange={(event) => onChange(event.target.value)}
        maxLength={section === "certifications" ? 500 : 2000}
        rows={3}
        className="w-full border border-white/15 bg-black/30 p-3 text-sm text-white"
      />
    );
  }
  const fields: { key: keyof StructuredResumeEntry; label: string; multiline?: boolean }[] =
    section === "experience"
      ? [
          { key: "role", label: "Role / designation" },
          { key: "organization", label: "Company" },
          { key: "location", label: "Location" },
          { key: "startDate", label: "Start date" },
          { key: "endDate", label: "End date" },
          { key: "description", label: "Responsibilities / achievements", multiline: true },
          { key: "technologies", label: "Technologies" },
        ]
      : section === "education"
        ? [
            { key: "title", label: "Qualification / degree" },
            { key: "organization", label: "Institution" },
            { key: "location", label: "Location" },
            { key: "startDate", label: "Start date" },
            { key: "endDate", label: "End date" },
            { key: "grade", label: "Grade / score" },
            { key: "description", label: "Description", multiline: true },
          ]
        : section === "projects"
          ? [
              { key: "title", label: "Project name" },
              { key: "role", label: "Role" },
              { key: "description", label: "Description", multiline: true },
              { key: "technologies", label: "Technologies" },
              { key: "url", label: "Project URL" },
            ]
          : [
              { key: "title", label: "Certification name" },
              { key: "organization", label: "Issuing organization" },
              { key: "startDate", label: "Issue date" },
              { key: "credentialId", label: "Credential ID" },
              { key: "url", label: "Verification URL" },
              { key: "description", label: "Description", multiline: true },
            ];
  const structuredEntry: StructuredResumeEntry = entry;
  function change(key: keyof StructuredResumeEntry, value: string) {
    onChange({
      ...structuredEntry,
      [key]:
        key === "technologies"
          ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 30)
          : value,
    });
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(({ key, label, multiline }) => (
        <label
          key={key}
          className={"text-[11px] text-white/55 " + (multiline ? "sm:col-span-2" : "")}
        >
          {label}
          {multiline ? (
            <textarea
              value={key === "technologies" ? "" : String(entry[key] ?? "")}
              onChange={(event) => change(key, event.target.value)}
              maxLength={2000}
              rows={3}
              className="mt-1 w-full border border-white/15 bg-black/30 p-2 text-sm text-white"
            />
          ) : (
            <input
              value={
                key === "technologies"
                  ? (entry.technologies ?? []).join(", ")
                  : String(entry[key] ?? "")
              }
              onChange={(event) => change(key, event.target.value)}
              maxLength={320}
              placeholder={key === "url" ? "https://..." : ""}
              className="mt-1 min-h-10 w-full border border-white/15 bg-black/30 px-3 text-sm text-white"
            />
          )}
        </label>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/admin/resumes")({
  head: () => ({
    meta: [
      { title: "Private Resume Manager" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ResumeManager,
});

function ResumeManager() {
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProfileId, setUploadProfileId] =
    useState<NonNullable<ResumeRecord["profileId"]>>("unassigned");
  const [busy, setBusy] = useState(false);
  // Bumped after publish/unpublish/delete so the publish history reloads.
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [profileFilter, setProfileFilter] = useState<"all" | NonNullable<ResumeRecord["profileId"]>>("all");

  const pendingCount = resumes.filter((resume) => resume.status === "pending").length;
  const approvedCount = resumes.filter((resume) => resume.status === "approved").length;
  const visibleResumes = resumes.filter((resume) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [resume.filename, resume.displayName, resume.headline, resume.summary, ...resume.skills].some(
        (value) => value.toLowerCase().includes(query),
      );
    const matchesStatus = statusFilter === "all" || resume.status === statusFilter;
    const matchesProfile = profileFilter === "all" || (resume.profileId ?? "unassigned") === profileFilter;
    return matchesQuery && matchesStatus && matchesProfile;
  });

  async function loadResumes() {
    const response = await fetch("/api/admin/resumes", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 401) throw new Error("Not authenticated");
    const payload = (await response.json()) as { resumes?: ResumeRecord[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Could not load resumes.");
    setResumes(payload.resumes ?? []);
  }

  useEffect(() => {
    let active = true;
    loadResumes()
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Could not load the manager.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function upload(event: ChangeEvent<HTMLFormElement>) {
    event.preventDefault();
    // React clears event.currentTarget once the handler awaits; keep the form element.
    const formElement = event.currentTarget;
    if (!selectedFile) return;
    const lowerName = selectedFile.name.toLowerCase();
    const isPdf =
      lowerName.endsWith(".pdf") && (!selectedFile.type || selectedFile.type === "application/pdf");
    const isDocx =
      lowerName.endsWith(".docx") &&
      (!selectedFile.type ||
        selectedFile.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    if (!isPdf && !isDocx) {
      setError("Choose a PDF or DOCX file whose extension matches its file type.");
      setMessage("");
      return;
    }
    if (selectedFile.size <= 0 || selectedFile.size > 10 * 1024 * 1024) {
      setError("Choose a file larger than 0 bytes and no larger than 10 MB.");
      setMessage("");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("profileId", uploadProfileId);
      const response = await fetch("/api/admin/resumes", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const payload = (await response.json()) as {
        resume?: ResumeRecord;
        error?: string;
        detail?: string;
      };
      if (!response.ok)
        throw new Error(
          [payload.error, payload.detail].filter(Boolean).join(" — ") || "Upload failed.",
        );
      setSelectedFile(null);
      formElement.reset();
      await loadResumes();
      setMessage(
        "Resume uploaded privately and assigned to the selected profile. Review the details before publishing.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveResume(record: ResumeRecord) {
    if (!record.profileId || record.profileId === "unassigned") {
      setError("Assign this resume to the correct public profile before publishing.");
      setMessage("");
      return;
    }
    if (!record.displayName.trim() || !record.headline.trim() || !record.summary.trim()) {
      setError("Complete the display name, headline, and public summary before publishing.");
      setMessage("");
      return;
    }
    if (record.skills.some((skill) => !skill.trim())) {
      setError("Remove any empty skill entries before publishing.");
      setMessage("");
      return;
    }
    const replaces = resumes.find(
      (item) =>
        item.id !== record.id && item.profileId === record.profileId && item.status === "approved",
    );
    if (
      !window.confirm(
        replaces
          ? `Publish these reviewed details? They REPLACE the currently published resume for this profile ("${replaces.displayName || replaces.filename}"), which stays stored privately and can be restored from Publish history.`
          : "Publish these reviewed details to the selected public profile? The original resume file will remain private.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/resumes/${record.id}/publish`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileId: record.profileId ?? "unassigned",
          displayName: record.displayName,
          headline: record.headline,
          summary: record.summary,
          skills: record.skills,
          contact: record.contact ?? {},
          structuredSections: record.structuredSections ?? {
            experience: [],
            education: [],
            projects: [],
            certifications: [],
          },
          privateReviewNotes: record.privateReviewNotes ?? "",
        }),
      });
      const payload = (await response.json()) as {
        resume?: ResumeRecord;
        supersededIds?: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not approve the resume.");
      const superseded = new Set(payload.supersededIds ?? []);
      setResumes((items) =>
        items.map((item) =>
          item.id === record.id
            ? (payload.resume ?? record)
            : superseded.has(item.id)
              ? { ...item, status: "pending" }
              : item,
        ),
      );
      setHistoryRefresh((value) => value + 1);
      setMessage(
        superseded.size
          ? "Published. The previous version for this profile was replaced and kept in Publish history."
          : "Reviewed details approved and published to /api/published-resumes.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  async function extractText(record: ResumeRecord) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/resumes/${record.id}/extract`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response.json()) as {
        text?: string;
        warning?: string | null;
        error?: string;
      };
      if (!response.ok || typeof payload.text !== "string") {
        throw new Error(payload.error ?? "Could not extract text from this document.");
      }
      update(record.id, { privateReviewNotes: payload.text });
      setMessage(
        payload.warning
          ? `Assistive extraction completed into private review notes. ${payload.warning} Review the original before mapping or publishing.`
          : "Assistive extraction completed into private review notes. Check headings, bullets, dates, and reading order against the original before mapping or publishing.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not extract document text.");
    } finally {
      setBusy(false);
    }
  }

  function mapSections(record: ResumeRecord) {
    const sourceText = (record.privateReviewNotes ?? "")
      .replace(
        /\[MAPPED RESUME SECTIONS — PRIVATE REVIEW ONLY\][\s\S]*?\[END MAPPED SECTIONS\]/g,
        "",
      )
      .trim();
    const mapped = mapResumeSections(sourceText);
    const suggestedContact = suggestResumeContactDetails(sourceText);
    const sectionNames = Object.keys(mapped.sections);
    const privateBlock = [
      "[MAPPED RESUME SECTIONS — PRIVATE REVIEW ONLY]",
      ...sectionNames.flatMap((name) => [
        name.toUpperCase(),
        mapped.sections[name as keyof typeof mapped.sections] ?? "",
        "",
      ]),
      "[END MAPPED SECTIONS]",
    ].join("\n");
    const existing = sourceText
      .replace(
        /\[MAPPED RESUME SECTIONS — PRIVATE REVIEW ONLY\][\s\S]*?\[END MAPPED SECTIONS\]/g,
        "",
      )
      .trim();
    const notes = [existing, privateBlock].filter(Boolean).join("\n\n").slice(0, 12000);
    update(record.id, {
      skills: mapped.skills.length ? mapped.skills : record.skills,
      contact: { ...record.contact, ...suggestedContact },
      structuredSections: {
        experience: mapped.sections.experience
          ? suggestStructuredResumeEntries("experience", mapped.sections.experience)
          : (record.structuredSections?.experience ?? []),
        education: mapped.sections.education
          ? suggestStructuredResumeEntries("education", mapped.sections.education)
          : (record.structuredSections?.education ?? []),
        projects: mapped.sections.projects
          ? suggestStructuredResumeEntries("projects", mapped.sections.projects)
          : (record.structuredSections?.projects ?? []),
        certifications: mapped.sections.certifications
          ? suggestStructuredResumeEntries("certifications", mapped.sections.certifications)
          : (record.structuredSections?.certifications ?? []),
      },
      privateReviewNotes: notes,
    });
    setMessage(
      sectionNames.length
        ? `Mapped ${sectionNames.length} recognizable sections and ${Object.keys(suggestedContact).length} explicit contact fields. Clearly labelled fields were suggested automatically; ambiguous text was kept in descriptions. Review every suggestion before saving or publishing.`
        : Object.keys(suggestedContact).length
          ? `No recognized section headings were found, but ${Object.keys(suggestedContact).length} explicit contact fields were suggested. Review them and the extracted text manually.`
          : "No recognized section headings or explicit contact fields were found. No public fields were changed; review the extracted text manually.",
    );
    setError("");
  }

  async function saveDraft(record: ResumeRecord) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/resumes/${record.id}/draft`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileId: record.profileId ?? "unassigned",
          displayName: record.displayName,
          headline: record.headline,
          summary: record.summary,
          skills: record.skills,
          contact: record.contact ?? {},
          structuredSections: record.structuredSections ?? {
            experience: [],
            education: [],
            projects: [],
            certifications: [],
          },
          privateReviewNotes: record.privateReviewNotes ?? "",
        }),
      });
      const payload = (await response.json()) as { resume?: ResumeRecord; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save the draft.");
      setResumes((items) =>
        items.map((item) =>
          item.id === record.id ? (payload.resume ?? { ...record, status: "pending" }) : item,
        ),
      );
      setMessage("Review details saved as a private draft. Nothing from this record is published.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the draft.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublishResume(record: ResumeRecord) {
    if (
      !window.confirm(
        `Remove ${record.displayName || record.filename} from the public profile? It will remain privately stored as a pending draft.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/resumes/${record.id}/unpublish`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response.json()) as { resume?: ResumeRecord; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not unpublish the resume.");
      setResumes((items) =>
        items.map((item) =>
          item.id === record.id ? (payload.resume ?? { ...record, status: "pending" }) : item,
        ),
      );
      setHistoryRefresh((value) => value + 1);
      setMessage(
        "Resume removed from the public feed. The original file and reviewed details remain private.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not unpublish.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteResume(record: ResumeRecord) {
    if (!window.confirm(`Delete ${record.filename} permanently?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/resumes/${record.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Delete failed.");
      setResumes((items) => items.filter((item) => item.id !== record.id));
      setHistoryRefresh((value) => value + 1);
      setMessage("Resume and its private file were deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setSigningOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      window.location.replace("/admin/login");
    }
  }

  function update(id: string, patch: Partial<ResumeRecord>) {
    setResumes((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function updateStructuredEntry(
    record: ResumeRecord,
    section: keyof NonNullable<ResumeRecord["structuredSections"]>,
    index: number,
    value: ResumeSectionEntry,
  ) {
    const current = record.structuredSections ?? {
      experience: [],
      education: [],
      projects: [],
      certifications: [],
    };
    const entries = [...current[section]];
    entries[index] =
      typeof value === "string" ? value.slice(0, section === "certifications" ? 500 : 2000) : value;
    update(record.id, { structuredSections: { ...current, [section]: entries } });
  }

  function addStructuredEntry(
    record: ResumeRecord,
    section: keyof NonNullable<ResumeRecord["structuredSections"]>,
  ) {
    const current = record.structuredSections ?? {
      experience: [],
      education: [],
      projects: [],
      certifications: [],
    };
    const max = section === "certifications" ? 40 : section === "education" ? 20 : 30;
    if (current[section].length >= max) {
      setError(`The ${section} section has reached its ${max}-entry limit.`);
      setMessage("");
      return;
    }
    update(record.id, {
      structuredSections: {
        ...current,
        [section]: [...current[section], createEmptyResumeEntry(section)],
      },
    });
    setError("");
    setMessage("");
  }

  function removeStructuredEntry(
    record: ResumeRecord,
    section: keyof NonNullable<ResumeRecord["structuredSections"]>,
    index: number,
  ) {
    const current = record.structuredSections ?? {
      experience: [],
      education: [],
      projects: [],
      certifications: [],
    };
    update(record.id, {
      structuredSections: {
        ...current,
        [section]: current[section].filter((_, entryIndex) => entryIndex !== index),
      },
    });
  }

  if (checking)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090d] text-sm text-white/60">
        Verifying private session…
      </div>
    );

  return (
    <section className="min-h-screen bg-[#09090d] px-4 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <AdminNavigation current="/admin/resumes" />
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet-300">
              Restricted workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Resume Manager
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Upload privately, review manually, and explicitly publish approved details.
            </p>
          </div>
          <button
            onClick={logout}
            disabled={signingOut}
            className="inline-flex min-h-10 items-center gap-2 border border-white/15 px-4 text-sm text-white/75 hover:bg-white/5 disabled:opacity-50"
          >
            <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <article className="border border-white/10 bg-white/[0.025] p-5">
            <p className="font-mono text-xs text-violet-300">01 / PRIVATE</p>
            <h2 className="mt-3 font-semibold">Source documents</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Original files stay in the private storage bucket and are served only after
              authentication.
            </p>
          </article>
          <article className="border border-white/10 bg-white/[0.025] p-5">
            <p className="font-mono text-xs text-violet-300">02 / REVIEW</p>
            <h2 className="mt-3 font-semibold">Check every field</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Enter or correct the public details yourself. Uploading alone never publishes
              anything.
            </p>
          </article>
          <article className="border border-white/10 bg-white/[0.025] p-5">
            <p className="font-mono text-xs text-violet-300">03 / APPROVE</p>
            <h2 className="mt-3 font-semibold">Explicit publishing</h2>
            <p className="mt-3 font-mono text-2xl text-white">
              {approvedCount}
              <span className="ml-2 text-xs font-sans text-white/45">published</span>
            </p>
            <p className="mt-1 text-xs text-white/45">
              {pendingCount} awaiting review · originals remain private
            </p>
          </article>
        </div>

        <form onSubmit={upload} className="mt-6 border border-white/10 bg-white/[0.025] p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <UploadCloud className="mt-1 size-5 text-violet-300" />
            <div>
              <h2 className="text-lg font-semibold">Upload a resume</h2>
              <p className="mt-1 text-sm text-white/55">PDF or DOCX · maximum 10 MB per file</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
            <input
              aria-label="Resume file"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              required
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setError("");
                setMessage("");
              }}
              className="min-h-12 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm file:mr-4 file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-white"
            />
            <label className="text-xs text-white/55">
              Assign upload to profile
              <select
                value={uploadProfileId}
                onChange={(event) =>
                  setUploadProfileId(event.target.value as NonNullable<ResumeRecord["profileId"]>)
                }
                className="mt-2 min-h-12 w-full border border-white/15 bg-black/30 px-3 text-sm text-white"
              >
                <option value="unassigned">Unassigned</option>
                <option value="abhishek">Abhishek</option>
                <option value="ammu">Amulya</option>
                <option value="bava">Anjini Kumar</option>
                <option value="sai">Sai</option>
              </select>
            </label>
            <button
              disabled={busy || !selectedFile}
              className="min-h-12 shrink-0 bg-violet-300 px-5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {busy ? "Working…" : "Upload privately"}
            </button>
          </div>
          {selectedFile && (
            <div
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60"
              role="status"
            >
              <span className="break-all">
                {selectedFile.name} · {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSelectedFile(null);
                  setError("");
                  setMessage("");
                }}
                className="min-h-8 px-2 underline underline-offset-4 hover:text-white disabled:opacity-50"
              >
                Clear selection
              </button>
            </div>
          )}
        </form>

        {error && (
          <p
            role="alert"
            className="mt-4 border border-red-300/20 bg-red-300/5 p-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-4 border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-200"
          >
            {message}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Stored resumes{" "}
              <span className="font-mono text-sm text-white/40">({resumes.length})</span>
            </h2>
            <p className="mt-1 text-sm text-white/45">
              Public status means approved details only—not the original file.
            </p>
          </div>
          <button
            onClick={() =>
              loadResumes().catch((reason: unknown) =>
                setError(reason instanceof Error ? reason.message : "Refresh failed."),
              )
            }
            className="inline-flex min-h-10 items-center gap-2 border border-white/15 px-3 text-sm"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_190px]">
          <label className="text-xs text-white/55">
            Search resumes
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filename, name, headline, skill…"
              className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/30"
            />
          </label>
          <label className="text-xs text-white/55">
            Publication status
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | "pending" | "approved")
              }
              className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending review</option>
              <option value="approved">Approved / published</option>
            </select>
          </label>
          <label className="text-xs text-white/55">
            Profile
            <select
              value={profileFilter}
              onChange={(event) => setProfileFilter(event.target.value as typeof profileFilter)}
              className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white"
            >
              <option value="all">All profiles</option>
              <option value="abhishek">Abhishek</option>
              <option value="ammu">Amulya (Ammu)</option>
              <option value="bava">Anjini (Bava)</option>
              <option value="sai">Sai (Darling)</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-white/40">
          <span>
            Showing {visibleResumes.length} of {resumes.length} resumes
          </span>
          {(searchQuery || statusFilter !== "all" || profileFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setProfileFilter("all");
              }}
              className="min-h-8 underline underline-offset-4 hover:text-white/75"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-4 space-y-4">
          {visibleResumes.map((record) => (
            <article key={record.id} className="border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="break-all font-semibold">{record.filename}</h3>
                  <p className="mt-1 text-xs text-white/40">
                    {(record.size / 1024).toFixed(0)} KB · Uploaded{" "}
                    {new Date(record.uploadedAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={
                    record.status === "approved"
                      ? "border border-emerald-300/25 px-2 py-1 text-xs text-emerald-200"
                      : "border border-amber-300/25 px-2 py-1 text-xs text-amber-200"
                  }
                >
                  {record.status === "approved" ? "Approved / published" : "Pending review"}
                </span>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-white/60">
                  Public profile
                  <select
                    value={record.profileId ?? "unassigned"}
                    onChange={(event) =>
                      update(record.id, {
                        profileId: event.target.value as NonNullable<ResumeRecord["profileId"]>,
                      })
                    }
                    className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white"
                  >
                    <option value="unassigned">Unassigned — cannot publish</option>
                    <option value="abhishek">Abhishek</option>
                    <option value="ammu">Amulya</option>
                    <option value="bava">Anjini Kumar</option>
                    <option value="sai">Sai</option>
                  </select>
                </label>
                <label className="text-xs text-white/60">
                  Display name
                  <input
                    value={record.displayName}
                    onChange={(event) => update(record.id, { displayName: event.target.value })}
                    maxLength={120}
                    className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Headline
                  <input
                    value={record.headline}
                    onChange={(event) => update(record.id, { headline: event.target.value })}
                    maxLength={180}
                    placeholder="e.g. Software Developer"
                    className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60 sm:col-span-2">
                  Public summary
                  <textarea
                    value={record.summary}
                    onChange={(event) => update(record.id, { summary: event.target.value })}
                    maxLength={3000}
                    rows={4}
                    placeholder="Write and verify the summary that may be public."
                    className="mt-2 w-full border border-white/15 bg-black/30 p-3 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60 sm:col-span-2">
                  Skills (comma-separated)
                  <input
                    value={record.skills.join(", ")}
                    onChange={(event) =>
                      update(record.id, {
                        skills: event.target.value
                          .split(",")
                          .map((skill) => skill.trim())
                          .filter(Boolean)
                          .slice(0, 60),
                      })
                    }
                    className="mt-2 min-h-11 w-full border border-white/15 bg-black/30 px-3 text-sm text-white"
                  />
                </label>
                <div className="sm:col-span-2 rounded border border-white/10 p-4">
                  <h4 className="text-sm font-semibold text-white/80">
                    Public contact & social links
                  </h4>
                  <p className="mt-1 text-xs text-white/40">
                    Optional. Only reviewed values are published; use full HTTPS URLs for social
                    profiles.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(["email", "phone", "linkedin", "github"] as const).map((field) => (
                      <label key={field} className="text-xs capitalize text-white/60">
                        {field}
                        <input
                          value={record.contact?.[field] ?? ""}
                          onChange={(event) =>
                            update(record.id, {
                              contact: { ...record.contact, [field]: event.target.value },
                            })
                          }
                          maxLength={320}
                          placeholder={
                            field === "linkedin" || field === "github" ? "https://..." : ""
                          }
                          className="mt-2 min-h-10 w-full border border-white/15 bg-black/30 px-3 text-sm text-white"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="my-4 border-t border-white/10" />
                  <h4 className="text-sm font-semibold text-white/80">
                    Structured profile sections
                  </h4>
                  <p className="mt-1 text-xs text-white/40">
                    Edit, add or remove individual entries. Changes stay private until you
                    explicitly approve and publish this resume.
                  </p>
                  {(["experience", "education", "projects", "certifications"] as const).map(
                    (section) => {
                      const entries = record.structuredSections?.[section] ?? [];
                      const max =
                        section === "certifications" ? 40 : section === "education" ? 20 : 30;
                      return (
                        <div key={section} className="mt-4 border-t border-white/10 pt-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h5 className="text-xs font-semibold capitalize text-white/75">
                              {section}{" "}
                              <span className="font-mono text-white/35">
                                ({entries.length}/{max})
                              </span>
                            </h5>
                            <button
                              type="button"
                              disabled={busy || entries.length >= max}
                              onClick={() => addStructuredEntry(record, section)}
                              className="min-h-8 border border-violet-300/25 px-3 text-xs text-violet-100 disabled:opacity-40"
                            >
                              Add entry
                            </button>
                          </div>
                          {entries.length === 0 && (
                            <p className="mt-2 text-xs text-white/35">No entries yet.</p>
                          )}
                          <div className="mt-2 space-y-2">
                            {entries.map((entry, index) => (
                              <div
                                key={section + "-" + index}
                                className="border border-white/10 bg-black/20 p-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-white/45">
                                    Entry {index + 1} ·{" "}
                                    {typeof entry === "string"
                                      ? "Legacy text"
                                      : "Structured fields"}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => removeStructuredEntry(record, section, index)}
                                    className="min-h-8 px-2 text-xs text-red-200/80 underline underline-offset-4 disabled:opacity-40"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <StructuredEntryEditor
                                  entry={entry}
                                  section={section}
                                  index={index}
                                  onChange={(next) =>
                                    updateStructuredEntry(record, section, index, next)
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
                <label className="text-xs text-white/60 sm:col-span-2">
                  Private source-text notes (never published)
                  <textarea
                    value={record.privateReviewNotes ?? ""}
                    onChange={(event) =>
                      update(record.id, { privateReviewNotes: event.target.value })
                    }
                    maxLength={12000}
                    rows={5}
                    placeholder="Extracted document text or private notes for reviewing the public fields. This content is never published."
                    className="mt-2 w-full border border-white/15 bg-black/30 p-3 text-sm text-white"
                  />
                  <span className="mt-1 block text-[11px] text-white/35">
                    Up to 12,000 characters. Stored only with the private review record; save as a
                    private draft to persist it.
                  </span>
                </label>
              </div>
              <div className="mt-5 border border-violet-200/15 bg-violet-200/[0.035] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-200/75">
                  Public preview ·{" "}
                  {record.profileId && record.profileId !== "unassigned"
                    ? (
                        {
                          abhishek: "Abhishek",
                          ammu: "Amulya",
                          bava: "Anjini Kumar",
                          sai: "Sai",
                        } as Record<string, string>
                      )[record.profileId]
                    : "No profile assigned"}
                </p>
                <p className="mt-3 text-sm font-semibold">
                  {record.displayName.trim() || "Display name not set"}
                </p>
                <p className="mt-1 text-lg">{record.headline.trim() || "Headline not set"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/60">
                  {record.summary.trim() || "Public summary not set"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {record.skills.filter(Boolean).map((skill, index) => (
                    <span
                      key={skill + index}
                      className="border border-white/15 px-2 py-1 text-xs text-white/70"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-white/35">
                  Only reviewed fields are published. Structured sections remain separate from
                  existing profile facts; the source document and private notes stay private.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href={`/api/admin/resumes/${record.id}/download`}
                  className="inline-flex min-h-10 items-center gap-2 border border-white/15 px-3 text-xs hover:bg-white/5"
                >
                  <Download className="size-4" /> Download original
                </a>
                <button
                  disabled={busy}
                  onClick={() => extractText(record)}
                  className="inline-flex min-h-10 items-center gap-2 border border-sky-300/25 px-3 text-xs text-sky-100 hover:bg-sky-300/5 disabled:opacity-50"
                >
                  <FilePenLine className="size-4" /> Extract document text
                </button>
                \n{" "}
                <button
                  disabled={busy || !(record.privateReviewNotes ?? "").trim()}
                  onClick={() => mapSections(record)}
                  className="inline-flex min-h-10 items-center gap-2 border border-violet-300/25 px-3 text-xs text-violet-100 hover:bg-violet-300/5 disabled:opacity-50"
                >
                  <ListTree className="size-4" /> Map resume sections
                </button>
                <button
                  disabled={busy}
                  onClick={() => saveDraft(record)}
                  className="inline-flex min-h-10 items-center gap-2 border border-white/15 px-3 text-xs hover:bg-white/5 disabled:opacity-50"
                >
                  <FilePenLine className="size-4" /> Save private draft
                </button>
                <button
                  disabled={busy}
                  onClick={() => saveResume(record)}
                  className="inline-flex min-h-10 items-center gap-2 bg-violet-300 px-3 text-xs font-semibold text-black disabled:opacity-50"
                >
                  <Save className="size-4" /> Approve & publish
                </button>
                {record.status === "approved" && (
                  <button
                    disabled={busy}
                    onClick={() => unpublishResume(record)}
                    className="inline-flex min-h-10 items-center gap-2 border border-amber-300/25 px-3 text-xs text-amber-100 hover:bg-amber-300/5 disabled:opacity-50"
                  >
                    Unpublish / rollback
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => deleteResume(record)}
                  className="inline-flex min-h-10 items-center gap-2 border border-red-300/25 px-3 text-xs text-red-200 hover:bg-red-300/5 disabled:opacity-50"
                >
                  <Trash2 className="size-4" /> Delete permanently
                </button>
              </div>
            </article>
          ))}
          {resumes.length === 0 && (
            <div className="border border-dashed border-white/15 p-10 text-center text-sm text-white/45">
              No resumes uploaded yet. Configure private storage, then upload your first file.
            </div>
          )}
          {resumes.length > 0 && visibleResumes.length === 0 && (
            <div className="border border-dashed border-white/15 p-10 text-center text-sm text-white/45">
              No resumes match these filters. Try another search or clear the filters.
            </div>
          )}
        </div>

        <PublishHistoryPanel
          busy={busy}
          refreshKey={historyRefresh}
          onRolledBack={async (text) => {
            setError("");
            setMessage(text);
            await loadResumes();
          }}
        />

        <div className="mt-8 flex items-start gap-3 border border-emerald-200/15 bg-emerald-100/[0.025] p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
          <p className="text-xs leading-5 text-white/55">
            Private originals are not exposed by the public API. Publishing exposes reviewed display
            name, headline, summary, skills and optional structured sections; original files and
            private notes remain private. Document text can be mapped by recognizable headings into
            private review notes and skill suggestions. Mapping never updates public profile
            sections; review and save a private draft, then explicitly approve only the public
            fields.
          </p>
        </div>
        <p className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          <FileLock2 className="size-3" /> Private workspace · No public navigation
        </p>
      </div>
    </section>
  );
}
