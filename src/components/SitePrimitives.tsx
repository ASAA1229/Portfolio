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
import { usePublishedProfileResume, usePublishedProjectImages } from "@/lib/published-resume";
import { getLocalResumeOptions } from "@/lib/local-resumes";
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
  const localResumes = getLocalResumeOptions(profileId);
  const newestLocalResume = localResumes[0];
  const defaultResumeUrl =
    newestLocalResume?.url ??
    (publishedResume
      ? `/api/published-resumes/${encodeURIComponent(publishedResume.id)}`
      : undefined);

  if (defaultResumeUrl) {
    return (
      <div className="flex flex-wrap gap-3">
        <Button asChild className="min-h-11">
          <a href={defaultResumeUrl} download={newestLocalResume ? newestLocalResume.name : true}>
            <Download /> Download resume
          </a>
        </Button>
        {localResumes.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="min-h-11">
                View versions
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Resume versions</DialogTitle>
              <DialogDescription>
                Choose a version to view or download. Date-prefixed local files appear newest first.
              </DialogDescription>
              <ul className="mt-4 grid gap-4">
                {localResumes.map((resume) => (
                  <li
                    key={resume.url}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
                  >
                    <span className="break-all text-sm">{resume.name}</span>
                    <div className="flex gap-3 text-sm">
                      <a
                        href={resume.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4"
                      >
                        View
                      </a>
                      <a
                        href={resume.url}
                        download={resume.name}
                        className="underline underline-offset-4"
                      >
                        Download
                      </a>
                    </div>
                  </li>
                ))}
                {publishedResume && (
                  <li className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="text-sm">
                      {publishedResume.displayName} · Published resume
                    </span>
                    <div className="flex gap-3 text-sm">
                      <a
                        href={`/api/published-resumes/${encodeURIComponent(publishedResume.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4"
                      >
                        View
                      </a>
                      <a
                        href={`/api/published-resumes/${encodeURIComponent(publishedResume.id)}`}
                        download
                        className="underline underline-offset-4"
                      >
                        Download
                      </a>
                    </div>
                  </li>
                )}
              </ul>
            </DialogContent>
          </Dialog>
        )}
      </div>
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
        <DialogDescription>
          No resume file has been added or published for this profile yet.
        </DialogDescription>
        <p className="text-sm leading-7">
          Add a PDF, DOC, or DOCX file to this profile&apos;s folder under src/assets/resumes/, or
          publish a resume in Admin.
        </p>
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
  const cover = usePublishedProjectImages("abhishek", project.slug)[0];
  return (
    <article className="project-card group">
      {cover ? (
        <img
          src={cover.src}
          alt={cover.alt}
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      ) : (
        <ProjectVisual index={project.index === 3 ? 2 : project.index} />
      )}
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
