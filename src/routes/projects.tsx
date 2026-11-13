import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageBody } from "@/components/SitePrimitives";
import { PublishedResumePanel } from "@/components/PublishedResumePanel";
import { usePublishedProfileResume, usePublishedProjectImages } from "@/lib/published-resume";
import { Reveal } from "@/components/Reveal";
import { ProjectVisual } from "@/components/ProjectVisual";
import { TechnologyList } from "@/components/TechLogo";
import { PROJECT_PAGES } from "@/lib/project-pages";
import { useAbhishekContent } from "@/lib/abhishek-content";
import { pageHead } from "@/lib/site-data";
import billboard from "@/assets/series-billboard.jpg";

export const Route = createFileRoute("/projects")({
  head: () =>
    pageHead(
      "Projects",
      "Selected full-stack, AI, IoT, and interface projects by Guda Abhishek.",
      "/projects",
    ),
  component: Projects,
});

function ShowcaseProject({
  project,
  index,
}: {
  project: (typeof PROJECT_PAGES)[number];
  index: number;
}) {
  const cover = usePublishedProjectImages("abhishek", project.slug)[0];
  return (
    <Reveal delay={index * 0.05}>
      <Link to="/projects/$slug" params={{ slug: project.slug }} className="showcase-project">
        <div className={`showcase-art showcase-art-${index} relative overflow-hidden`}>
          {cover ? (
            <img
              src={cover.src}
              alt={cover.alt}
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <ProjectVisual index={index + 1} />
          )}
          <span className="relative z-10">{project.category}</span>
        </div>
        <div className="showcase-copy">
          <p>{project.badge}</p>
          <h3>{project.title}</h3>
          <span>{project.overview}</span>
          <TechnologyList items={project.tech} />
          <ArrowUpRight className="showcase-arrow" />
        </div>
      </Link>
    </Reveal>
  );
}

function Projects() {
  const publishedResume = usePublishedProfileResume("abhishek");
  const content = useAbhishekContent();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const projectPages = content.projects.map((project, index) => {
    const base = PROJECT_PAGES.find((item) => item.slug === project.slug);
    return {
      ...project,
      category: base?.category ?? "Owner published",
      github: base?.github ?? null,
      demo: base?.demo ?? null,
      index,
    };
  }) as Array<(typeof PROJECT_PAGES)[number]>;
  const featured = projectPages[0];
  const featuredCover = usePublishedProjectImages("abhishek", featured?.slug ?? "__none__")[0];
  if (pathname !== "/projects" && pathname !== "/projects/") return <Outlet />;
  return (
    <>
      <section className="chapter-hero projects-hero">
        <img
          src={billboard}
          alt="Abhishek: The Series cinematic portfolio billboard"
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="chapter-hero-shade" />
        <div className="site-container chapter-hero-copy">
          <Reveal>
            <p className="chapter-kicker">03 / ORIGINAL PRODUCTIONS</p>
            <h1>
              BUILT FROM
              <br />
              <span>AN IDEA.</span>
            </h1>
            <p className="chapter-lede">
              Product thinking, engineering, and a willingness to work through the hard parts.
            </p>
            {publishedResume?.structuredSections?.projects?.length ? (
              <a href="#projects-published-resume" className="chapter-cta">
                Published projects <ArrowUpRight />
              </a>
            ) : featured ? (
              <Link to="/projects/$slug" params={{ slug: featured.slug }} className="chapter-cta">
                Featured work <ArrowUpRight />
              </Link>
            ) : null}
          </Reveal>
        </div>
        <span className="chapter-hero-index">SELECTED WORK · 2023—PRESENT</span>
      </section>
      <PageBody>
        <PublishedResumePanel section="projects" resume={publishedResume} />
        {!publishedResume?.structuredSections?.projects?.length && (
          <>
            {featured && (
              <section className="featured-project">
                <div className="featured-project-art relative overflow-hidden">
                  {featuredCover ? (
                    <img
                      src={featuredCover.src}
                      alt={featuredCover.alt}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    <ProjectVisual index={0} />
                  )}
                  <span className="relative z-10">FEATURED PRODUCTION · 01</span>
                </div>
                <div className="featured-project-copy">
                  <p className="chapter-kicker">{featured!.badge}</p>
                  <h2>{featured!.title}</h2>
                  <p>{featured!.overview}</p>
                  <Link to="/projects/$slug" params={{ slug: featured.slug }}>
                    Explore the case study <ArrowUpRight />
                  </Link>
                </div>
              </section>
            )}
            <div className="chapter-section-heading projects-list-heading">
              <div>
                <p className="chapter-kicker">MORE STORIES</p>
                <h2>Other work in the series.</h2>
              </div>
              <span>{String(projectPages.length).padStart(2, "0")} PROJECTS</span>
            </div>
            <div className="project-showcase">
              {projectPages.length === 0 ? (
                <p
                  role="status"
                  className="rounded-lg border border-border p-6 text-sm text-muted-foreground"
                >
                  No projects have been published yet.
                </p>
              ) : (
                projectPages
                  .slice(1)
                  .map((project, i) => (
                    <ShowcaseProject key={project.slug} project={project} index={i} />
                  ))
              )}
            </div>
            <p className="mt-8 max-w-3xl text-xs leading-6 text-muted-foreground">
              Project descriptions reflect documented scope and contributions. Repository, live
              demo, and implementation media appear when verified links or assets are available.
            </p>
          </>
        )}
      </PageBody>
    </>
  );
}
