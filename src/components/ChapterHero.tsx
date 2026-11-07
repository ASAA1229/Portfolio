import type { ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { Reveal } from "@/components/Reveal";

export type ChapterVariant = "about" | "skills" | "projects" | "experience" | "certs" | "contact";

/**
 * Cinematic chapter hero shared by section pages (same markup and classes as
 * Abhishek's chapter pages). The optional image is decorative unless an alt
 * text is given; the contact variant uses its CSS backdrop instead.
 */
export function ChapterHero({
  variant,
  kicker,
  title,
  accent,
  lede,
  index,
  image,
  imageAlt = "",
  scrollTarget,
  scrollLabel,
  action,
}: {
  variant: ChapterVariant;
  kicker: string;
  title: string;
  accent: string;
  lede: ReactNode;
  index: ReactNode;
  image?: string | undefined;
  imageAlt?: string;
  scrollTarget?: string | undefined;
  scrollLabel?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <section className={`chapter-hero ${variant}-hero`}>
      {variant === "contact" ? (
        <div className="contact-backdrop" />
      ) : (
        image && (
          <img
            src={image}
            alt={imageAlt}
            aria-hidden={imageAlt ? undefined : true}
            width={1536}
            height={1024}
            fetchPriority="high"
          />
        )
      )}
      {variant !== "contact" && <div className="chapter-hero-shade" />}
      <div className="site-container chapter-hero-copy">
        <Reveal>
          <p className="chapter-kicker">{kicker}</p>
          <h1>
            {title}
            <br />
            <span>{accent}</span>
          </h1>
          <p className="chapter-lede">{lede}</p>
          {action}
          {scrollTarget && scrollLabel && (
            <a className="chapter-scroll" href={`#${scrollTarget}`}>
              <ArrowDown /> {scrollLabel}
            </a>
          )}
        </Reveal>
      </div>
      <span className="chapter-hero-index">{index}</span>
    </section>
  );
}
