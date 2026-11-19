import { Link } from "@tanstack/react-router";

/**
 * Minimal, always-visible consent notice for the portfolio assistants (PORT-US-039).
 * Must stay accurate with the server: messages are processed by the owner's AI
 * (JARVIS) to answer; the portfolio stores no chat transcripts, only per-request
 * rate-limit/operational counters without message text.
 */
export function ChatPrivacyNotice({ onClear }: { onClear?: () => void }) {
  return (
    <p className="border-t border-border px-3 pt-2 text-[10px] leading-4 text-muted-foreground">
      Your questions are sent to the site owner&apos;s own AI (JARVIS) only to answer them. This
      site does not store chat transcripts; the conversation lives only in this browser tab.{" "}
      {onClear && (
        <button type="button" onClick={onClear} className="underline hover:text-foreground">
          Clear my chat
        </button>
      )}
      {onClear ? " · " : ""}
      <Link to="/privacy" className="underline hover:text-foreground">
        Privacy
      </Link>
    </p>
  );
}
