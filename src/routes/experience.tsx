import { useAbhishekContent } from "@/lib/abhishek-content";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, BriefcaseBusiness, MapPin } from "lucide-react";
import { PageBody } from "@/components/SitePrimitives";
import { PublishedResumePanel } from "@/components/PublishedResumePanel";
import { usePublishedProfileResume } from "@/lib/published-resume";
import { Reveal } from "@/components/Reveal";
import { TechnologyList } from "@/components/TechLogo";
import { pageHead } from "@/lib/site-data";

export const Route = createFileRoute("/experience")({
  head: () =>
    pageHead(
      "Experience",
      "Guda Abhishek's frontend internship at Paves Technologies and AI interface internship at Bilvantis Technologies.",
      "/experience",
    ),
  component: Experience,
});
function Experience() {
  const publishedResume = usePublishedProfileResume("abhishek");
  const { missions } = useAbhishekContent();
  return (
    <>
      <section className="chapter-hero experience-hero">
        <div className="experience-backdrop" />
        <div className="site-container chapter-hero-copy">
          <Reveal>
            <p className="chapter-kicker">04 / PROFESSIONAL TIMELINE</p>
            <h1>
              LEARNING
              <br />
              <span>BY BUILDING.</span>
            </h1>
            <p className="chapter-lede">
              Two teams, different challenges, and a shared focus on making software work for
              people.
            </p>
            <a
              className="chapter-scroll"
              href={
                publishedResume?.structuredSections?.experience?.length
                  ? "#experience-published-resume"
                  : "#timeline"
              }
            >
              <ArrowDown /> Follow the timeline
            </a>
          </Reveal>
        </div>
        <span className="chapter-hero-index">WORK IN PROGRESS · WORK THAT SHIPS</span>
      </section>
      <PageBody>
        <PublishedResumePanel section="experience" resume={publishedResume} />
        {!publishedResume?.structuredSections?.experience?.length && (
          <>
            <section className="experience-summary">
              <p className="chapter-kicker">ON THE JOB</p>
              <p>
                Frontend engineering, API integration, AI product experiences, and close work with
                design, backend, and QA teams.
              </p>
            </section>
            <div id="timeline" className="career-timeline">
              {missions.length === 0 ? (
                <p
                  role="status"
                  className="rounded-lg border border-border p-6 text-sm text-muted-foreground"
                >
                  No experience entries have been published yet.
                </p>
              ) : (
                missions.map((job, i) => (
                  <Reveal key={job.id} delay={i * 0.08}>
                    <article className="career-chapter">
                      <div className="career-rail">
                        <span>EPISODE {job.id}</span>
                        <i />
                      </div>
                      <div className="career-content">
                        <header>
                          <div>
                            <p className="chapter-kicker">{job.period}</p>
                            <h2>{job.company}</h2>
                            <p className="career-role">
                              <BriefcaseBusiness /> {job.role}
                            </p>
                          </div>
                          {job.location && (
                            <span className="career-location">
                              <MapPin />
                              {job.location}
                            </span>
                          )}
                        </header>
                        {job.projects.map((project) => (
                          <section key={project.name} className="career-project">
                            <h3>{project.name}</h3>
                            <ul>
                              {project.points.map((point) => (
                                <li key={point}>{point}</li>
                              ))}
                            </ul>
                          </section>
                        ))}
                        <TechnologyList items={job.tags} />
                      </div>
                    </article>
                  </Reveal>
                ))
              )}
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
