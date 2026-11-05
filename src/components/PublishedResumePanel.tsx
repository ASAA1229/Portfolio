import { usePublishedProfileResume } from "@/lib/published-resume";
import { Award, BriefcaseBusiness, Code2, GraduationCap, FolderKanban } from "lucide-react";
import { TechnologyList } from "@/components/TechLogo";

type ResumeSection = "skills" | "projects" | "experience" | "certifications" | "education";

const sectionMeta = {
  skills: { title: "Skills from published resume", icon: Code2 },
  projects: { title: "Projects from published resume", icon: FolderKanban },
  experience: { title: "Experience from published resume", icon: BriefcaseBusiness },
  certifications: { title: "Certifications from published resume", icon: Award },
  education: { title: "Education from published resume", icon: GraduationCap },
} satisfies Record<ResumeSection, { title: string; icon: typeof Code2 }>;

export function PublishedResumePanel({
  profileId,
  section,
}: {
  profileId: string;
  section: ResumeSection;
}) {
  const resume = usePublishedProfileResume(profileId);
  if (!resume) return null;

  const Icon = sectionMeta[section].icon;
  const entries = section === "skills" ? [] : resume.structuredSections?.[section] ?? [];
  const hasContent = section === "skills" ? resume.skills.length > 0 : entries.length > 0;
  if (!hasContent) return null;

  return (
    <section className="mb-10 rounded-lg border border-primary/30 bg-card p-6" aria-label={sectionMeta[section].title}>
      <p className="font-mono text-xs text-primary">LATEST PUBLISHED RESUME · {resume.displayName}</p>
      <h2 className="mt-3 flex items-center gap-3 text-2xl"><Icon className="size-6 text-primary" />{sectionMeta[section].title}</h2>
      {section === "skills" ? (
        <div className="mt-5"><TechnologyList items={resume.skills} /></div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {entries.map((entry, index) => (
            <article key={index} className="rounded-md border border-border p-4">
              <p className="mb-2 font-mono text-[10px] text-primary">{section.toUpperCase()} / {String(index + 1).padStart(2, "0")}</p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{entry}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
