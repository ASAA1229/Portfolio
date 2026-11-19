import type {
  ResumeSectionEntry,
  ResumeSectionName,
  StructuredResumeEntry,
} from "@/lib/resume-types";

function dateRange(entry: StructuredResumeEntry): string {
  return [entry.startDate, entry.endDate].filter(Boolean).join(" — ");
}

export function ResumeEntryCard({
  entry,
  section,
  index,
  compact = false,
}: {
  entry: ResumeSectionEntry;
  section: ResumeSectionName;
  index: number;
  compact?: boolean;
}) {
  if (typeof entry === "string") {
    return (
      <article className="rounded-lg border border-border bg-card p-5">
        <p className="mb-2 font-mono text-[10px] text-primary">
          {section.toUpperCase()} / {String(index + 1).padStart(2, "0")}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{entry}</p>
      </article>
    );
  }

  const heading =
    section === "experience"
      ? entry.role || entry.title
      : section === "certifications" || section === "education" || section === "projects"
        ? entry.title || entry.role
        : entry.title || entry.role;
  const subheading =
    section === "experience"
      ? entry.organization
      : section === "education" || section === "certifications"
        ? entry.organization
        : entry.role;
  const period = dateRange(entry);
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <p className="mb-3 font-mono text-[10px] text-primary">
        {section.toUpperCase()} / {String(index + 1).padStart(2, "0")}
      </p>
      {heading && (
        <h3 className={compact ? "text-lg font-semibold" : "text-xl font-semibold"}>{heading}</h3>
      )}
      {subheading && <p className="mt-2 text-sm text-foreground/80">{subheading}</p>}
      {(period || entry.location) && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {[period, entry.location].filter(Boolean).join(" · ")}
        </p>
      )}
      {entry.grade && <p className="mt-2 text-xs text-primary">{entry.grade}</p>}
      {entry.description && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
          {entry.description}
        </p>
      )}
      {!!entry.technologies?.length && (
        <div className="mt-4 flex flex-wrap gap-2">
          {entry.technologies.map((technology) => (
            <span
              key={technology}
              className="border border-border px-2 py-1 text-[11px] text-muted-foreground"
            >
              {technology}
            </span>
          ))}
        </div>
      )}
      {entry.credentialId && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          Credential ID: {entry.credentialId}
        </p>
      )}
      {entry.url && /^https:\/\//i.test(entry.url) && (
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-6 items-center break-all text-xs text-primary underline underline-offset-4"
        >
          {section === "certifications" ? "Verify credential" : "Open project"}
        </a>
      )}
    </article>
  );
}
