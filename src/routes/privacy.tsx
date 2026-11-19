import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo-head";

export const Route = createFileRoute("/privacy")({
  head: () =>
    seoHead({
      title: "Privacy — Portfolio",
      description:
        "What this portfolio collects, how the AI assistant handles your questions, and your choices.",
      path: "/privacy",
    }),
  component: Privacy,
});

/**
 * Visitor privacy notice (PORT-US-039). Keep every statement true to the code:
 * no analytics, no cookies for visitors, no stored chat transcripts, mailto-only contact.
 */
function Privacy() {
  return (
    <div className="site-container max-w-3xl py-14 sm:py-20">
      <p className="font-mono text-xs text-primary">PRIVACY</p>
      <h1 className="mt-3 text-4xl font-semibold">Your privacy on this portfolio</h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        This is a personal portfolio for four people. It is built to collect as little as possible.
      </p>

      <Section title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>No analytics or tracking.</strong> There are no analytics scripts, advertising
            tags or tracking cookies.
          </li>
          <li>
            <strong>Standard server logs.</strong> The hosting provider may record basic request
            information (such as IP address, time and page) for security and abuse prevention.
          </li>
          <li>
            <strong>Visitors get no cookies.</strong> A cookie is used only for the owner&apos;s
            private admin sign-in.
          </li>
        </ul>
      </Section>

      <Section title="The AI assistant">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Questions you type are sent to the site owner&apos;s own AI service (JARVIS) only to
            generate an answer. They are not used to train AI models.
          </li>
          <li>
            The portfolio does not store chat transcripts. Your conversation exists only in your
            browser tab; use <em>Clear my chat</em> in the assistant or close the tab to remove it.
          </li>
          <li>
            The AI service keeps request metadata only (time, size, outcome) for rate limiting and
            security — not the text of your questions or the answers.
          </li>
          <li>
            If the AI service is unavailable, answers come from the published portfolio data and are
            labelled as offline answers.
          </li>
          <li>Please don&apos;t share sensitive personal information in the chat.</li>
        </ul>
      </Section>

      <Section title="Contacting someone">
        <p>
          The contact form does not send or store anything on this site. It prepares a message in
          your own email app (a <code>mailto:</code> link); what you send is handled by your email
          provider and the recipient.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can browse without providing any personal information. To ask about or request
          deletion of anything you sent by email, reply to the person you contacted.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}
