import { PortfolioNavbar } from "@/components/navigation/PortfolioNavbar";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Menu,
  X,
  Mail,
  Phone,
  GraduationCap,
  Award,
  Code2,
  Database,
  Brain,
  Github,
  Linkedin,
  Clapperboard,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { TechnologyList } from "@/components/TechLogo";
import { PersonPortfolioAssistant } from "@/components/PersonPortfolioAssistant";
import { ResumeEntryCard } from "@/components/ResumeEntryCard";
import { ChapterHero, type ChapterVariant } from "@/components/ChapterHero";
import { ProfileContactPanel } from "@/components/ProfileContactPanel";
import { ResumeAction } from "@/components/SitePrimitives";
import { ProjectVisual } from "@/components/ProjectVisual";
import {
  PERSON_SECTIONS,
  type PersonPortfolio,
  type PersonProject,
  type PortfolioSection,
} from "@/lib/person-portfolios";
import backdrop from "@/assets/series-billboard.jpg";
import { usePublishedProfileImages, usePublishedProfileResume, usePublishedProjectImages } from "@/lib/published-resume";
import { usePublishedContent } from "@/lib/published-content";

function PersonLink({
  person,
  section,
  children,
  className,
}: {
  person: string;
  section?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  if (!section)
    return (
      <Link to="/people/$person" params={{ person }} className={className}>
        {children}
      </Link>
    );
  return (
    <Link to="/people/$person/$section" params={{ person, section }} className={className}>
      {children}
    </Link>
  );
}
export function PersonShell({
  profile,
  children,
}: {
  profile: PersonPortfolio;
  children: ReactNode;
}) {
  return (
    <div className={`site-shell person-shell person-${profile.id}`}>
      <a
        href="#person-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:p-4"
      >
        Skip to content
      </a>
      <PortfolioNavbar person={profile} />
      <div id="person-content">{children}</div>
      <PersonPortfolioAssistant key={profile.id} profile={profile} />
      <PersonFooter profile={profile} />
    </div>
  );
}
function profileSocialUrl(platform: string, handle: string | null): string | undefined {
  if (!handle) return undefined;
  const normalized = platform.trim().toLowerCase();
  const host = normalized === "linkedin" ? "linkedin.com" : normalized === "github" ? "github.com" : null;
  if (!host) return undefined;
  try {
    const url = new URL(handle);
    return url.protocol === "https:" &&
      (url.hostname === host || url.hostname.endsWith("." + host))
      ? url.toString()
      : undefined;
  } catch {
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(handle)) return undefined;
    return normalized === "linkedin"
      ? "https://www.linkedin.com/in/" + encodeURIComponent(handle)
      : "https://github.com/" + encodeURIComponent(handle);
  }
}

/** Precedence: approved resume contact → published CMS profile → curated profile. */
function usePersonContact(profile: PersonPortfolio) {
  const published = usePublishedProfileResume(profile.id);
  const social = (platform: string) =>
    profile.socialLabels.find((item) => item.platform.trim().toLowerCase() === platform)?.handle ?? null;
  return {
    email: published?.contact?.email || profile.email,
    phone: published?.contact?.phone || profile.phone,
    location: profile.location || profile.education.location,
    linkedin: published?.contact?.linkedin || profileSocialUrl("linkedin", social("linkedin")),
    github: published?.contact?.github || profileSocialUrl("github", social("github")),
  };
}

function SocialButtons({ profile }: { profile: PersonPortfolio }) {
  const { linkedin, github } = usePersonContact(profile);
  return (
    <>
      {linkedin && (
        <Button asChild variant="outline" className="min-h-11">
          <a href={linkedin} target="_blank" rel="noopener noreferrer">
            <Linkedin /> LinkedIn
          </a>
        </Button>
      )}
      {github && (
        <Button asChild variant="outline" className="min-h-11">
          <a href={github} target="_blank" rel="noopener noreferrer">
            <Github /> GitHub
          </a>
        </Button>
      )}
    </>
  );
}

/** Same footer structure as Abhishek's site shell, with only this person's details. */
function PersonFooter({ profile }: { profile: PersonPortfolio }) {
  const { email } = usePersonContact(profile);
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div>
            <p className="font-mono text-xs text-violet">THE NEXT CHAPTER</p>
            <h2 className="mt-3 text-4xl font-semibold">Let&apos;s build something meaningful.</h2>
            {email && (
              <a
                href={`mailto:${email}`}
                className="mt-4 inline-block break-all text-sm text-muted-foreground hover:text-foreground"
              >
                {email} <ArrowUpRight className="inline size-4" />
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <SocialButtons profile={profile} />
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/profiles">
                Switch profiles <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap justify-between gap-4 border-t border-border pt-6 text-[10px] leading-5 text-muted-foreground">
          <p>© 2026 {profile.name}. All rights reserved. Netflix-inspired portfolio concept.</p>
          <span className="flex gap-4">
            <Link to="/privacy">Privacy</Link>
            <PersonLink person={profile.id} section="projects">
              Explore The Series <ArrowUpRight className="inline size-3" />
            </PersonLink>
          </span>
        </div>
      </div>
    </footer>
  );
}

export function PersonUnavailable({
  person = "bava",
  missing = false,
}: {
  person?: string;
  missing?: boolean;
}) {
  return (
    <div className="site-shell person-shell">
      <PortfolioNavbar />
      <div className="site-container flex min-h-[calc(100svh-92px)] flex-col items-center justify-center py-12 text-center">
        <span className="person-coming-mark" aria-hidden="true">
          {person === "bava" ? "A" : "?"}
        </span>
        <p className="mt-8 font-mono text-xs text-primary">
          {missing ? "PAGE NOT FOUND" : "COMING SOON — RESUME PENDING"}
        </p>
        <h1 className="page-title mt-4">
          {missing ? "This story is not here." : "Anjini"}
          {!missing && <span className="mt-3 block text-3xl text-muted-foreground">Bava</span>}
        </h1>
        <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
          {missing
            ? "Choose a profile to continue exploring."
            : "Portfolio in progress. Her story will be added when her resume is available."}
        </p>
        <Button asChild className="mt-8">
          <Link to="/profiles">
            <ArrowLeft /> Choose your profile
          </Link>
        </Button>
      </div>
    </div>
  );
}
function ContactActions({ profile }: { profile: PersonPortfolio }) {
  const { email, phone } = usePersonContact(profile);
  return (
    <>
      {email && (
        <Button asChild className="min-h-11">
          <a href={"mailto:" + email}>
            <Mail /> Email {profile.displayName}
          </a>
        </Button>
      )}
      {phone && (
        <Button asChild variant="outline" className="min-h-11">
          <a href={"tel:" + phone.replace(/[^+0-9]/g, "")}>
            <Phone /> Call {profile.displayName}
          </a>
        </Button>
      )}
    </>
  );
}
function ProjectTile({
  profile,
  project,
  index,
}: {
  profile: PersonPortfolio;
  project: PersonProject;
  index: number;
}) {
  const Icon =
    profile.id === "ammu" ? (index === 0 ? Database : Code2) : index === 0 ? Brain : Code2;
  const projectImages = usePublishedProjectImages(profile.id, project.slug);
  const cover = projectImages[0];
  return (
    <article className="project-card person-project">
      <Link
        to="/people/$person/projects/$slug"
        params={{ person: profile.id, slug: project.slug }}
        className="person-project-art relative overflow-hidden"
        aria-label={`Explore ${project.title}`}
      >
        {cover ? (
          <img src={cover.src} alt={cover.alt} loading="lazy" className="absolute inset-0 size-full object-cover" />
        ) : (
          <Icon strokeWidth={1} />
        )}
        <span className="relative z-10 font-mono text-xs">ORIGINAL {String(index + 1).padStart(2, "0")}</span>
      </Link>
      <div className="p-6">
        <p className="font-mono text-[10px] leading-5 text-primary">{project.context}</p>
        <h3 className="mt-3 text-3xl leading-tight">
          <Link
            to="/people/$person/projects/$slug"
            params={{ person: profile.id, slug: project.slug }}
          >
            {project.title}
          </Link>
        </h3>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{project.overview}</p>
        <TechnologyList items={project.tech.slice(0, 5)} />
        <Button asChild variant="bare" className="mt-5 px-0">
          <Link
            to="/people/$person/projects/$slug"
            params={{ person: profile.id, slug: project.slug }}
          >
            Explore project <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </article>
  );
}
function PublishedResumeHighlights({ profileId }: { profileId: string }) {
  const resume = usePublishedProfileResume(profileId);
  if (!resume) return null;
  return (
    <section className="site-container py-10" aria-label="Published resume highlights">
      <div className="mb-6 border-t border-border pt-6">
        <p className="font-mono text-xs text-primary">VERIFIED PROFILE UPDATE</p>
        <h2 className="mt-3 text-3xl">Recently published.</h2>
      </div>
      <article className="rounded-lg border border-border bg-card p-6">
        <p className="font-mono text-xs text-muted-foreground">{resume.displayName}</p>
        {resume.headline && <h3 className="mt-3 text-2xl">{resume.headline}</h3>}
        {resume.summary && (
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{resume.summary}</p>
        )}
        {resume.skills.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {resume.skills.slice(0, 20).map((skill, index) => (
              <span
                key={skill + index}
                className="rounded-full border border-border px-3 py-1 text-xs"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

export function PersonHome({ profile }: { profile: PersonPortfolio }) {
  const publishedResume = usePublishedProfileResume(profile.id);
  const publishedContent = usePublishedContent(profile.id);
  const publishedImages = usePublishedProfileImages(profile.id);
  const publishedPortrait = [...publishedImages].reverse().find((image) => image.slot === "portrait");
  const resumeEducation = publishedResume?.structuredSections?.education?.find((entry) => typeof entry === "object");
  const educationTitle = resumeEducation?.title || profile.education.qualification;
  const educationOrganization = resumeEducation?.organization || profile.education.college;
  const educationPeriod = [resumeEducation?.startDate, resumeEducation?.endDate].filter(Boolean).join(" – ") || profile.education.period;
  const educationScore = resumeEducation?.grade || profile.education.score;
  const educationLocation = resumeEducation?.location || profile.location || profile.education.location;
  const headline = publishedContent?.basics?.headline || publishedResume?.headline || profile.headline;
  const story = publishedContent?.basics?.story || publishedContent?.basics?.summary || publishedResume?.summary || profile.story;
  return (
    <>
      <section className="person-hero">
        <img src={backdrop} alt="" className="person-hero-backdrop" aria-hidden="true" />
        <img
          src={publishedPortrait?.src ?? profile.portrait}
          alt={publishedPortrait?.alt ?? `${profile.name} portrait`}
          className="person-hero-portrait"
          fetchPriority="high"
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div className="person-hero-shade" aria-hidden="true" />
        <div className="site-container relative z-10 py-14 sm:py-20">
          <Reveal>
            <p className="font-mono text-xs text-primary">
              {profile.displayName.toUpperCase()} / THE PERSONAL SERIES
            </p>
            <h1 className="person-name mt-6">{profile.name}</h1>
            <p className="mt-6 max-w-xl text-lg font-semibold leading-7">{headline}</p>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">{story}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="min-h-11">
                <PersonLink person={profile.id} section="projects">
                  Explore my work <ArrowUpRight />
                </PersonLink>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <PersonLink person={profile.id} section="about">
                  The full story <ArrowRight />
                </PersonLink>
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => window.dispatchEvent(new Event("portfolio:open-ai-intro"))}
              >
                <Bot /> AI Intro
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <ResumeAction profileId={profile.id} />
              <ContactActions profile={profile} />
              <SocialButtons profile={profile} />
            </div>
            <p className="mt-7 max-w-lg font-mono text-xs leading-6 text-muted-foreground">
              {educationTitle} · {educationPeriod}
              <br />
              {educationOrganization}{educationScore ? " · " + educationScore : ""}
              {educationLocation && <><br />{educationLocation}</>}
            </p>
          </Reveal>
        </div>
      </section>
      <PublishedResumeHighlights profileId={profile.id} />
      <section className="home-disciplines">
        <div className="site-container grid gap-7 py-8 md:grid-cols-3">
          {profile.strengths.map((strength, index) => (
            <div key={strength.title} className="flex gap-4">
              <span className="font-mono text-xs text-primary">0{index + 1}</span>
              <div>
                <h2 className="font-sans text-sm font-semibold">{strength.title}</h2>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{strength.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="site-container py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-primary">SELECTED ORIGINALS</p>
            <h2 className="mt-3 text-4xl">Ideas in action.</h2>
          </div>
          <Button asChild variant="bare">
            <PersonLink person={profile.id} section="projects">
              All projects <ArrowRight />
            </PersonLink>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {profile.projects.slice(0, 2).map((project, index) => (
            <ProjectTile key={project.slug} profile={profile} project={project} index={index} />
          ))}
        </div>
      </section>
      <section className="home-about">
        <div className="site-container grid gap-6 py-12 md:grid-cols-[1fr_2fr]">
          <h2 className="text-4xl">Beyond the work.</h2>
          <div>
            <p className="text-sm leading-8 text-muted-foreground">
              {publishedContent?.basics?.story || publishedContent?.basics?.summary || publishedResume?.summary || profile.summary}
            </p>
            <Button asChild variant="bare" className="mt-4 px-0">
              <PersonLink person={profile.id} section="experience">
                Explore my experience <ArrowRight />
              </PersonLink>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
function Education({ profile }: { profile: PersonPortfolio }) {
  const education = profile.education;
  return (
    <section className="person-education">
      <GraduationCap className="size-10 text-primary" />
      <div>
        <p className="font-mono text-xs text-muted-foreground">{education.period}</p>
        <h2 className="mt-3 text-4xl">{education.qualification}</h2>
        <p className="mt-4 text-lg">{education.college}</p>
        {education.location && (
          <p className="mt-2 text-sm text-muted-foreground">{education.location}</p>
        )}
        <p className="mt-5 font-mono text-sm text-primary">{education.score}</p>
      </div>
    </section>
  );
}
function Training({ profile }: { profile: PersonPortfolio }) {
  return (
    <>
      {profile.training.map((training) => (
        <section key={training.title} className="mt-12 border-t border-border pt-8">
          <p className="font-mono text-xs text-primary">
            TRAINING / {training.status.toUpperCase()}
          </p>
          <h2 className="mt-3 text-3xl">{training.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{training.provider}</p>
          <ul className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            {training.topics.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
export function PersonContent({
  profile,
  section,
}: {
  profile: PersonPortfolio;
  section: PortfolioSection;
}) {
  const publishedResume = usePublishedProfileResume(profile.id);
  const publishedContent = usePublishedContent(profile.id);
  const publishedImages = usePublishedProfileImages(profile.id);
  const publishedPortrait = [...publishedImages].reverse().find((image) => image.slot === "portrait");
  const contact = usePersonContact(profile);
  const publishedGallery = publishedImages.filter((image) => image.slot === "gallery");
  const galleryPhotos = publishedGallery.length
    ? publishedGallery
    : profile.gallery;
  const sectionLabel = PERSON_SECTIONS.find((item) => item.id === section)?.label ?? section;
  const name = profile.displayName.toUpperCase();
  const publishedProjects = publishedResume?.structuredSections?.projects?.length ?? 0;
  const featured = profile.projects[0];
  // Same chapter sequence and visual language as Abhishek's section pages.
  const chapters: Record<
    PortfolioSection,
    {
      variant: ChapterVariant;
      kicker: string;
      title: string;
      accent: string;
      lede: string;
      index: string;
      image?: string;
      scroll?: string;
    }
  > = {
    about: {
      variant: "about",
      kicker: "01 / THE ORIGIN STORY",
      title: "MEET",
      accent: `${name}.`,
      lede: publishedResume?.headline || profile.headline,
      index: `${name}: THE SERIES · CHAPTER 01`,
      image: backdrop,
      scroll: "Read the story",
    },
    skills: {
      variant: "skills",
      kicker: "02 / THE TOOLKIT",
      title: "A LIVING",
      accent: "ECOSYSTEM.",
      lede: "Tools, disciplines, and the foundations behind the work.",
      index: "TOOLS IN PRACTICE · NO SCORES, JUST WORK",
      image: backdrop,
      scroll: "Explore the toolkit",
    },
    projects: {
      variant: "projects",
      kicker: "03 / ORIGINAL PRODUCTIONS",
      title: "BUILT FROM",
      accent: "AN IDEA.",
      lede: "Applications and technical projects, from the first idea to working software.",
      index: `SELECTED WORK · ${String(publishedProjects || profile.projects.length).padStart(2, "0")} PROJECTS`,
      image: backdrop,
    },
    experience: {
      variant: "experience",
      kicker: "04 / PROFESSIONAL TIMELINE",
      title: "LEARNING",
      accent: "BY DOING.",
      lede: "Hands-on work, responsibilities, and professional learning.",
      index: "WORK IN PROGRESS · WORK THAT SHIPS",
      scroll: "See the timeline",
    },
    certifications: {
      variant: "certs",
      kicker: "05 / THE LEARNING ARCHIVE",
      title: "PROGRESS,",
      accent: "DOCUMENTED.",
      lede: "Credentials and continued learning.",
      index: "CREDENTIALS · CONTINUED LEARNING",
      scroll: "Open the archive",
    },
    education: {
      variant: "experience",
      kicker: "06 / THE FOUNDATION",
      title: "BUILT ON",
      accent: "FOUNDATIONS.",
      lede: "Academic foundations and ongoing growth.",
      index: "KNOWLEDGE · PRACTICE · PROGRESS",
      scroll: "Read the record",
    },
    contact: {
      variant: "contact",
      kicker: "07 / THE FINALE",
      title: "LET’S MAKE",
      accent: "THE NEXT THING.",
      lede: "For opportunities, collaborations, and conversations.",
      index: `END CREDITS · ${name}`,
      scroll: "Start a conversation",
    },
  };
  const chapter = chapters[section];
  const contentId = `${section}-content`;
  const projectsCta = publishedProjects ? (
    <a href={`#${contentId}`} className="chapter-cta">
      Published projects <ArrowUpRight />
    </a>
  ) : featured ? (
    <Link
      to="/people/$person/projects/$slug"
      params={{ person: profile.id, slug: featured.slug }}
      className="chapter-cta"
    >
      Featured work <ArrowUpRight />
    </Link>
  ) : null;
  return (
    <>
      <ChapterHero
        variant={chapter.variant}
        kicker={chapter.kicker}
        title={chapter.title}
        accent={chapter.accent}
        lede={chapter.lede}
        index={chapter.index}
        image={chapter.image}
        scrollTarget={chapter.scroll ? contentId : undefined}
        scrollLabel={chapter.scroll}
        action={section === "projects" ? projectsCta : null}
      />
      <article
        id={contentId}
        aria-label={`${profile.name} — ${sectionLabel}`}
        className="site-container scroll-mt-24 py-12 sm:py-16"
      >
        {section === "about" && (
          <>
            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
              <div>
                <h2 className="text-4xl">{publishedContent?.basics?.headline || publishedResume?.headline || profile.headline}</h2>
                <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
                  <img
                    src={publishedPortrait?.src ?? profile.portrait}
                    alt={publishedPortrait?.alt ?? `${profile.name} — portfolio portrait`}
                    loading="lazy"
                    className="max-h-[34rem] w-full object-cover object-center"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm leading-8 text-muted-foreground">
                  {publishedResume?.summary || profile.summary}
                </p>
                {galleryPhotos.length > 0 && (
                  <div
                    className="mt-8 grid grid-cols-2 gap-3"
                    aria-label={`${profile.name} photo gallery`}
                  >
                    {galleryPhotos.map((photo) => (
                      <img
                        key={"id" in photo && typeof photo.id === "string" ? photo.id : photo.src}
                        src={photo.src}
                        alt={photo.alt}
                        loading="lazy"
                        className="aspect-[4/5] w-full rounded-md border border-border object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-12">
              {publishedResume?.structuredSections?.education?.length ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {publishedResume.structuredSections.education.map((entry, index) => (
                    <ResumeEntryCard key={index} entry={entry} section="education" index={index} />
                  ))}
                </div>
              ) : (
                <Education profile={profile} />
              )}
            </div>
            {profile.leadership.length > 0 && (
              <section className="mt-12">
                <h2 className="text-4xl">Leadership & contribution.</h2>
                <div className="mt-6 grid gap-8 md:grid-cols-2">
                  {profile.leadership.map((item) => (
                    <div key={item.title} className="border-l border-primary pl-5">
                      <p className="font-mono text-xs text-muted-foreground">{item.period}</p>
                      <h3 className="mt-3 text-2xl">{item.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <Training profile={profile} />
          </>
        )}
        {section === "skills" && (
          <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {publishedResume?.skills.length ? (
              <section className="border-t border-border pt-6">
                <p className="font-mono text-xs text-primary">01 / UPLOADED RESUME</p>
                <h2 className="mt-3 text-3xl">Skills & capabilities</h2>
                <TechnologyList items={publishedResume.skills} />
              </section>
            ) : (
              profile.skills.map((group, index) => (
                <section key={group.category} className="border-t border-border pt-6">
                  <p className="font-mono text-xs text-primary">0{index + 1}</p>
                  <h2 className="mt-3 text-3xl">{group.category}</h2>
                  <TechnologyList items={group.items} />
                </section>
              ))
            )}
          </div>
        )}
        {section === "projects" &&
          (publishedResume?.structuredSections?.projects?.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              {publishedResume.structuredSections.projects.map((entry, index) => (
                <ResumeEntryCard key={index} entry={entry} section="projects" index={index} />
              ))}
            </div>
          ) : (
            featured && (
              <>
                <section className="featured-project">
                  <div className="featured-project-art">
                    <ProjectVisual index={0} />
                    <span>FEATURED PRODUCTION · 01</span>
                  </div>
                  <div className="featured-project-copy">
                    <p className="chapter-kicker">{featured.context}</p>
                    <h2>{featured.title}</h2>
                    <p>{featured.overview}</p>
                    <Link
                      to="/people/$person/projects/$slug"
                      params={{ person: profile.id, slug: featured.slug }}
                    >
                      Explore the case study <ArrowUpRight />
                    </Link>
                  </div>
                </section>
                {profile.projects.length > 1 && (
                  <>
                    <div className="chapter-section-heading projects-list-heading">
                      <div>
                        <p className="chapter-kicker">MORE STORIES</p>
                        <h2>Other work in the series.</h2>
                      </div>
                      <span>{String(profile.projects.length).padStart(2, "0")} PROJECTS</span>
                    </div>
                    <div className="project-showcase">
                      {profile.projects.slice(1).map((project, i) => (
                        <Reveal key={project.slug} delay={i * 0.05}>
                          <Link
                            to="/people/$person/projects/$slug"
                            params={{ person: profile.id, slug: project.slug }}
                            className="showcase-project"
                          >
                            <div className={`showcase-art showcase-art-${i % 3}`}>
                              <ProjectVisual index={(i + 1) % 3} />
                              <span>{project.context}</span>
                            </div>
                            <div className="showcase-copy">
                              <p>ORIGINAL {String(i + 2).padStart(2, "0")}</p>
                              <h3>{project.title}</h3>
                              <span>{project.overview}</span>
                              <TechnologyList items={project.tech.slice(0, 6)} />
                              <ArrowUpRight className="showcase-arrow" />
                            </div>
                          </Link>
                        </Reveal>
                      ))}
                    </div>
                  </>
                )}
                <p className="mt-8 max-w-3xl text-xs leading-6 text-muted-foreground">
                  Project descriptions reflect documented scope and contributions. Repository, live
                  demo, and implementation media appear when verified links or assets are available.
                </p>
              </>
            )
          ))}
        {section === "experience" && (
          <>
            {publishedResume?.structuredSections?.experience?.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {publishedResume.structuredSections.experience.map((entry, index) => (
                  <ResumeEntryCard key={index} entry={entry} section="experience" index={index} />
                ))}
              </div>
            ) : (
              <div className="person-timeline">
                {profile.experience.map((job, index) => (
                  <section
                    key={job.role}
                    className="grid gap-6 border-l-2 border-primary py-3 pl-6 md:grid-cols-[1fr_2fr]"
                  >
                    <div>
                      <p className="font-mono text-xs text-primary">EPISODE 0{index + 1}</p>
                      <p className="mt-4 text-sm text-muted-foreground">{job.period}</p>
                      <h2 className="mt-3 text-3xl">{job.company ?? job.role}</h2>
                      {job.company && <p className="mt-3 text-sm">{job.role}</p>}
                      {!job.company && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Employer not specified in the resume.
                        </p>
                      )}
                      {job.context && <p className="mt-3 text-sm text-primary">{job.context}</p>}
                    </div>
                    <div>
                      <ul className="space-y-4 text-sm leading-7 text-muted-foreground">
                        {job.points.map((point) => (
                          <li key={point} className="flex gap-3">
                            <span className="text-primary" aria-hidden="true">
                              —
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                      <TechnologyList items={job.tech} />
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
        {section === "certifications" && (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {publishedResume?.structuredSections?.certifications?.length
                ? publishedResume.structuredSections.certifications.map((entry, index) => (
                    <ResumeEntryCard
                      key={index}
                      entry={entry}
                      section="certifications"
                      index={index}
                      compact
                    />
                  ))
                : profile.certifications.map((cert) => (
                    <article key={cert.title} className="cert-card">
                      <Award className="size-7 text-gold" />
                      <p className="mt-5 font-mono text-xs text-gold">{cert.issuer}</p>
                      <h2 className="mt-3 text-3xl leading-tight">{cert.title}</h2>
                    </article>
                  ))}
            </div>
            <Training profile={profile} />
          </>
        )}
        {section === "education" && (
          <>
            {publishedResume?.structuredSections?.education?.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {publishedResume.structuredSections.education.map((entry, index) => (
                  <ResumeEntryCard key={index} entry={entry} section="education" index={index} />
                ))}
              </div>
            ) : (
              <Education profile={profile} />
            )}
            <Training profile={profile} />
          </>
        )}
        {section === "contact" && (
          <div className="contact-endcard">
            <div>
              <p className="chapter-kicker">A GOOD STORY STARTS SOMEWHERE</p>
              <h2>Have a project in mind?</h2>
              <p>
                {contact.email
                  ? `Send ${profile.displayName} a note by email.`
                  : "Contact details will be added after the profile information is confirmed."}
              </p>
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="contact-email">
                  {contact.email}
                </a>
              )}
              {profile.socialLabels.some((item) => item.handle) && (
                <p className="mt-4 font-mono text-xs text-muted-foreground">
                  {profile.socialLabels
                    .filter((item) => item.handle)
                    .map((item) => `${item.platform}: ${item.handle}`)
                    .join(" · ")}
                </p>
              )}
            </div>
            <span className="endcard-mark" aria-hidden="true">
              {profile.initials}
              <span>.</span>
            </span>
          </div>
        )}
      </article>
      {section === "contact" && (
        <div className="contact-page cinematic-contact">
          <ProfileContactPanel
            contact={{
              displayName: profile.displayName,
              email: contact.email,
              phone: contact.phone,
              linkedin: contact.linkedin,
              github: contact.github,
            }}
          />
        </div>
      )}
    </>
  );
}
export function PersonProjectDetail({
  profile,
  project,
}: {
  profile: PersonPortfolio;
  project: PersonProject;
}) {
  const projectImages = usePublishedProjectImages(profile.id, project.slug);
  return (
    <article className="site-container py-12 sm:py-16">
      <Button asChild variant="bare" className="mb-8 px-0">
        <PersonLink person={profile.id} section="projects">
          <ArrowLeft /> All projects
        </PersonLink>
      </Button>
      <p className="font-mono text-xs text-primary">{project.context}</p>
      <h1 className="page-title mt-5 max-w-4xl">{project.title}</h1>
      <p className="mt-7 max-w-3xl text-sm leading-8 text-muted-foreground">{project.overview}</p>
      {projectImages.length > 0 && (
        <section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label={`Images for ${project.title}`}>
          {projectImages.map((image) => (
            <figure key={image.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <img src={image.src} alt={image.alt} loading="lazy" className="aspect-video w-full object-cover" />
            </figure>
          ))}
        </section>
      )}
      {project.caution && (
        <p className="mt-8 border-l-2 border-gold bg-card p-5 text-sm leading-7">
          {project.caution}
        </p>
      )}
      <section className="mt-12 grid gap-8 border-t border-border pt-8 md:grid-cols-[1fr_2fr]">
        <h2 className="text-4xl">Work & implementation.</h2>
        <ul className="space-y-5 text-sm leading-8 text-muted-foreground">
          {project.points.map((point) => (
            <li key={point} className="border-l border-primary pl-5">
              {point}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-12 border-t border-border pt-8">
        <h2 className="text-3xl">Technology</h2>
        <TechnologyList items={project.tech} />
      </section>
    </article>
  );
}
