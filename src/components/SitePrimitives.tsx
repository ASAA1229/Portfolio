import { Link } from "@tanstack/react-router";
import { ArrowRight, Download, Github, Linkedin } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CONTACT } from "@/lib/portfolio-data";
import { usePublishedProfileResume } from "@/lib/published-resume";
import { ProjectVisual } from "@/components/ProjectVisual";
import { siteProjects } from "@/lib/site-data";

export function SocialLinks({
  github = CONTACT.github,
  linkedin = CONTACT.linkedin,
}: {
  github?: string | null;
  linkedin?: string | null;
} = {}) {
  const socials = [
    { url: github, Icon: Github, label: "GitHub" },
    { url: linkedin, Icon: Linkedin, label: "LinkedIn" },
  ];
  return (
    <div className="flex gap-2">
      {socials.map(({ url, Icon, label }) =>
        url ? (
          <Button key={label} asChild variant="outline" size="icon" className="min-h-11 min-w-11">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
            >
              <Icon />
            </a>
          </Button>
        ) : null,
      )}
    </div>
  );
}
export function ResumeAction({ profileId = "abhishek" }: { profileId?: string } = {}) {
  const publishedResume = usePublishedProfileResume(profileId);
  if (publishedResume) {
    return (
      <Button asChild className="min-h-11">
        <a href={`/api/published-resumes/${encodeURIComponent(publishedResume.id)}`} download>
          <Download /> Download resume
        </a>
      </Button>
    );
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          <Download /> Resume
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Resume & professional background</DialogTitle>
        <DialogDescription>A downloadable resume has not been published for this profile.</DialogDescription>
        <p className="text-sm leading-7">
          B.Tech in Information Technology · TKR College of Engineering & Technology · 2022–2026.
          Professional background and contact details are available in the profile.
        </p>
        <Button asChild>
          <a href={`mailto:${CONTACT.email}?subject=Request%20for%20resume`}>
            Request resume by email <ArrowRight />
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link to="/about">Read full bio</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
export function PageHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-12 border-b border-border pb-10">
      <p className="mb-4 font-mono text-xs text-violet">{number} / THE PORTFOLIO</p>
      <h1 className="page-title">{title}</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>
    </header>
  );
}
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="site-container py-12 sm:py-16">{children}</div>;
}
export function ProjectCard({ project }: { project: (typeof siteProjects)[number] }) {
  return (
    <article className="project-card group">
      <ProjectVisual index={project.index === 3 ? 2 : project.index} />
      <div className="px-5 pb-6">
        <p className="mb-3 text-xs text-violet">{project.badge}</p>
        <h3 className="min-h-16 text-2xl font-semibold">
          <Link
            to="/projects/$slug"
            params={{ slug: project.slug }}
            className="transition-colors hover:text-violet"
          >
            {project.title}
          </Link>
        </h3>
        <p className="mt-3 min-h-24 text-xs leading-6 text-muted-foreground">{project.overview}</p>
        <Tags items={project.tech} />
        <Button asChild variant="bare" className="mt-5 px-0">
          <Link to="/projects/$slug" params={{ slug: project.slug }}>
            Explore project <ArrowRight />
          </Link>
        </Button>
      </div>
    </article>
  );
}
export function Tags({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="border-l border-violet/50 bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
