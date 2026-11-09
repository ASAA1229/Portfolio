import { ProfileContactPanel } from "@/components/ProfileContactPanel";
import { PORTFOLIO_FILES } from "@/lib/contact-schema";
import { CONTACT } from "@/lib/portfolio-data";
import { usePublishedProfileResume } from "@/lib/published-resume";

/**
 * Abhishek's contact section: the shared profile contact panel with his curated
 * details, overridden by an approved published resume where present.
 */
export function PortfolioContact() {
  const published = usePublishedProfileResume("abhishek");
  return (
    <ProfileContactPanel
      contact={{
        displayName: "Abhishek",
        email: published?.contact?.email || CONTACT.email,
        phone: published?.contact?.phone || CONTACT.phone,
        location: CONTACT.location,
        linkedin: published?.contact?.linkedin || CONTACT.linkedin,
        github: published?.contact?.github || CONTACT.github,
        resumeHref: PORTFOLIO_FILES.resume || null,
      }}
    />
  );
}
