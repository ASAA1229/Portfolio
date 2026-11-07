import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Minus, Send, X, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fallbackAnswer, SUGGESTED_PROMPTS, type ChatMessage } from "@/lib/portfolio-chat";
import { MOTION_TOKENS } from "@/lib/motion";

const uid = () => Math.random().toString(36).slice(2);
const time = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Light markdown: **bold** and "- " bullets, rendered safely as React nodes. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-*] /.test(line);
        const parts = line
          .replace(/^\s*[-*] /, "")
          .split(/(\*\*[^*]+\*\*)/g)
          .map((p, j) =>
            p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p,
          );
        return bullet ? (
          <p
            key={i}
            className="pl-3 before:-ml-3 before:mr-1.5 before:content-['•'] before:text-primary"
          >
            {parts}
          </p>
        ) : (
          <p key={i} className={line ? "" : "h-2"}>
            {parts}
          </p>
        );
      })}
    </>
  );
}

async function askAi(
  history: ChatMessage[],
  onDelta: (t: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      person: "abhishek",
      page: window.location.pathname,
      mode: "chat",
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok || !res.body) {
    let detail = "";
    try {
      const payload = (await res.clone().json()) as { error?: string };
      detail = payload.error ?? "";
    } catch {
      /* The server may return a non-JSON error page. */
    }
    const reason =
      res.status === 503 && detail.toLowerCase().includes("not configured")
        ? "The AI service is not configured on the server (missing OPENAI_API_KEY)."
        : res.status === 401 || res.status === 403
          ? "The AI service rejected its server credentials (HTTP " + res.status + ")."
          : res.status === 402
            ? "The AI service has no available credits or billing access (HTTP 402)."
            : res.status === 429
              ? "The AI service rate limit was reached (HTTP 429). Please try again shortly."
              : "The AI request failed (HTTP " + res.status + ").";
    throw new Error(reason);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let got = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const t = dec.decode(value, { stream: true });
    got += t;
    onDelta(t);
  }
  const finalText = dec.decode();
  if (finalText) {
    got += finalText;
    onDelta(finalText);
  }
  if (!got.trim()) throw new Error("empty");
  return got;
}

export function PortfolioChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function speak(text: string) {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ""));
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find(
        (item) =>
          /male|david|guy|ryan|george|mark|daniel/i.test(item.name) && item.lang.startsWith("en"),
      ) ??
      voices.find((item) => item.lang === "en-IN") ??
      voices.find((item) => item.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-IN";
    utterance.rate = 1.04;
    utterance.pitch = 1.04;
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, busy]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  };

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const user: ChatMessage = { id: uid(), role: "user", content: q, at: Date.now() };
    const history = [...messages, user];
    const replyId = uid();
    setMessages([
      ...history,
      { id: replyId, role: "assistant", content: "", at: Date.now(), source: "ai" },
    ]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patch = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages((ms) => ms.map((m) => (m.id === replyId ? fn(m) : m)));
    try {
      const answer = await askAi(
        history.slice(-12),
        (d) => {
          if (abortRef.current === ctrl && !ctrl.signal.aborted) {
            patch((m) => ({ ...m, content: m.content + d }));
          }
        },
        ctrl.signal,
      );
      if (speakReplies && abortRef.current === ctrl && !ctrl.signal.aborted) speak(answer);
    } catch (error) {
      if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
      const fallback = fallbackAnswer(q);
      const reason =
        error instanceof Error && error.message ? error.message : "The request failed.";
      const answer = `${fallback}\n\nLive AI status: ${reason}`;
      patch((m) => ({ ...m, content: answer, source: "fallback" }));
      if (speakReplies && abortRef.current === ctrl && !ctrl.signal.aborted) speak(answer);
    } finally {
      // A cleared or superseded request must not change the state of a newer one.
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
    if (e.key === "Escape") close();
  };

  return (
    <AnimatePresence mode="wait">
      {!open ? (
        <motion.div
          key="chat-launcher"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION_TOKENS.duration.micro, ease: MOTION_TOKENS.ease.entrance }}
          className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6"
          data-motion-entrance
        >
          <Button
            ref={launcherRef}
            onClick={() => setOpen(true)}
            className="min-h-12 gap-2 rounded-full px-4 shadow-lg transition-transform hover:scale-105 active:scale-95"
            aria-label="Open portfolio assistant chat"
          >
            <Bot /> <span className="hidden sm:inline">Ask about Abhishek</span>
          </Button>
        </motion.div>
      ) : (
        <motion.section
          key="chat-panel"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Portfolio assistant"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
              return;
            }
            if (e.key !== "Tab") return;

            const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (!focusable?.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last) return;
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: MOTION_TOKENS.duration.dialog,
            ease: MOTION_TOKENS.ease.entrance,
          }}
          className="fixed inset-x-2 bottom-2 z-50 flex h-[min(600px,calc(100svh-5rem))] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px]"
          data-motion-entrance
        >
          <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
            <span className="grid size-9 place-items-center rounded-sm bg-primary font-display text-lg font-bold text-primary-foreground">
              A
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg leading-tight">Portfolio Assistant</h2>
              <p className="text-[10px] text-muted-foreground">
                Answers from Abhishek's portfolio only
              </p>
            </div>
            <Button
              variant="bare"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label={speakReplies ? "Turn off spoken replies" : "Turn on spoken replies"}
              aria-pressed={speakReplies}
              onClick={() => {
                setSpeakReplies(!speakReplies);
                if (speakReplies) window.speechSynthesis?.cancel();
              }}
            >
              {speakReplies ? <Volume2 /> : <VolumeX />}
            </Button>
            <Button
              variant="bare"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Minimize chat"
              onClick={close}
            >
              <Minus />
            </Button>
            <Button
              variant="bare"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Close and clear chat"
              onClick={() => {
                abortRef.current?.abort();
                abortRef.current = null;
                setMessages([]);
                setBusy(false);
                close();
              }}
            >
              <X />
            </Button>
          </header>
          <div
            ref={listRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm"
            aria-live="polite"
          >
            <div className="space-y-1 text-sm leading-6">
              <p>
                Hi! I can tell you about Abhishek's skills, experience, projects, certifications and
                how to reach him.
              </p>
              <p className="text-[10px] text-muted-foreground">
                Please don't share sensitive personal information.
              </p>
            </div>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((p) => (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-9 whitespace-normal py-1.5 text-left text-xs transition-colors hover:border-primary hover:bg-secondary"
                    onClick={() => void send(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"
                }
              >
                {m.content ? (
                  <div
                    className={`transition-all ${m.role === "user" ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground shadow-sm" : "max-w-[95%] space-y-1 leading-6"}`}
                  >
                    <Rich text={m.content} />
                  </div>
                ) : (
                  <div className="flex gap-1 py-2" aria-label="Assistant is typing">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                )}
                <span className="mt-1 text-[9px] text-muted-foreground">
                  {time(m.at)}
                  {m.source === "fallback" ? " · offline answer from portfolio data" : ""}
                </span>
              </div>
            ))}
          </div>
          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="chat-input" className="sr-only">
              Ask a question
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              maxLength={1000}
              placeholder="Ask about skills, projects…"
              className="max-h-28 min-h-11 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring"
            />
            <Button
              type="submit"
              size="icon"
              className="min-h-11 min-w-11 transition-transform active:scale-95"
              disabled={busy || !input.trim()}
              aria-label="Send message"
            >
              <Send />
            </Button>
          </form>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
