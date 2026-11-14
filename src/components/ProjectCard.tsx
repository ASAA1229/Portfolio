import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { ProjectVisual } from "@/components/ProjectVisual";
import type { PROJECT_PAGES } from "@/lib/project-pages";
import { usePublishedProjectImages } from "@/lib/published-resume";

type ProjectPage = (typeof PROJECT_PAGES)[number];

export function ProjectCard({ project, index }: { project: ProjectPage; index: number }) {
  const cover = usePublishedProjectImages("abhishek", project.slug)[0];
  return (
    <Reveal delay={index * 0.06} className="h-full">
      <Link
        to="/projects/$slug"
        params={{ slug: project.slug }}
        className="project-tile group block h-full overflow-hidden rounded-xl border border-white/10 bg-card/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-violet focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <div className="project-art relative overflow-hidden">
          {cover ? (
            <img
              src={cover.src}
              alt={cover.alt}
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <ProjectVisual index={index} />
          )}
          <span className="project-category relative z-10">{project.category}</span>
        </div>
        <div className="flex min-h-48 flex-col p-5 sm:p-6">
          <p className="text-[10px] uppercase tracking-[0.16em] text-primary">{project.badge}</p>
          <h3 className="mt-3 font-display text-2xl font-semibold leading-tight transition-colors group-hover:text-primary sm:text-3xl">
            {project.title}
          </h3>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {project.overview}
          </p>
          <div className="mt-auto flex items-end justify-between gap-4 pt-6">
            <div className="flex flex-wrap gap-1.5">
              {project.tech.slice(0, 3).map((tech) => (
                <span key={tech} className="tech-chip">
                  {tech}
                </span>
              ))}
            </div>
            <ArrowUpRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </Link>
    </Reveal>
  );
}
