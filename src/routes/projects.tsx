import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageBody } from "@/components/SitePrimitives";
import { PublishedResumePanel } from "@/components/PublishedResumePanel";
import { usePublishedProfileResume } from "@/lib/published-resume";
import { Reveal } from "@/components/Reveal";
import { ProjectVisual } from "@/components/ProjectVisual";
import { TechnologyList } from "@/components/TechLogo";
import { PROJECT_PAGES } from "@/lib/project-pages";
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
function Projects() {
  const publishedResume = usePublishedProfileResume("abhishek");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/projects" && pathname !== "/projects/") return <Outlet />;
  const featured = PROJECT_PAGES[0];
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
            <Link to="/projects/$slug" params={{ slug: featured!.slug }} className="chapter-cta">
              Featured work <ArrowUpRight />
            </Link>
          </Reveal>
        </div>
        <span className="chapter-hero-index">SELECTED WORK · 2023—PRESENT</span>
      </section>
      <PageBody>
        <PublishedResumePanel section="projects" resume={publishedResume} />
        {!publishedResume?.structuredSections?.projects?.length && (
          <>
        <section className="featured-project">
          <div className="featured-project-art">
            <ProjectVisual index={0} />
            <span>FEATURED PRODUCTION · 01</span>
          </div>
          <div className="featured-project-copy">
            <p className="chapter-kicker">{featured!.badge}</p>
            <h2>{featured!.title}</h2>
            <p>{featured!.overview}</p>
            <Link to="/projects/$slug" params={{ slug: featured!.slug }}>
              Explore the case study <ArrowUpRight />
            </Link>
          </div>
        </section>
        <div className="chapter-section-heading projects-list-heading">
          <div>
            <p className="chapter-kicker">MORE STORIES</p>
            <h2>Other work in the series.</h2>
          </div>
          <span>0{PROJECT_PAGES.length} PROJECTS</span>
        </div>
        <div className="project-showcase">
          {PROJECT_PAGES.slice(1).map((project, i) => (
            <Reveal key={project.slug} delay={i * 0.05}>
              <Link
                to="/projects/$slug"
                params={{ slug: project.slug }}
                className="showcase-project"
              >
                <div className={`showcase-art showcase-art-${i}`}>
                  <ProjectVisual index={i + 1} />
                  <span>{project.category}</span>
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
          ))}
        </div>
        <p className="mt-8 max-w-3xl text-xs leading-6 text-muted-foreground">
          Project descriptions reflect documented scope and contributions. Repository, live demo,
          and implementation media appear when verified links or assets are available.
        </p>
          </>
        )}
      </PageBody>
    </>
  );
}
