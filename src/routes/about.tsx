import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, GraduationCap, MapPin, Sparkles } from "lucide-react";
import { AiIntro } from "@/components/AiIntro";
import { PageBody, ResumeAction } from "@/components/SitePrimitives";
import { Reveal } from "@/components/Reveal";
import { pageHead } from "@/lib/site-data";
import { useAbhishekContent } from "@/lib/abhishek-content";
import { usePublishedProfileImages } from "@/lib/published-resume";

export const Route = createFileRoute("/about")({
  head: () =>
    pageHead(
      "About",
      "Meet Guda Abhishek: software engineer, IT graduate, AI enthusiast and student leader in Hyderabad.",
      "/about",
    ),
  component: About,
});

function About() {
  // Owner-published CMS basics replace the curated copy; curated text is the fallback.
  const { headline, summary, story, education, contact, missions } = useAbhishekContent();
  const publishedImages = usePublishedProfileImages("abhishek");
  const publishedGallery = publishedImages.filter((image) => image.slot === "gallery");
  const publishedHero = [...publishedImages].reverse().find((image) => image.slot === "portrait");
  const storyParagraphs = story
    ?.split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return (
    <>
      <section className="chapter-hero about-hero">
        <img
          src={publishedHero?.src ?? "/images/profiles/abhishek/abhishek_main.jpeg"}
          alt={publishedHero?.alt ?? "Cinematic portrait artwork from Abhishek's portfolio"}
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="chapter-hero-shade" />
        <div className="site-container chapter-hero-copy">
          <Reveal>
            <p className="chapter-kicker">01 / THE ORIGIN STORY</p>
            <h1>
              BUILT BY
              <br />
              <span>CURIOSITY.</span>
            </h1>
            <p className="chapter-lede">
              {headline ||
                summary ||
                "I’m Guda Abhishek — a software engineer drawn to the point where thoughtful interfaces meet intelligent systems."}
            </p>
            <a className="chapter-scroll" href="#story">
              <ArrowDown /> Read my story
            </a>
          </Reveal>
        </div>
        <span className="chapter-hero-index">ABHISHEK: THE SERIES · CHAPTER 01</span>
      </section>
      <PageBody>
        <section id="story" className="about-story">
          <Reveal>
            <div>
              <p className="chapter-kicker">THE PERSON BEHIND THE CODE</p>
              <h2>
                Making useful things
                <br />
                feel <span>considered.</span>
              </h2>
            </div>
          </Reveal>
          <div className="about-story-copy">
            {storyParagraphs?.length ? (
              storyParagraphs.map((paragraph, index) => (
                <p key={index} className={index === 0 ? "story-lead" : undefined}>
                  {paragraph}
                </p>
              ))
            ) : (
              <>
                <p className="story-lead">
                  My work spans responsive React interfaces, MERN platforms, REST API integration,
                  and practical AI experiences.
                </p>
                <p>
                  At Paves Technologies, I build enterprise finance and employee workflow
                  interfaces. Before that, at Bilvantis Technologies, I contributed to the NEO AI
                  product interface. Across both, I’ve learned to value clear states, reliable
                  integration, and close collaboration as much as the code itself.
                </p>
                <p>
                  I’m completing a B.Tech in Information Technology at TKR College of Engineering &
                  Technology. I’m especially interested in generative AI, RAG, and AI agents when
                  they solve real product problems.
                </p>
              </>
            )}
            <div className="about-facts">
              <span>
                <GraduationCap /> {education?.qualification || "B.Tech Information Technology"} · {education?.period || "2022–2026"}
              </span>
              <span>
                <MapPin /> {education?.location || contact.location || "Hyderabad, India"}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <AiIntro />
              <ResumeAction />
            </div>
          </div>
        </section>
        <section className="py-12 sm:py-16" aria-labelledby="personal-gallery-title">
          <div className="mb-6">
            <p className="chapter-kicker">BEYOND THE SCREEN</p>
            <h2 id="personal-gallery-title" className="mt-3 text-3xl sm:text-4xl">
              Moments along the way.
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
            {(publishedGallery.length ? publishedGallery : [
              { id: "fallback-1", src: "/images/profiles/abhishek/abhishek_main.jpeg", alt: "Abhishek at his graduation celebration" },
              { id: "fallback-2", src: "/images/profiles/abhishek/abhishek_1.jpeg", alt: "Abhishek presenting in a classroom" },
              { id: "fallback-3", src: "/images/profiles/abhishek/abhishek_2.jpeg", alt: "Abhishek standing on the college campus" },
            ]).map((photo) => (
              <img
                key={photo.id}
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                className="aspect-[4/5] w-full rounded-lg border border-border object-cover"
                onError={(event) => { event.currentTarget.style.display = "none"; }}
              />
            ))}
          </div>
        </section>
        <section className="chapter-timeline">
          <div className="chapter-section-heading">
            <div>
              <p className="chapter-kicker">MILESTONES</p>
              <h2>Chapters that shaped me.</h2>
            </div>
            <Sparkles aria-hidden="true" />
          </div>
          <div className="milestone-list">
            {missions.map((item, i) => (
              <Reveal key={item.id} delay={i * 0.04}>
                <article className="milestone">
                  <span>{item.period}</span>
                  <div>
                    <h3>{item.company}</h3>
                    <p>{item.role}{item.projects.length ? ` · ${item.projects.map((project) => project.name).join(" · ")}` : ""}</p>
                  </div>
                  <span className="milestone-number">{String(i + 1).padStart(2, "0")}</span>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      </PageBody>
    </>
  );
}
