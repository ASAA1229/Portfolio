import { ProfileContactPanel } from "@/components/ProfileContactPanel";
import { PORTFOLIO_FILES } from "@/lib/contact-schema";
import { usePublishedProfileResume } from "@/lib/published-resume";
import { useAbhishekContent } from "@/lib/abhishek-content";

/**
 * Abhishek's contact section: the shared profile contact panel with his curated
 * details, overridden by an approved published resume where present.
 */
export function PortfolioContact() {
  const published = usePublishedProfileResume("abhishek");
  const { contact: cmsContact } = useAbhishekContent();
  return (
    <ProfileContactPanel
      contact={{
        displayName: "Abhishek",
        email: published?.contact?.email || cmsContact.email,
        phone: published?.contact?.phone || cmsContact.phone,
        location: cmsContact.location,
        linkedin: published?.contact?.linkedin || cmsContact.linkedin,
        github: published?.contact?.github || cmsContact.github,
        resumeHref: PORTFOLIO_FILES.resume || null,
      }}
    />
  );
}
