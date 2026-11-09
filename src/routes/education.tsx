import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, GraduationCap, MapPin, CalendarDays } from "lucide-react";
import { PageBody } from "@/components/SitePrimitives";
import { PublishedResumePanel } from "@/components/PublishedResumePanel";
import { usePublishedProfileResume } from "@/lib/published-resume";
import { Reveal } from "@/components/Reveal";
import { pageHead } from "@/lib/site-data";
import { useAbhishekContent } from "@/lib/abhishek-content";

export const Route = createFileRoute("/education")({
  head: () =>
    pageHead(
      "Education",
      "Guda Abhishek's Bachelor of Technology in Information Technology at TKR College of Engineering & Technology.",
      "/education",
    ),
  component: Education,
});

function Education() {
  const publishedResume = usePublishedProfileResume("abhishek");
  // Precedence: published resume section → owner CMS record → curated record.
  const { education: cms } = useAbhishekContent();
  const record = {
    college: cms?.college || "TKR College of Engineering & Technology",
    qualification: cms?.qualification || "Bachelor of Technology (B.Tech) · Information Technology",
    period: cms?.period || "2022 – 2026",
    location: cms?.location || "Hyderabad, India",
    score: cms ? cms.score : "CGPA: 7.6",
  };
  return (
    <>
      <section className="chapter-hero experience-hero">
        <div className="experience-backdrop" />
        <div className="site-container chapter-hero-copy">
          <Reveal>
            <p className="chapter-kicker">06 / THE FOUNDATION</p>
            <h1>
              BUILT ON
              <br />
              <span>CURIOSITY.</span>
            </h1>
            <p className="chapter-lede">
              The academic foundation behind my journey in software engineering, information
              technology, and practical product development.
            </p>
            <a
              className="chapter-scroll"
              href={
                publishedResume?.structuredSections?.education?.length
                  ? "#education-published-resume"
                  : "#education-record"
              }
            >
              <ArrowDown /> Explore education
            </a>
          </Reveal>
        </div>
        <span className="chapter-hero-index">KNOWLEDGE · PRACTICE · PROGRESS</span>
      </section>
      <PageBody>
        <PublishedResumePanel section="education" resume={publishedResume} />
        {!publishedResume?.structuredSections?.education?.length && (
          <>
            <section id="education-record" className="career-timeline">
              <Reveal>
                <article className="career-chapter">
                  <div className="career-rail">
                    <span>ACADEMIC RECORD</span>
                    <i />
                  </div>
                  <div className="career-content">
                    <p className="chapter-kicker">{record.period}</p>
                    <h2>{record.college}</h2>
                    <p className="career-role">
                      <GraduationCap /> {record.qualification}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>
                        <CalendarDays className="mr-2 inline size-4" />
                        {record.period}
                      </span>
                      <span>
                        <MapPin className="mr-2 inline size-4" />
                        {record.location}
                      </span>
                    </div>
                    {record.score && (
                      <div className="mt-6 border-t border-border pt-5">
                        <p className="chapter-kicker">ACADEMIC HIGHLIGHT</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">
                          {record.score}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              </Reveal>
            </section>
          </>
        )}
      </PageBody>
    </>
  );
}
