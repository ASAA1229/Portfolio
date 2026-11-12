import { useAbhishekContent } from "@/lib/abhishek-content";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, MapPin, Code2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiIntro } from "@/components/AiIntro";
import { Reveal } from "@/components/Reveal";
import { ProjectCard, ResumeAction, SocialLinks } from "@/components/SitePrimitives";
import { pageHead } from "@/lib/site-data";
import { usePublishedProfileImages, usePublishedProfileResume } from "@/lib/published-resume";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Software Engineer & AI Developer",
      "Guda Abhishek's portfolio: React and MERN platforms, Java, REST APIs, Generative AI, projects and engineering experience.",
      "/",
    ),
  component: Home,
});
function Home() {
  const publishedResume = usePublishedProfileResume("abhishek");
  const publishedImages = usePublishedProfileImages("abhishek");
  const publishedPortrait = [...publishedImages].reverse().find((image) => image.slot === "portrait");
  // Owner CMS edits (headline, summary, projects) over curated content.
  const content = useAbhishekContent();
  return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <section className="home-hero">
        <img
          src={publishedPortrait?.src ?? "/images/profiles/abhishek/abhishek_main.jpeg"}
          alt={publishedPortrait?.alt ?? "Portrait of Guda Abhishek"}
          width={768}
          height={768}
          fetchPriority="high"
          className="home-portrait"
        />
        <div className="hero-shade" aria-hidden="true" />
        <div className="site-container relative z-10 py-12 sm:py-20">
          <Reveal>
            <div className="hero-copy">
              <p className="mb-6 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                <span className="h-px w-8 bg-primary" /> SOFTWARE / INTELLIGENCE / IMPACT
              </p>
              <h1 className="home-title">
                GUDA
                <br />
                <span>ABHISHEK</span>
                <span className="text-primary">.</span>
              </h1>
              <p className="mt-6 max-w-md text-lg font-semibold leading-7">
                {content.headline || publishedResume?.headline || (
                  <>
                    Software Engineer
                    <br />
                    <span className="text-violet">AI & Full-Stack Developer</span>
                  </>
                )}
              </p>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
                {content.summary ||
                  publishedResume?.summary ||
                  "Building practical products with React, Java, REST APIs and Generative AI. Thoughtful interfaces. Reliable integrations. Engineering that connects ideas to real experiences."}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild className="min-h-11 px-5">
                  <Link to="/projects">
                    Explore my work <ArrowUpRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11">
                  <Link to="/about">
                    The full story <ArrowRight />
                  </Link>
                </Button>
                <ResumeAction />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <AiIntro compact />
                <SocialLinks github={content.contact.github} linkedin={content.contact.linkedin} />
              </div>
              <p className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="size-3 text-violet" /> {content.contact.location || "Hyderabad, India"}{" "}
                <span className="mx-1">/</span> B.Tech IT · 2026
              </p>
            </div>
          </Reveal>
        </div>
        <p className="portrait-credit">GUDA ABHISHEK / AI-STYLIZED PORTRAIT</p>
      </section>
      <section className="home-disciplines">
        <div className="site-container grid gap-6 py-7 sm:grid-cols-3">
          {[
            ["01", "Full-stack engineering", "React · MERN · Java · REST APIs", Code2],
            ["02", "Intelligent experiences", "Generative AI · RAG · AI agents", Sparkles],
            ["03", "Practical product thinking", "Reusable UI · Integration · Agile", ArrowUpRight],
          ].map(([number, title, sub, Icon]) => {
            const Symbol = Icon as typeof Code2;
            return (
              <div key={String(number)} className="flex items-start gap-4">
                <span className="font-mono text-xs text-primary">{String(number)}</span>
                <div>
                  <p className="text-sm font-semibold">{String(title)}</p>
                  <p className="mt-2 text-[10px] text-muted-foreground">{String(sub)}</p>
                </div>
                <Symbol className="ml-auto size-4 text-violet" />
              </div>
            );
          })}
        </div>
      </section>
      <section className="site-container py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-violet">SELECTED ORIGINALS</p>
            <h2 className="mt-3 text-4xl font-semibold">Ideas, engineered.</h2>
          </div>
          <Button asChild variant="bare">
            <Link to="/projects">
              All projects <ArrowUpRight />
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {content.projects
            .filter((p) => p.index === 0 || p.index === 2)
            .map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
        </div>
      </section>
      <section className="home-about">
        <div className="site-container grid gap-8 py-12 md:grid-cols-[1fr_1.4fr]">
          <h2 className="text-4xl font-semibold">Beyond the interface.</h2>
          <div>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              {content.story ||
                content.summary ||
                "From enterprise finance workflows to AI product interfaces, I focus on responsive software, clear communication and purposeful integration."}
            </p>
            <Button asChild variant="bare" className="mt-4 px-0">
              <Link to="/experience">
                Explore my career <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
