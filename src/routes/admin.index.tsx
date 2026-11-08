import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  FileText,
  History,
  ImagePlus,
  DatabaseBackup,
  LayoutList,
  LogOut,
} from "lucide-react";

// Private admin landing page. The server applies the same admin authorization
// to /admin as to every /admin/* route; this page only links to the managers.
export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Private Portfolio Admin" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AdminHome,
});

const TOOLS = [
  {
    to: "/admin/resumes",
    title: "Resume Manager",
    description: "Upload a PDF or DOCX for a profile, review extracted sections, then publish.",
    Icon: FileText,
  },
  {
    to: "/admin/images",
    title: "Image Manager",
    description: "Upload portraits and gallery photos privately, then publish or unpublish them.",
    Icon: ImagePlus,
  },
  {
    to: "/admin/personas",
    title: "AI Persona Manager",
    description:
      "Set each profile's assistant name, tone and approved notes; draft, publish and roll back.",
    Icon: Bot,
  },
  {
    to: "/admin/content",
    title: "Content Manager",
    description:
      "Edit profile basics, projects, experience, education, certifications, SEO and navigation labels with version history.",
    Icon: LayoutList,
  },
  {
    to: "/admin/backup",
    title: "Backup & Restore",
    description:
      "Download or restore all admin data, including resume and image files, or migrate storage.",
    Icon: DatabaseBackup,
  },
  {
    to: "/admin/audit",
    title: "Audit History",
    description: "Every admin change with time, action, affected ids and outcome.",
    Icon: History,
  },
] as const;

async function postAdmin(path: string): Promise<boolean> {
  const response = await fetch(path, { method: "POST", credentials: "same-origin" }).catch(
    () => null,
  );
  return Boolean(response?.ok);
}

function AdminHome() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function signOut(everywhere: boolean) {
    if (
      everywhere &&
      !window.confirm("End every admin session on every device, including this one?")
    ) {
      return;
    }
    setBusy(true);
    setStatus("");
    const ok = await postAdmin(everywhere ? "/api/admin/logout-all" : "/api/admin/logout");
    setBusy(false);
    if (ok) window.location.assign("/admin/login");
    else setStatus("Sign-out failed. Your session is unchanged; try again.");
  }

  return (
    <main className="site-container max-w-5xl py-10 sm:py-14">
      <p className="font-mono text-xs text-primary">CONTENT WORKFLOW · PRIVATE</p>
      <h1 className="mt-3 text-4xl font-semibold">Portfolio Admin</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Manage resume and image updates for every profile. Uploads stay private until you publish
        them.
      </p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2">
        {TOOLS.map(({ to, title, description, Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary focus-visible:border-primary"
            >
              <Icon className="size-6 text-primary" aria-hidden="true" />
              <span className="text-xl font-semibold">{title}</span>
              <span className="text-sm leading-6 text-muted-foreground">{description}</span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="mt-10 flex flex-wrap items-center gap-3" aria-label="Session">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 disabled:opacity-50"
          disabled={busy}
          onClick={() => void signOut(false)}
        >
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded border border-red-400/40 px-4 text-red-200 disabled:opacity-50"
          disabled={busy}
          onClick={() => void signOut(true)}
        >
          <LogOut className="size-4" aria-hidden="true" /> Sign out everywhere
        </button>
        {status && (
          <p role="alert" className="text-sm text-red-300">
            {status}
          </p>
        )}
      </section>
    </main>
  );
}
