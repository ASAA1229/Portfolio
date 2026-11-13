import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  DatabaseBackup,
  FileText,
  History,
  ImagePlus,
  LayoutList,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { AdminNavigation } from "@/components/AdminNavigation";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Private Portfolio Admin" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AdminHome,
});

const PROFILES = [
  { id: "abhishek", label: "Abhishek", route: "/" },
  { id: "ammu", label: "Amulya (Ammu)", route: "/people/ammu" },
  { id: "bava", label: "Anjini (Bava)", route: "/people/bava" },
  { id: "sai", label: "Sai (Darling)", route: "/people/sai" },
] as const;

const TOOLS = [
  {
    to: "/admin/content",
    title: "Content manager",
    description:
      "Edit profile facts, projects, skills, experience, education, contact, SEO and appearance.",
    Icon: LayoutList,
  },
  {
    to: "/admin/resumes",
    title: "Resume manager",
    description:
      "Upload private source documents, review extracted details and publish approved fields.",
    Icon: FileText,
  },
  {
    to: "/admin/images",
    title: "Image manager",
    description: "Manage profile portraits and gallery assets with explicit publish controls.",
    Icon: ImagePlus,
  },
  {
    to: "/admin/personas",
    title: "AI persona manager",
    description: "Configure profile-isolated assistant names, tone and owner-approved knowledge.",
    Icon: Bot,
  },
  {
    to: "/admin/backup",
    title: "Backup & restore",
    description: "Export, validate, restore or migrate private admin documents and binary assets.",
    Icon: DatabaseBackup,
  },
  {
    to: "/admin/audit",
    title: "Audit history",
    description: "Review owner actions, affected record identifiers and operation outcomes.",
    Icon: History,
  },
] as const;

type ResumeRecord = { id: string; profileId?: string; status: "pending" | "approved" };
type ImageRecord = { id: string; profileId: string; status: "pending" | "approved" };
type VersionedDocument = {
  publishedVersion: number | null;
  draft: { updatedAt: string } | null;
  history: { version: number; publishedAt: string }[];
};
type AuditEntry = {
  id: string;
  at: string;
  action: string;
  targets: string[];
  outcome: string;
  status: string;
};
type DashboardData = {
  resumes: ResumeRecord[];
  images: ImageRecord[];
  content: Record<string, VersionedDocument | null>;
  personas: Record<string, VersionedDocument | null>;
  storageAvailable: boolean;
  storageMode: string;
  audit: AuditEntry[];
  unavailable: string[];
};

async function readJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !payload) throw new Error(payload?.error ?? `Request failed: ${path}`);
  return payload;
}

function AdminHome() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");

  const load = useCallback(async (signal: AbortSignal) => {
    setBusy(true);
    setError("");
    const profileRequests = PROFILES.flatMap((profile) => [
      readJson<{ document: VersionedDocument }>(
        `/api/admin/content?profileId=${profile.id}`,
        signal,
      ),
      readJson<{ persona: VersionedDocument }>(
        `/api/admin/personas?profileId=${profile.id}`,
        signal,
      ),
    ]);
    const results = await Promise.allSettled([
      readJson<{ resumes: ResumeRecord[] }>("/api/admin/resumes", signal),
      readJson<{ images: ImageRecord[] }>("/api/admin/images", signal),
      readJson<{ available?: string[] }>("/api/admin/storage", signal),
      readJson<{ entries: AuditEntry[] }>("/api/admin/audit", signal),
      ...profileRequests,
    ]);
    if (signal.aborted) return;
    const unavailable: string[] = [];
    const take = <T,>(index: number, label: string): T | null => {
      const result = results[index];
      if (result?.status === "fulfilled") return result.value as T;
      unavailable.push(label);
      return null;
    };
    const resumePayload = take<{ resumes: ResumeRecord[] }>(0, "Resume inventory");
    const imagePayload = take<{ images: ImageRecord[] }>(1, "Image inventory");
    const storagePayload = take<{ available?: string[] }>(2, "Storage status");
    const auditPayload = take<{ entries: AuditEntry[] }>(3, "Audit history");
    const content: Record<string, VersionedDocument | null> = {};
    const personas: Record<string, VersionedDocument | null> = {};
    PROFILES.forEach((profile, index) => {
      content[profile.id] =
        take<{ document: VersionedDocument }>(4 + index * 2, `${profile.label} content`)
          ?.document ?? null;
      personas[profile.id] =
        take<{ persona: VersionedDocument }>(5 + index * 2, `${profile.label} AI persona`)
          ?.persona ?? null;
    });
    setData({
      resumes: resumePayload?.resumes ?? [],
      images: imagePayload?.images ?? [],
      content,
      personas,
      storageAvailable: Boolean(storagePayload?.available?.length),
      storageMode: storagePayload?.available?.join(", ") ?? "No adapter reported",
      audit: auditPayload?.entries?.slice(0, 6) ?? [],
      unavailable,
    });
    if (unavailable.length === results.length) {
      setError(
        "Admin services could not be loaded. Refresh the page or check private storage configuration.",
      );
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function signOut(everywhere: boolean) {
    if (
      everywhere &&
      !window.confirm("End every admin session on every device, including this one?")
    )
      return;
    setSessionMessage("");
    setBusy(true);
    const response = await fetch(everywhere ? "/api/admin/logout-all" : "/api/admin/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) window.location.assign("/admin/login");
    else setSessionMessage("Sign-out failed. Your session is unchanged; try again.");
  }

  const pendingResumes = data?.resumes.filter((item) => item.status === "pending").length ?? 0;
  const approvedResumes = data?.resumes.filter((item) => item.status === "approved").length ?? 0;
  const pendingImages = data?.images.filter((item) => item.status === "pending").length ?? 0;
  const publishedImages = data?.images.filter((item) => item.status === "approved").length ?? 0;
  const draftCount = Object.values(data?.content ?? {}).filter((item) => item?.draft).length;
  const personaDraftCount = Object.values(data?.personas ?? {}).filter(
    (item) => item?.draft,
  ).length;

  return (
    <main className="site-container max-w-6xl py-8 sm:py-12">
      <AdminNavigation current="/admin" />
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
            Private workspace · owner access
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Portfolio control room</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Manage the four public identities, approve content and media, control AI personas, and
            protect every change with version history and backups.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const controller = new AbortController();
              void load(controller.signal);
            }}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded border border-border px-3 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
            Refresh status
          </button>
          <button
            type="button"
            onClick={() => void signOut(false)}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded border border-border px-3 text-sm disabled:opacity-50"
          >
            <LogOut className="size-4" /> Sign out
          </button>
          <button
            type="button"
            onClick={() => void signOut(true)}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded border border-red-400/40 px-3 text-sm text-red-300 disabled:opacity-50"
          >
            <LogOut className="size-4" /> Sign out everywhere
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-6 rounded border border-red-400/40 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {sessionMessage && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {sessionMessage}
        </p>
      )}
      {data?.unavailable.length ? (
        <p
          role="status"
          className="mt-4 rounded border border-amber-400/30 p-3 text-sm text-amber-200"
        >
          Some status sources are unavailable: {data.unavailable.join(", ")}. Counts below may be
          incomplete.
        </p>
      ) : null}

      <section
        aria-label="Portfolio operations"
        className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Metric
          label="Pending resume reviews"
          value={pendingResumes}
          detail={`${approvedResumes} approved source documents`}
        />
        <Metric
          label="Pending image reviews"
          value={pendingImages}
          detail={`${publishedImages} published images`}
        />
        <Metric label="Content drafts" value={draftCount} detail="Across four profiles" />
        <Metric
          label="AI persona drafts"
          value={personaDraftCount}
          detail="Across four profile assistants"
        />
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Profile operations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Content, AI persona, resume and image status for each identity.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="size-4" /> {busy ? "Refreshing…" : "Latest available status"}
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {PROFILES.map((profile) => {
            const contentDoc = data?.content[profile.id];
            const personaDoc = data?.personas[profile.id];
            const resumes = data?.resumes.filter((item) => item.profileId === profile.id) ?? [];
            const images = data?.images.filter((item) => item.profileId === profile.id) ?? [];
            return (
              <article key={profile.id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{profile.label}</h3>
                  <a
                    href={profile.route}
                    className="text-xs text-primary underline underline-offset-4"
                  >
                    View public profile
                  </a>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Status
                    label="Content"
                    value={
                      contentDoc?.publishedVersion
                        ? `v${contentDoc.publishedVersion} published`
                        : "Curated default"
                    }
                    pending={Boolean(contentDoc?.draft)}
                  />
                  <Status
                    label="AI persona"
                    value={
                      personaDoc?.publishedVersion
                        ? `v${personaDoc.publishedVersion} published`
                        : "Default assistant"
                    }
                    pending={Boolean(personaDoc?.draft)}
                  />
                  <Status
                    label="Resumes"
                    value={`${resumes.length} total · ${resumes.filter((item) => item.status === "approved").length} approved`}
                    pending={resumes.some((item) => item.status === "pending")}
                  />
                  <Status
                    label="Images"
                    value={`${images.length} total · ${images.filter((item) => item.status === "approved").length} published`}
                    pending={images.some((item) => item.status === "pending")}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Link
                    to="/admin/content"
                    className="rounded border border-border px-2 py-1.5 hover:border-primary"
                  >
                    Edit content
                  </Link>
                  <Link
                    to="/admin/personas"
                    className="rounded border border-border px-2 py-1.5 hover:border-primary"
                  >
                    Edit AI persona
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Storage readiness</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {data?.storageAvailable
              ? `Private admin storage is reachable (${data.storageMode}).`
              : data
                ? "No private storage adapter is available. Publishing and backup operations are unavailable."
                : "Checking private storage…"}
          </p>
          <Link
            to="/admin/backup"
            className="mt-4 inline-flex min-h-10 items-center text-sm text-primary underline underline-offset-4"
          >
            Open backup & restore
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent admin activity</h2>
            <Link to="/admin/audit" className="text-xs text-primary underline underline-offset-4">
              Full audit log
            </Link>
          </div>
          {data?.audit.length ? (
            <ol className="mt-3 divide-y divide-border">
              {data.audit.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{entry.action}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.targets.join(", ") || "No record identifiers"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{entry.outcome}</p>
                    <p className="mt-1">{new Date(entry.at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No activity entries are available yet.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Admin tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a focused workspace to make and publish changes.
        </p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ to, title, description, Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon className="size-6 text-primary" aria-hidden="true" />
                <span className="font-semibold">{title}</span>
                <span className="text-sm leading-6 text-muted-foreground">{description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function Status({ label, value, pending }: { label: string; value: string; pending: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm">{value}</p>
      <p className={`mt-1 text-[11px] ${pending ? "text-amber-300" : "text-muted-foreground"}`}>
        {pending ? "Draft or review pending" : "No pending change"}
      </p>
    </div>
  );
}
