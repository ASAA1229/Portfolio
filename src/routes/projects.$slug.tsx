import { useAbhishekContent } from "@/lib/abhishek-content";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Github } from "lucide-react";
import { PageIntro } from "@/components/PageIntro";
import { ProjectVisual } from "@/components/ProjectVisual";
import { TechnologyList } from "@/components/TechLogo";
import { Button } from "@/components/ui/button";
import { getProject, PROJECT_PAGES } from "@/lib/project-pages";
import { LEGACY_PROJECT_SLUGS } from "@/lib/site-data";
import { seoHead } from "@/lib/seo-head";
import { usePublishedProjectImages } from "@/lib/published-resume";

export const Route = createFileRoute("/projects/$slug")({
  beforeLoad: ({ params }) => {
    const current = LEGACY_PROJECT_SLUGS[params.slug];
    if (current) {
      throw redirect({
        to: "/projects/$slug",
        params: { slug: current },
        replace: true,
        statusCode: 301,
      });
    }
    if (!getProject(params.slug)) throw notFound();
  },
  head: ({ params }) => {
    const project = getProject(params.slug);
    return seoHead({
      title: `${project?.title ?? "Project not found"} — Guda Abhishek`,
      description: project?.overview ?? "Project overview, approach, and technology details.",
      path: `/projects/${params.slug}`,
      noindex: !project,
    });
  },
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { slug } = Route.useParams();
  const projectImages = usePublishedProjectImages("abhishek", slug);
  const { overrides } = useAbhishekContent();
  const base = getProject(slug);
  // Owner CMS edits apply over the curated project page; archived hides it.
  const edit = overrides?.projects?.find((item) => item.slug === slug);
  if (!base || edit?.archived) return <ProjectArchived />;
  const project = edit
    ? {
        ...base,
        title: edit.title,
        overview: edit.overview,
        ...(edit.context ? { problem: edit.context } : {}),
        ...(edit.tech?.length ? { tech: edit.tech } : {}),
      }
    : base;
  const index = PROJECT_PAGES.findIndex((item) => item.slug === slug);
  return (
    <article className="page-content project-detail">
      <Button asChild variant="ghost" className="mb-8 min-h-11 px-0">
        <Link to="/projects">
          <ArrowLeft /> All projects
        </Link>
      </Button>
      <PageIntro
        eyebrow={`${project.category} · ${project.badge}`}
        title={project.title}
        description={project.overview}
      />
      {projectImages.length > 0 ? (
        <section className="mt-8 grid gap-4 sm:grid-cols-2" aria-label={`Images for ${project.title}`}>
          {projectImages.map((image) => (
            <figure key={image.id} className="overflow-hidden rounded-lg border border-white/10 bg-card">
              <img src={image.src} alt={image.alt} loading="lazy" className="aspect-video w-full object-cover" />
            </figure>
          ))}
        </section>
      ) : (
        <div className="project-detail-art">
          <ProjectVisual index={index} />
        </div>
      )}
      <div className="project-detail-grid">
        <section className="detail-copy">
          <p className="section-kicker">THE PROBLEM</p>
          <h2>Why this work matters</h2>
          <p>{project.problem}</p>
        </section>
        <section className="detail-copy">
          <p className="section-kicker">MY CONTRIBUTION</p>
          <h2>Approach & role</h2>
          <p>{project.role}</p>
        </section>
      </div>
      {project.flow.length > 0 && (
        <section className="detail-section">
          <p className="section-kicker">CONCEPTUAL WORKFLOW</p>
          <h2>From input to outcome</h2>
          <ol className="workflow-list">
            {project.flow.map((step, stepIndex) => (
              <li key={step}>
                <span>0{stepIndex + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="detail-section">
        <p className="section-kicker">TECHNOLOGY</p>
        <h2>Tools used</h2>
        <TechnologyList items={project.tech} />
      </section>
      <p className="mt-10 border-t border-white/10 pt-5 text-xs leading-6 text-muted-foreground">
        Repository, live demo, and implementation media are shown when verified project links or
        assets are available.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {project.github && (
          <Button asChild variant="outline" className="min-h-11">
            <a href={project.github} target="_blank" rel="noopener noreferrer">
              <Github /> Source <ArrowUpRight />
            </a>
          </Button>
        )}
        {project.demo && (
          <Button asChild className="min-h-11">
            <a href={project.demo} target="_blank" rel="noopener noreferrer">
              Live project <ArrowUpRight />
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

function ProjectArchived() {
  return (
    <article className="page-content">
      <PageIntro
        eyebrow="Projects"
        title="Project not available"
        description="This project is no longer part of the portfolio."
      />
      <Button asChild variant="ghost" className="min-h-11 px-0">
        <Link to="/projects">
          <ArrowLeft /> All projects
        </Link>
      </Button>
    </article>
  );
}
