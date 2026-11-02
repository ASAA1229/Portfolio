import { useEffect, useRef, useState } from "react";
import { Bot, Pause, Play, RotateCcw, ArrowRight, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeveloperMark } from "@/components/DeveloperMark";
import my1 from "@/assets/my_1.jpeg";
import videoSet from "@/assets/video_set.mp4";

export function DynamicIntroPlayer() {
  const [intro, setIntro] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function generate() {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person: "abhishek",
            mode: "intro",
            page: window.location.pathname,
            messages: [{ role: "user", content: "Introduce this portfolio to a visitor." }],
          }),
        });
        if (!response.ok || !response.body) throw new Error("AI intro unavailable");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setIntro(text);
        }
        if (!text.trim()) throw new Error("Empty AI intro");
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void generate();
    return () => {
      controller.abort();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    void element.play().catch(() => undefined);
    return () => element.pause();
  }, []);

  function playVoice() {
    if (!intro.trim() || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(intro.replace(/[*#`]/g, ""));
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((item) => /male|david|guy|ryan|george|mark|daniel/i.test(item.name) && item.lang.startsWith("en"))
      ?? voices.find((item) => item.lang === "en-IN")
      ?? voices.find((item) => item.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-IN";
    utterance.rate = 1.02;
    utterance.pitch = 0.96;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function pauseVoice() {
    if (!("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setSpeaking(false);
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setSpeaking(true);
    }
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          <div className="flex aspect-[768/1052] items-center justify-center overflow-hidden rounded border border-border bg-secondary">
            <video
              ref={video}
              src={videoSet}
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
              aria-label="AI portfolio host video"
              className="h-full w-full object-contain"
              onError={(event) => { event.currentTarget.hidden = true; }}
            />
            <DeveloperMark className="hidden h-28 w-28" />
          </div>
          <p className="flex items-center gap-2 text-xs font-semibold">
            <Bot className="size-4 text-primary" /> AI portfolio host
          </p>
          <figure>
            <img src={my1} alt="Portrait of Guda Abhishek" className="aspect-square w-16 rounded object-cover" />
            <figcaption className="mt-1 text-xs text-muted-foreground">Guda Abhishek · portfolio owner</figcaption>
          </figure>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <p className="mb-3 text-[10px] uppercase text-primary">LIVE PORTFOLIO CONTEXT · AI INTRODUCTION</p>
            <p className="whitespace-pre-wrap text-sm leading-7" aria-live="polite">
              {loading && !intro ? "Building an introduction from the latest published portfolio information…" : intro || "The live introduction is unavailable right now."}
            </p>
            {error && <p role="status" className="mt-3 text-xs leading-5 text-muted-foreground">The AI service could not be reached. Try again later; the portfolio itself remains available.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={speaking ? pauseVoice : playVoice} disabled={!intro.trim() || loading}>
              {speaking ? <Pause /> : <Play />} {speaking ? "Pause voice" : "Play introduction"}
            </Button>
            <Button variant="outline" className="min-h-11" onClick={playVoice} disabled={!intro.trim() || loading}>
              <RotateCcw /> Replay
            </Button>
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><Volume2 className="size-4" /> Optional device voice</span>
          </div>
        </div>
      </div>
      <p className="border-y border-border py-3 text-xs leading-5 text-muted-foreground">
        The introduction is generated from the current published portfolio data each time this panel opens. Browser narration uses an available device voice; it is not a cloned voice.
      </p>
    </>
  );
}

export function AiIntro({
  compact = false,
  controlledOpen,
  onControlledOpenChange,
}: {
  compact?: boolean;
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onControlledOpenChange?.(next);
    if (!next && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className={`min-h-11 ${compact ? "text-xs" : "px-5"}`}>
          <Bot /> Meet my AI intro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg p-5 sm:p-7">
        <DialogTitle className="pr-9 font-display text-3xl leading-tight">Meet Abhishek</DialogTitle>
        <DialogDescription className="pr-4 text-xs leading-5">
          A live, profile-aware introduction generated from verified portfolio information.
        </DialogDescription>
        {open && <DynamicIntroPlayer />}
        <DialogClose asChild>
          <Button variant="ghost" className="min-h-11"><ArrowRight /> Close introduction</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
