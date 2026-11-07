import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, FileText, ImagePlus } from "lucide-react";

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
] as const;

function AdminHome() {
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
    </main>
  );
}
