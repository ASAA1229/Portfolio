import { createFileRoute } from "@tanstack/react-router";
import { Braces, BrainCircuit, Cloud, Code2, Database, Server, Workflow } from "lucide-react";
import { PageBody } from "@/components/SitePrimitives";
import { PublishedResumePanel } from "@/components/PublishedResumePanel";
import { usePublishedProfileResume } from "@/lib/published-resume";
import { Reveal } from "@/components/Reveal";
import { TechLogo } from "@/components/TechLogo";
import { useAbhishekContent } from "@/lib/abhishek-content";
import { pageHead } from "@/lib/site-data";
import constellation from "@/assets/developer-constellation.jpg";

export const Route = createFileRoute("/skills")({
  head: () =>
    pageHead(
      "Skills",
      "Guda Abhishek's languages, React and MERN engineering, databases, AI/ML, cloud and developer tools.",
      "/skills",
    ),
  component: Skills,
});


function Skills() {
  const publishedResume = usePublishedProfileResume("abhishek");
  const { skills: contentSkills } = useAbhishekContent();
  return (
    <>
      <section className="chapter-hero skills-hero">
        <img
          src={constellation}
          alt="Developer technology constellation artwork"
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="chapter-hero-shade" />
        <div className="site-container chapter-hero-copy">
          <Reveal>
            <p className="chapter-kicker">02 / THE TOOLKIT</p>
            <h1>
              A LIVING
              <br />
              <span>ECOSYSTEM.</span>
            </h1>
            <p className="chapter-lede">
              Languages, frameworks, and ideas connected by the work they help make possible.
            </p>
          </Reveal>
        </div>
        <span className="chapter-hero-index">TOOLS IN PRACTICE · NO SCORES, JUST WORK</span>
      </section>
      <PageBody>
        <PublishedResumePanel section="skills" resume={publishedResume} />
        {!publishedResume?.skills.length && (
          <>
            <div className="skills-intro">
              <p className="chapter-kicker">DEVELOPER CONSTELLATION</p>
              <h2>
                Every tool has a place
                <br />
                in the <span>system.</span>
              </h2>
              <p>
                Technologies represented across academic, personal, and professional work. Select a
                group to explore its parts.
              </p>
            </div>
            <div className="skill-constellation">
              <div className="constellation-art">
                <img src={constellation} alt="" loading="lazy" />
                <div className="constellation-core">
                  <Code2 />
                  <span>
                    BUILD
                    <br />
                    WITH INTENT
                  </span>
                </div>
                <span className="orbit orbit-one" />
                <span className="orbit orbit-two" />
              </div>
              <div className="skill-groups">
                {contentSkills.length === 0 ? (
                  <p role="status" className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
                    No skills have been published for this profile yet.
                  </p>
                ) : contentSkills.map((group, index) => {
                  const category = group.cat.toLowerCase();
                  const Icon = /data|database|sql/.test(category)
                    ? Database
                    : /cloud|devops|deploy/.test(category)
                      ? Cloud
                      : /ai|machine|intelligence/.test(category)
                        ? BrainCircuit
                        : /backend|api|server/.test(category)
                          ? Server
                          : /workflow|practice|method/.test(category)
                            ? Workflow
                            : /frontend|framework|web|interface/.test(category)
                              ? Braces
                              : Code2;
                  return (
                    <Reveal key={group.cat} delay={index * 0.04}>
                      <details className="skill-group" open={index === 0}>
                        <summary>
                          <span className="skill-group-icon">
                            <Icon />
                          </span>
                          <span>
                            <small>SECTOR {String(index + 1).padStart(2, "0")}</small>
                            <strong>{group.cat}</strong>
                            <em>{group.items.length} technologies</em>
                            <span className="block text-xs text-muted-foreground">{group.desc}</span>
                          </span>
                          <span className="skill-group-plus">+</span>
                        </summary>
                        <ul>
                          {group.items.map((item) => (
                            <li key={item}>
                              <TechLogo name={item} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
