import { Link } from "@tanstack/react-router";

const ITEMS = [
  { to: "/admin/", label: "Overview" },
  { to: "/admin/content", label: "Content" },
  { to: "/admin/personas", label: "AI personas" },
  { to: "/admin/resumes", label: "Resumes" },
  { to: "/admin/images", label: "Images" },
  { to: "/admin/backup", label: "Backup & restore" },
  { to: "/admin/audit", label: "Audit log" },
] as const;

type AdminDestination = (typeof ITEMS)[number]["to"];

export function AdminNavigation({ current }: { current: AdminDestination }) {
  return (
    <nav aria-label="Admin workspace" className="mb-8 rounded-lg border border-border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
        <Link to="/admin/" className="font-semibold tracking-wide hover:text-primary">
          Portfolio Admin
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Owner workspace
        </span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const active = item.to === current;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded border px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
