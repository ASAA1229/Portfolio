import { useEffect, useRef, useState } from "react";
import { Bot, Send, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatPrivacyNotice } from "@/components/ChatPrivacyNotice";
import type { PersonPortfolio } from "@/lib/person-portfolios";
import { fallbackProfileAnswer } from "@/lib/profile-fallback";

type Message = { role: "user" | "assistant"; content: string };

function voiceFor(profile: PersonPortfolio) {
  const voices = window.speechSynthesis.getVoices();
  const isAmmu = profile.id === "ammu";
  const preferred = isAmmu
    ? /female|zira|samantha|aria|jenny|sonia|susan|google.*uk english female/i
    : /male|david|guy|ryan|george|mark|daniel|google.*uk english male/i;
  return (
    voices.find((voice) => preferred.test(voice.name) && /en(-|_)?(IN|GB|US)?/i.test(voice.lang)) ??
    voices.find((voice) => preferred.test(voice.name)) ??
    voices.find((voice) => /en-IN/i.test(voice.lang)) ??
    voices.find((voice) => voice.lang.startsWith("en"))
  );
}

export function PersonPortfolioAssistant({ profile }: { profile: PersonPortfolio }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const sendRef = useRef<(questionOverride?: string, mode?: "chat" | "intro") => Promise<void>>(
    async () => {},
  );
  const isAmmu = profile.id === "ammu";
  const voiceLabel = isAmmu ? "Female-style voice" : "Male-style voice";

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    const openAssistant = () => setOpen(true);
    const openIntro = () => {
      setOpen(true);
      void sendRef.current("Introduce this portfolio to a visitor.", "intro");
    };
    window.addEventListener("portfolio:open-ai-assistant", openAssistant);
    window.addEventListener("portfolio:open-ai-intro", openIntro);
    return () => {
      window.removeEventListener("portfolio:open-ai-assistant", openAssistant);
      window.removeEventListener("portfolio:open-ai-intro", openIntro);
    };
  }, []);

  useEffect(
    () => () => {
      controller.current?.abort();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  function speak(text: string) {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ""));
    const voice = voiceFor(profile);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-IN";
    utterance.rate = isAmmu ? 0.96 : profile.id === "bava" ? 0.91 : 1.02;
    utterance.pitch = isAmmu ? 1.13 : profile.id === "bava" ? 0.86 : 0.96;
    window.speechSynthesis.speak(utterance);
  }

  async function send(questionOverride?: string, mode: "chat" | "intro" = "chat") {
    const question = (questionOverride ?? input).trim();
    if (!question || busy) return;
    const history = [...messages, { role: "user" as const, content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;
    let answer = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person: profile.id,
          mode,
          page: window.location.pathname,
          messages: history.slice(-10),
        }),
      });
      if (!response.ok || !response.body) {
        let detail = "";
        try {
          const payload = (await response.clone().json()) as { error?: string };
          detail = payload.error ?? "";
        } catch {
          /* The server may return a non-JSON error page. */
        }
        const reason =
          response.status === 503 && detail.toLowerCase().includes("not configured")
            ? "The AI service is not configured on the server (missing OPENAI_API_KEY)."
            : response.status === 401 || response.status === 403
              ? "The AI service rejected its server credentials (HTTP " + response.status + ")."
              : response.status === 402
                ? "The AI service has no available credits or billing access (HTTP 402)."
                : response.status === 429
                  ? "The AI service rate limit was reached (HTTP 429). Please try again shortly."
                  : "The AI request failed (HTTP " + response.status + ").";
        throw new Error(reason);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }
      answer += decoder.decode();
      if (!answer.trim()) throw new Error("Empty AI response");
      setMessages([...history, { role: "assistant", content: answer }]);
    } catch (error) {
      if (abort.signal.aborted) return;
      const fallback = fallbackProfileAnswer(profile, question, mode);
      answer = `Live AI is currently unavailable, so I am answering from verified profile data instead.\n\n${fallback}`;
      setMessages([...history, { role: "assistant", content: answer }]);
    } finally {
      // A stopped request may finish after the user has already started another
      // one. Only the request that still owns the controller may clear busy state.
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
    if ((speakReplies || mode === "intro") && answer.trim() && !abort.signal.aborted) speak(answer);
  }
  function stopResponse() {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
  }

  sendRef.current = send;

  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
      {open ? (
        <section
          role="dialog"
          aria-label={`${profile.displayName} portfolio AI assistant`}
          className="flex h-[min(580px,calc(100svh-6rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          <header className="flex items-center gap-3 border-b border-border bg-background p-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Bot size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{profile.displayName}'s AI Assistant</h2>
              <p className="text-xs text-muted-foreground">Verified profile facts · {voiceLabel}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close assistant"
              onClick={() => {
                setOpen(false);
                window.speechSynthesis?.cancel();
              }}
            >
              <X size={18} />
            </Button>
          </header>
          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto p-4 text-sm"
            aria-live="polite"
          >
            <p className="text-muted-foreground">
              I use the latest published profile data and current page as context. Ask about skills,
              projects, experience, education, or ask me to introduce this portfolio. I won't invent
              missing facts.
            </p>
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "ml-8 rounded-lg bg-primary p-3 text-primary-foreground"
                    : "mr-3 whitespace-pre-wrap rounded-lg bg-secondary p-3"
                }
              >
                {message.content || (busy && index === messages.length - 1 ? "Thinking…" : "")}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <button
              type="button"
              className="flex items-center gap-2 text-xs text-muted-foreground"
              aria-pressed={speakReplies}
              onClick={() => {
                setSpeakReplies(!speakReplies);
                if (speakReplies) window.speechSynthesis?.cancel();
              }}
            >
              {speakReplies ? <Volume2 size={16} /> : <VolumeX size={16} />} Read replies aloud
            </button>
            {busy ? (
              <Button variant="ghost" size="sm" onClick={stopResponse}>
                Stop response
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.speechSynthesis?.cancel();
                  if (messages.length) speak(messages[messages.length - 1]?.content ?? "");
                }}
                disabled={!messages.some((m) => m.role === "assistant" && m.content)}
              >
                <Volume2 size={15} /> Replay
              </Button>
            )}
          </div>
          <ChatPrivacyNotice
            onClear={() => {
              controller.current?.abort();
              controller.current = null;
              if ("speechSynthesis" in window) window.speechSynthesis.cancel();
              setMessages([]);
              setBusy(false);
            }}
          />
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={1000}
              aria-label="Ask the portfolio assistant"
              placeholder="Ask about this portfolio…"
              className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim()}
              aria-label="Send question"
            >
              <Send size={17} />
            </Button>
          </form>
        </section>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="min-h-12 gap-2 rounded-full px-4 shadow-lg"
          aria-label={`Ask ${profile.displayName}'s AI assistant`}
        >
          <Bot size={18} /> Ask {profile.nickname}
        </Button>
      )}
    </div>
  );
}
