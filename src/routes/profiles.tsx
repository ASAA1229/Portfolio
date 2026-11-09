import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { PEOPLE } from "@/lib/person-portfolios";
import { MOTION_TOKENS } from "@/lib/motion";

export const Route = createFileRoute("/profiles")({
  head: () => ({
    meta: [
      { title: "Who's Watching? — Choose Your Portfolio" },
      {
        name: "description",
        content:
          "Choose Abhishek, Amulya (Ammu), Anjini (Bava), or Sai (Darling) and explore their individual portfolios.",
      },
      { property: "og:title", content: "Who's Watching? — Choose Your Portfolio" },
      {
        property: "og:description",
        content: "Four people. Individual stories. Explore Abhishek, Amulya, Anjini, and Sai.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfileSelect,
});

function ProfileSelect() {
  const [portraitOverrides, setPortraitOverrides] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    fetch("/api/published-images", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { images: [] }))
      .then((payload: { images?: { profileId: string; src: string; slot?: string }[] }) => {
        if (!active) return;
        const overrides: Record<string, string> = {};
        for (const image of payload.images ?? []) {
          if (image.slot === "portrait") overrides[image.profileId] = image.src;
        }
        setPortraitOverrides(overrides);
      })
      .catch(() => {
        if (active) setPortraitOverrides({});
      });
    return () => {
      active = false;
    };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: MOTION_TOKENS.stagger.tight,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: MOTION_TOKENS.duration.section,
        ease: MOTION_TOKENS.ease.entrance,
      },
    },
  };

  return (
    <div className="relative flex min-h-svh flex-col bg-background px-5 py-8 sm:px-12">
      <header className="flex items-center justify-between">
        <span className="series-logo text-3xl">
          ABHISHEK{" "}
          <span className="ml-2 align-middle font-sans text-[9px] font-normal text-muted-foreground">
            THE SERIES
          </span>
        </span>
      </header>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center py-14">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="w-full text-center"
          data-motion-entrance
        >
          <motion.p
            variants={itemVariants}
            className="mb-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          >
            CHOOSE YOUR PROFILE
          </motion.p>
          <motion.h1 variants={itemVariants} className="text-5xl font-semibold sm:text-6xl">
            Who's Watching?
          </motion.h1>
          <motion.div
            variants={itemVariants}
            className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-x-5 gap-y-8 sm:mt-12 sm:grid-cols-4 sm:gap-6"
          >
            {PEOPLE.map((profile) => (
              <Button
                key={profile.id}
                asChild
                variant="bare"
                size="auto"
                className="group block text-center"
              >
                <Link to="/people/$person" params={{ person: profile.id }} className="min-w-0">
                  <span className="block rounded ring-2 ring-transparent transition-all duration-200 group-hover:scale-[1.04] group-hover:ring-foreground group-focus-visible:ring-foreground group-active:scale-95">
                    <span
                      aria-hidden="true"
                      className={`${profile.color} relative flex aspect-square w-full items-center justify-center overflow-hidden rounded font-display text-6xl text-primary-foreground shadow-2xl ring-1 ring-white/10 sm:text-7xl`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center">
                        {profile.initials}
                      </span>
                      {(portraitOverrides[profile.id] ?? profile.avatar) && (
                        <img
                          src={portraitOverrides[profile.id] ?? profile.avatar}
                          alt=""
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                          draggable={false}
                          className="absolute inset-0 size-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                          onError={(event) => {
                            // Keep the initials layer visible as a graceful fallback.
                            event.currentTarget.hidden = true;
                          }}
                        />
                      )}
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                    </span>
                  </span>
                  <span className="mt-4 block min-h-10 text-sm text-foreground transition-colors group-hover:text-primary sm:text-base">
                    {profile.name}
                    {profile.nickname && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        ({profile.nickname})
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                    {profile.status}
                  </span>
                </Link>
              </Button>
            ))}
          </motion.div>
        </motion.div>
      </div>
      <footer className="text-center text-[10px] text-muted-foreground">
        GUDA ABHISHEK · SOFTWARE ENGINEER & AI DEVELOPER
      </footer>
    </div>
  );
}
