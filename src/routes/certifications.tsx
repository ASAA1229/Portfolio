import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Award, BadgeCheck } from "lucide-react";
import { PageBody } from "@/components/SitePrimitives";
import { PublishedResumePanel } from "@/components/PublishedResumePanel";
import { Reveal } from "@/components/Reveal";
import { CERTS } from "@/lib/portfolio-data";
import { pageHead } from "@/lib/site-data";

export const Route = createFileRoute("/certifications")({
  head: () =>
    pageHead(
      "Certifications",
      "Guda Abhishek's certifications in Generative AI, OCI, machine learning, Python and Android development.",
      "/certifications",
    ),
  component: Certifications,
});
function Certifications() {
  return (
    <>
      <section className="chapter-hero certs-hero">
        <div className="certs-backdrop" />
        <div className="site-container chapter-hero-copy">
          <Reveal>
            <p className="chapter-kicker">05 / THE LEARNING ARCHIVE</p>
            <h1>
              PROGRESS,
              <br />
              <span>DOCUMENTED.</span>
            </h1>
            <p className="chapter-lede">
              A collection of learning milestones across AI, cloud, machine learning, and software
              development.
            </p>
          </Reveal>
        </div>
        <span className="chapter-hero-index">
          CONTINUOUS LEARNING · VERIFIED DETAILS SHOWN WHEN AVAILABLE
        </span>
      </section>
      <PageBody>
        <PublishedResumePanel profileId="abhishek" section="certifications" />
        <div className="certs-note">
          <BadgeCheck />
          <p>
            Credentials are listed from the portfolio record. Certificate scans, issue dates, IDs,
            and verification links have not been provided.
          </p>
        </div>
        <div className="certificate-archive">
          {CERTS.map(([title, issuer], i) => (
            <Reveal key={title} delay={i * 0.035}>
              <article className="certificate-item">
                <div className="certificate-art" aria-hidden="true">
                  <span className="certificate-stamp">
                    <Award />
                  </span>
                  <span>LEARNING ARCHIVE</span>
                  <i>0{i + 1}</i>
                </div>
                <div className="certificate-copy">
                  <p>{issuer}</p>
                  <h2>{title}</h2>
                  <span>Credential details not supplied</span>
                </div>
                <Award className="certificate-award" aria-hidden="true" />
              </article>
            </Reveal>
          ))}
        </div>
        <section className="cert-recognition">
          <div>
            <p className="chapter-kicker">BEYOND THE CLASSROOM</p>
            <h2>Recognition & leadership.</h2>
            <p>
              Two innovation projects recognized under the MSME Innovation Programme 2024, alongside
              IEEE membership activities and IT branch student coordination.
            </p>
          </div>
          <Link to="/about">
            Explore the story <ArrowUpRight />
          </Link>
        </section>
      </PageBody>
    </>
  );
}
