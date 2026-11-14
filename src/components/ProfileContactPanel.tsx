import { useState, type FormEvent } from "react";
import { Check, Copy, FileDown, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { contactSchema } from "@/lib/contact-schema";

export interface ProfileContactDetails {
  /** Used in labels, e.g. "Email Ammu". */
  displayName: string;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  location?: string | null | undefined;
  linkedin?: string | null | undefined;
  github?: string | null | undefined;
  /** Public resume download, when a published PDF exists. */
  resumeHref?: string | null | undefined;
}

/**
 * Same contact experience as Abhishek's PortfolioContact (copy email, phone,
 * location, social links and a validated mailto draft form), parameterised per
 * profile. Missing details render nothing; the form only appears when an email
 * exists. Nothing is sent from the website — the visitor's email app opens.
 */
export function ProfileContactPanel({ contact }: { contact: ProfileContactDetails }) {
  const { email, phone, location, linkedin, github, resumeHref, displayName } = contact;
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "Portfolio enquiry",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback("");
    if (!email) return;
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      const next: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    const data = result.data;
    const body = `${data.message}\n\n— ${data.name} (${data.email})`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(body)}`;
    setFeedback(
      "Email draft prepared. Send it in your email app; no message has been sent from this website.",
    );
  };

  const copy = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setCopyFeedback("Email copied to clipboard.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopyFeedback("Could not copy. Select the email address to copy it manually.");
    }
  };

  const field =
    "w-full rounded-md border border-input bg-background/60 px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground";

  return (
    <section
      id="contact"
      className="scroll-mt-24 overflow-x-clip border-t border-border px-5 py-14 sm:px-12"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="mb-2 text-xs text-primary">LET’S BUILD WHAT COMES NEXT</p>
          <h2 className="mb-8 text-4xl font-bold sm:text-5xl">Ready for the Next Episode?</h2>
        </Reveal>
        <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
          <Reveal direction="left" delay={0.1}>
            <div className="space-y-5 py-4 font-sans text-sm">
              <p className="text-accent">LET’S CONNECT</p>
              {email && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-all">
                    <span className="text-muted-foreground">email:</span>{" "}
                    <a
                      href={`mailto:${email}`}
                      className="inline-flex min-h-6 items-center transition-colors hover:text-accent"
                    >
                      {email}
                    </a>
                  </span>
                  <Button
                    variant="bare"
                    size="auto"
                    onClick={copy}
                    aria-label={`Copy ${displayName}'s email`}
                    className="min-h-11 min-w-11 rounded border border-border px-2 py-1 text-xs transition-colors hover:border-accent hover:text-accent active:scale-95"
                  >
                    {copied ? <Check className="text-profile-green" /> : <Copy />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              )}
              {phone && (
                <p>
                  <span className="text-muted-foreground">phone:</span>{" "}
                  <a
                    href={`tel:${phone.replace(/[^+0-9]/g, "")}`}
                    className="inline-flex min-h-6 items-center transition-colors hover:text-accent"
                  >
                    {phone}
                  </a>
                </p>
              )}
              {location && (
                <p>
                  <span className="text-muted-foreground">location:</span> {location}
                </p>
              )}
              {!email && !phone && (
                <p className="max-w-md text-sm leading-7 text-muted-foreground">
                  Contact details will be added after the profile information is confirmed.
                </p>
              )}
              <p role="status" className="text-xs text-accent">
                {copyFeedback}
              </p>
              {(linkedin || github || resumeHref) && (
                <div className="flex flex-wrap gap-3 pt-4">
                  {linkedin && (
                    <Button variant="portfolio" asChild>
                      <a href={linkedin} target="_blank" rel="noopener noreferrer">
                        LinkedIn
                      </a>
                    </Button>
                  )}
                  {github && (
                    <Button variant="portfolio" asChild>
                      <a href={github} target="_blank" rel="noopener noreferrer">
                        GitHub
                      </a>
                    </Button>
                  )}
                  {resumeHref && (
                    <Button variant="portfolio" asChild>
                      <a href={resumeHref} download>
                        <FileDown /> Resume
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Reveal>

          {email && (
            <Reveal direction="right" delay={0.15}>
              <form onSubmit={submit} noValidate className="glass space-y-4 rounded-lg p-5 sm:p-8">
                {(["name", "email"] as const).map((key) => (
                  <div key={key}>
                    <label
                      htmlFor={`profile-contact-${key}`}
                      className="mb-2 block text-xs font-medium capitalize"
                    >
                      {key === "name" ? "Your name" : "Your email"}
                    </label>
                    <input
                      id={`profile-contact-${key}`}
                      aria-invalid={Boolean(errors[key])}
                      aria-describedby={errors[key] ? `profile-error-${key}` : undefined}
                      required
                      autoComplete={key}
                      type={key === "email" ? "email" : "text"}
                      value={form[key]}
                      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                      className={field}
                      maxLength={key === "email" ? 255 : 100}
                    />
                    {errors[key] && (
                      <p
                        id={`profile-error-${key}`}
                        role="alert"
                        className="mt-1 text-xs text-destructive"
                      >
                        {errors[key]}
                      </p>
                    )}
                  </div>
                ))}
                <div>
                  <label
                    htmlFor="profile-contact-message"
                    className="mb-2 block text-xs font-medium"
                  >
                    Message
                  </label>
                  <textarea
                    id="profile-contact-message"
                    required
                    aria-invalid={Boolean(errors["message"])}
                    aria-describedby={errors["message"] ? "profile-error-message" : undefined}
                    rows={5}
                    value={form.message}
                    onChange={(event) => setForm({ ...form, message: event.target.value })}
                    className={field}
                    maxLength={2000}
                  />
                  {errors["message"] && (
                    <p
                      id="profile-error-message"
                      role="alert"
                      className="mt-1 text-xs text-destructive"
                    >
                      {errors["message"]}
                    </p>
                  )}
                </div>
                <Button
                  variant="bare"
                  size="auto"
                  type="submit"
                  className="w-full cursor-pointer rounded-md bg-primary py-3 font-display text-xs font-bold text-primary-foreground transition-[box-shadow,transform] hover:shadow-neon active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2">
                    <Mail /> EMAIL {displayName.toUpperCase()}
                  </span>
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Opens your email app. Messages are not delivered by this website.
                </p>
                {feedback && (
                  <p role="status" className="text-xs leading-relaxed text-accent">
                    {feedback}
                  </p>
                )}
              </form>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
