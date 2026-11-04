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
import {
  PERSON_SECTIONS,
  type PersonPortfolio,
  type PersonProject,
  type PortfolioSection,
} from "@/lib/person-portfolios";
import backdrop from "@/assets/series-billboard.jpg";
import { normalizePublishedPortrait, normalizePublishedProfileResume, type PublishedProfileResume } from "@/lib/published-resume";

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
      <PersonPortfolioAssistant profile={profile} />
      <footer className="site-footer">
        <div className="site-container">
          <p className="font-mono text-xs text-primary">THE NEXT CHAPTER</p>
          <h2 className="mt-3 text-4xl">Let's connect.</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <ContactActions profile={profile} />
            <Button asChild variant="outline">
              <Link to="/profiles">
                Switch profiles <ArrowRight />
              </Link>
            </Button>
          </div>
          <p className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground">
            © 2026 {profile.name}. Netflix-inspired portfolio concept.
          </p>
        </div>
      </footer>
    </div>
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
  return (
    <>
      {profile.email && (
        <Button asChild className="min-h-11">
          <a href={`mailto:${profile.email}`}>
            <Mail /> Email {profile.displayName}
          </a>
        </Button>
      )}
      {profile.phone && (
        <Button asChild variant="outline" className="min-h-11">
          <a href={`tel:${profile.phone.replaceAll(" ", "")}`}>
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
  return (
    <article className="project-card person-project">
      <Link
        to="/people/$person/projects/$slug"
        params={{ person: profile.id, slug: project.slug }}
        className="person-project-art"
        aria-label={`Explore ${project.title}`}
      >
        <Icon strokeWidth={1} />
        <span className="font-mono text-xs">ORIGINAL {String(index + 1).padStart(2, "0")}</span>
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
function usePublishedProfileResume(profileId: string): PublishedProfileResume | null {
  const [resume, setResume] = useState<PublishedProfileResume | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/published-resumes", { headers: { accept: "application/json" }, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: unknown) => {
        if (active) setResume(normalizePublishedProfileResume(payload, profileId));
      })
      .catch(() => { if (active) setResume(null); });
    return () => { active = false; };
  }, [profileId]);
  return resume;
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
        {resume.summary && <p className="mt-4 text-sm leading-7 text-muted-foreground">{resume.summary}</p>}
        {resume.skills.length > 0 && <div className="mt-5 flex flex-wrap gap-2">
          {resume.skills.slice(0, 20).map((skill, index) => <span key={skill + index} className="rounded-full border border-border px-3 py-1 text-xs">{skill}</span>)}
        </div>}
      </article>
    </section>
  );
}

export function PersonHome({ profile }: { profile: PersonPortfolio }) {
  const publishedResume = usePublishedProfileResume(profile.id);
  const [publishedPortrait, setPublishedPortrait] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/published-images", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { images: [] })
      .then((payload: unknown) => {
        if (!active) return;
        setPublishedPortrait(normalizePublishedPortrait(payload, profile.id));
      })
      .catch(() => { if (active) setPublishedPortrait(null); });
    return () => { active = false; };
  }, [profile.id]);
  const headline = publishedResume?.headline || profile.headline;
  const story = publishedResume?.summary || profile.story;
  return (
    <>
      <section className="person-hero">
        <img src={backdrop} alt="" className="person-hero-backdrop" aria-hidden="true" />
        <img
          src={publishedPortrait ?? profile.portrait}
          alt={`${profile.name} portrait`}
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
            </div>
            <p className="mt-7 max-w-lg font-mono text-xs leading-6 text-muted-foreground">
              {profile.education.qualification} · {profile.education.period}
              <br />
              {profile.education.score}
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
            <p className="text-sm leading-8 text-muted-foreground">{publishedResume?.summary || profile.summary}</p>
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
  const [publishedImages, setPublishedImages] = useState<{ id: string; profileId: string; src: string; alt: string; slot?: string }[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/api/published-images", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { images: [] })
      .then((payload: { images?: { id: string; profileId: string; src: string; alt: string; slot?: string }[] }) => {
        if (active) setPublishedImages((payload.images ?? []).filter((image) => image.profileId === profile.id && image.slot !== "portrait"));
      })
      .catch(() => { if (active) setPublishedImages([]); });
    return () => { active = false; };
  }, [profile.id]);
  const galleryPhotos = [
    ...profile.gallery,
    ...publishedImages.map((image) => ({ src: image.src, alt: image.alt, id: image.id })),
  ];
  const title = PERSON_SECTIONS.find((item) => item.id === section)?.label ?? section;
  const descriptions: Record<PortfolioSection, string> = {
    about: publishedResume?.summary || profile.story,
    skills: "Tools, disciplines, and the foundations behind the work.",
    projects: "A closer look at the applications and technical projects.",
    experience: "Hands-on work, responsibilities, and professional learning.",
    certifications: "Credentials and continued learning.",
    education: "Academic foundations and ongoing growth.",
    contact: "Start a conversation.",
  };
  return (
    <article className="site-container py-12 sm:py-16">
      <header className="person-section-heading mb-10">
        <img src={backdrop} alt="" aria-hidden="true" className="person-section-backdrop" />
        <div className="person-section-heading-copy">
          <p className="site-page-kicker">{profile.name.toUpperCase()} / THE SERIES</p>
          <h1 className="site-page-title mt-4">{title}</h1>
          <p className="site-page-description mt-5">
            {descriptions[section]}
          </p>
        </div>
      </header>
      {section === "about" && (
        <>
          <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="text-4xl">{publishedResume?.headline || profile.headline}</h2>
              <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
                <img
                  src={profile.portrait}
                  alt={`${profile.name} — portfolio portrait`}
                  loading="lazy"
                  className="max-h-[34rem] w-full object-cover object-center"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-sm leading-8 text-muted-foreground">{profile.summary}</p>
              {galleryPhotos.length > 0 && (
                <div className="mt-8 grid grid-cols-2 gap-3" aria-label={`${profile.name} photo gallery`}>
                  {galleryPhotos.map((photo) => (
                    <img
                      key={"id" in photo ? photo.id : photo.src}
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
                  <article key={index} className="rounded-lg border border-border bg-card p-6">
                    <GraduationCap className="size-7 text-primary" />
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{entry}</p>
                  </article>
                ))}
              </div>
            ) : <Education profile={profile} />}
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
          ) : profile.skills.map((group, index) => (
            <section key={group.category} className="border-t border-border pt-6">
              <p className="font-mono text-xs text-primary">0{index + 1}</p>
              <h2 className="mt-3 text-3xl">{group.category}</h2>
              <TechnologyList items={group.items} />
            </section>
          ))}
        </div>
      )}
      {section === "projects" && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {publishedResume?.structuredSections?.projects?.length ? (
              publishedResume.structuredSections.projects.map((entry, index) => (
                <article key={index} className="rounded-lg border border-border bg-card p-6">
                  <p className="font-mono text-xs text-primary">UPLOADED RESUME / PROJECT 0{index + 1}</p>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{entry}</p>
                </article>
              ))
            ) : profile.projects.map((project, index) => (
              <ProjectTile key={project.slug} profile={profile} project={project} index={index} />
            ))}
          </div>
        </>
      )}
      {section === "experience" && (
        <>
          {publishedResume?.structuredSections?.experience?.length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {publishedResume.structuredSections.experience.map((entry, index) => (
                <article key={index} className="rounded-lg border border-border bg-card p-6">
                  <p className="font-mono text-xs text-primary">UPLOADED RESUME / EXPERIENCE 0{index + 1}</p>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{entry}</p>
                </article>
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
            {publishedResume?.structuredSections?.certifications?.length ? (
              publishedResume.structuredSections.certifications.map((entry, index) => (
                <article key={index} className="cert-card">
                  <Award className="size-7 text-gold" />
                  <p className="mt-5 font-mono text-xs text-gold">UPLOADED RESUME</p>
                  <h2 className="mt-3 whitespace-pre-wrap text-lg leading-tight">{entry}</h2>
                </article>
              ))
            ) : profile.certifications.map((cert) => (
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
                <article key={index} className="rounded-lg border border-border bg-card p-6">
                  <GraduationCap className="size-7 text-primary" />
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{entry}</p>
                </article>
              ))}
            </div>
          ) : <Education profile={profile} />}
          <Training profile={profile} />
        </>
      )}
      {section === "contact" && (
        <div className="grid gap-10 md:grid-cols-2">
          <section>
            <h2 className="text-4xl">Let's talk.</h2>
            <div className="mt-7 space-y-5">
              {profile.email && (
                <a className="person-contact-detail" href={`mailto:${profile.email}`}>
                  <Mail />
                  <span>{profile.email}</span>
                </a>
              )}
              {profile.phone && (
                <a className="person-contact-detail" href={`tel:${profile.phone.replaceAll(" ", "")}`}>
                  <Phone />
                  <span>{profile.phone}</span>
                </a>
              )}
              {!profile.email && !profile.phone && (
                <p className="max-w-md text-sm leading-7 text-muted-foreground">
                  Contact details will be added after the profile information is confirmed.
                </p>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <ContactActions profile={profile} />
            </div>
            <p className="mt-5 text-xs leading-6 text-muted-foreground">
              Email opens a draft in your email app. No message is sent from this website.
            </p>
          </section>
          <section className="border-t border-border pt-6">
            <h2 className="text-3xl">Elsewhere</h2>
            <div className="mt-6 space-y-5">
              {profile.socialLabels.map((social) => (
                <div key={social.platform} className="flex items-start gap-3 text-muted-foreground">
                  {social.platform === "GitHub" ? (
                    <Github className="size-5" />
                  ) : (
                    <Linkedin className="size-5" />
                  )}
                  <div>
                    <p className="text-sm">{social.platform}</p>
                    {social.handle && (
                      <p className="mt-2 break-all font-mono text-xs">{social.handle}</p>
                    )}
                    <p className="mt-2 text-xs">URL not provided</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
export function PersonProjectDetail({
  profile,
  project,
}: {
  profile: PersonPortfolio;
  project: PersonProject;
}) {
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
