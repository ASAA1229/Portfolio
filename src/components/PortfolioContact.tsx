import { useState, type FormEvent } from "react";
import { Copy, Check, FileDown, Mail, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { contactSchema, PORTFOLIO_FILES } from "@/lib/contact-schema";
import { CONTACT } from "@/lib/portfolio-data";
import { usePublishedProfileResume } from "@/lib/published-resume";

export function PortfolioContact() {
  const published = usePublishedProfileResume("abhishek");
  const email = published?.contact?.email || CONTACT.email;
  const phone = published?.contact?.phone || CONTACT.phone;
  const linkedin = published?.contact?.linkedin || CONTACT.linkedin;
  const github = published?.contact?.github || CONTACT.github;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFeedback("");
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
    setIsSubmitting(true);
    const data = result.data;
    const body = `${data.message}\n\n— ${data.name} (${data.email})`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(body)}`;
    setFeedback(
      "Email draft prepared. Send it in your email app; no message has been sent from this website.",
    );
    setTimeout(() => setIsSubmitting(false), 800);
  };

  const copy = async () => {
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-all">
                  <span className="text-muted-foreground">email:</span>{" "}
                  <a href={`mailto:${email}`} className="transition-colors hover:text-accent">
                    {email}
                  </a>
                </span>
                <Button
                  variant="bare"
                  size="auto"
                  onClick={copy}
                  aria-label="Copy email"
                  className="min-h-11 min-w-11 rounded border border-border px-2 py-1 text-xs transition-colors hover:border-accent hover:text-accent active:scale-95"
                >
                  {copied ? <Check className="text-profile-green" /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p>
                <span className="text-muted-foreground">phone:</span>{" "}
                <a
                  href={`tel:${phone.replace(/[^+0-9]/g, "")}`}
                  className="transition-colors hover:text-accent"
                >
                  {phone}
                </a>
              </p>
              <p>
                <span className="text-muted-foreground">location:</span> {CONTACT.location}
              </p>
              <p role="status" className="text-xs text-accent transition-opacity">
                {copyFeedback}
              </p>
              <div className="flex flex-wrap gap-3 pt-4">
                {linkedin && (
                  <Button
                    variant="portfolio"
                    asChild
                    className="transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <a href={linkedin} target="_blank" rel="noopener noreferrer">
                      LinkedIn
                    </a>
                  </Button>
                )}
                {github && (
                  <Button
                    variant="portfolio"
                    asChild
                    className="transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <a href={github} target="_blank" rel="noopener noreferrer">
                      GitHub
                    </a>
                  </Button>
                )}
                {PORTFOLIO_FILES.resume ? (
                  <Button
                    variant="portfolio"
                    asChild
                    className="transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <a href={PORTFOLIO_FILES.resume} download>
                      <FileDown /> Resume
                    </a>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Resume PDF available after upload</p>
                )}
              </div>
            </div>
          </Reveal>

          <Reveal direction="right" delay={0.15}>
            <form onSubmit={submit} noValidate className="glass space-y-4 rounded-lg p-5 sm:p-8">
              {(["name", "email"] as const).map((k) => (
                <div key={k}>
                  <label
                    htmlFor={`contact-${k}`}
                    className="mb-2 block text-xs font-medium capitalize"
                  >
                    {k}
                  </label>
                  <input
                    id={`contact-${k}`}
                    aria-invalid={Boolean(errors[k])}
                    aria-describedby={errors[k] ? `error-${k}` : undefined}
                    required
                    autoComplete={k}
                    aria-label={k}
                    placeholder={k.charAt(0).toUpperCase() + k.slice(1)}
                    type={k === "email" ? "email" : "text"}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className={field}
                    maxLength={k === "email" ? 255 : 100}
                  />
                  {errors[k] && (
                    <p
                      id={`error-${k}`}
                      role="alert"
                      className="mt-1 text-xs text-destructive animate-in fade-in slide-in-from-top-1"
                    >
                      {errors[k]}
                    </p>
                  )}
                </div>
              ))}
              <div>
                <label htmlFor="contact-message" className="mb-2 block text-xs font-medium">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  aria-invalid={Boolean(errors["message"])}
                  aria-describedby={errors["message"] ? "error-message" : undefined}
                  aria-label="message"
                  placeholder="Message"
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className={field}
                  maxLength={2000}
                />
                {errors["message"] && (
                  <p
                    id="error-message"
                    role="alert"
                    className="mt-1 text-xs text-destructive animate-in fade-in slide-in-from-top-1"
                  >
                    {errors["message"]}
                  </p>
                )}
              </div>
              <Button
                variant="bare"
                size="auto"
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="w-full cursor-pointer rounded-md bg-primary py-3 font-display text-xs font-bold text-primary-foreground transition-[box-shadow,transform,opacity] hover:shadow-neon active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2" aria-live="polite">
                    <SendHorizontal className="animate-pulse" /> PREPARING EMAIL...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail /> OPEN EMAIL APP
                  </span>
                )}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Opens your email app. Messages are not delivered by this website.
              </p>
              {feedback && (
                <p role="status" className="text-xs leading-relaxed text-accent animate-in fade-in">
                  {feedback}
                </p>
              )}
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
