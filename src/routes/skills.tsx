import { createFileRoute } from "@tanstack/react-router";
import { Braces, BrainCircuit, Cloud, Code2, Database, Server, Workflow } from "lucide-react";
import { PageBody } from "@/components/SitePrimitives";
import { PublishedResumePanel } from "@/components/PublishedResumePanel";
import { usePublishedProfileResume } from "@/lib/published-resume";
import { Reveal } from "@/components/Reveal";
import { TechLogo } from "@/components/TechLogo";
import { SKILLS } from "@/lib/portfolio-data";
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

const groups = [
  { title: "Languages", icon: Code2, cats: ["Programming Languages"] },
  {
    title: "Frontend",
    icon: Braces,
    cats: ["Frontend & Frameworks"],
    picks: ["React.js", "HTML5", "CSS3", "Tailwind CSS"],
  },
  {
    title: "Backend & APIs",
    icon: Server,
    cats: ["Frontend & Frameworks"],
    picks: ["Node.js", "Express.js", "REST APIs", "MERN Stack"],
  },
  { title: "Databases", icon: Database, cats: ["Databases"] },
  {
    title: "AI & machine learning",
    icon: BrainCircuit,
    cats: ["AI & Generative AI", "Machine Learning"],
  },
  {
    title: "Tools & practice",
    icon: Workflow,
    cats: ["Cloud & Dev Tools", "Engineering Practices"],
  },
];
function Skills() {
  const publishedResume = usePublishedProfileResume("abhishek");
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
        <PublishedResumePanel profileId="abhishek" section="skills" resume={publishedResume} />
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
            {groups.map(({ title, icon: Icon, cats, picks }, index) => {
              const items = [
                ...new Set(
                  SKILLS.filter((g) => cats.includes(g.cat))
                    .flatMap((g) => g.items)
                    .filter((x) => !picks || picks.includes(x)),
                ),
              ];
              return (
                <Reveal key={title} delay={index * 0.04}>
                  <details className="skill-group" open={index === 0}>
                    <summary>
                      <span className="skill-group-icon">
                        <Icon />
                      </span>
                      <span>
                        <small>SECTOR 0{index + 1}</small>
                        <strong>{title}</strong>
                        <em>{items.length} technologies</em>
                      </span>
                      <span className="skill-group-plus">+</span>
                    </summary>
                    <ul>
                      {items.map((item) => (
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
