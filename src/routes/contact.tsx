import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, Clapperboard } from "lucide-react";
import { PortfolioContact } from "@/components/PortfolioContact";
import { PageBody } from "@/components/SitePrimitives";
import { Reveal } from "@/components/Reveal";
import { pageHead } from "@/lib/site-data";
import { CONTACT } from "@/lib/portfolio-data";
import { usePublishedProfileResume } from "@/lib/published-resume";

export const Route = createFileRoute("/contact")({
  head: () =>
    pageHead(
      "Contact",
      "Connect with Guda Abhishek in Hyderabad by email, phone, GitHub or LinkedIn. Prepare an email enquiry.",
      "/contact",
    ),
  component: Contact,
});
function Contact() {
  const published = usePublishedProfileResume("abhishek");
  const email = published?.contact?.email || CONTACT.email;
  return (
    <>
      <section className="chapter-hero contact-hero">
        <div className="contact-backdrop" />
        <div className="site-container chapter-hero-copy">
          <Reveal>
            <p className="chapter-kicker">06 / THE FINALE</p>
            <h1>
              LET’S MAKE
              <br />
              <span>THE NEXT THING.</span>
            </h1>
            <p className="chapter-lede">
              For thoughtful opportunities, engineering conversations, and collaborations.
            </p>
            <a className="chapter-scroll" href="#contact">
              <ArrowDown /> Start a conversation
            </a>
          </Reveal>
        </div>
        <span className="chapter-hero-index">
          <Clapperboard /> END CREDITS · HYDERABAD, INDIA
        </span>
      </section>
      <PageBody>
        <div className="contact-endcard">
          <div>
            <p className="chapter-kicker">A GOOD STORY STARTS SOMEWHERE</p>
            <h2>Have a project in mind?</h2>
            <p>Send a note and I’ll get back to you through email.</p>
            <a href={`mailto:${email}`} className="contact-email">
              {email}
            </a>
          </div>
          <span className="endcard-mark" aria-hidden="true">
            GA<span>.</span>
          </span>
        </div>
      </PageBody>
      <div className="contact-page cinematic-contact">
        <PortfolioContact />
      </div>
    </>
  );
}
