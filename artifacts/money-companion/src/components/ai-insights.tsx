import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { AudioLines, ChevronDown, Info, LoaderCircle, Mic, Sparkles, Square, Volume2 } from "lucide-react";
import { generateInsights } from "@/lib/ai-agent";
import { playClick, playError, playListenStart, playReceive, playSend, playSuccess } from "@/lib/sounds";
import { AgentActivity, SoundToggle, ThinkingBars } from "@/components/agent-activity";
import { useAiSettings } from "@/hooks/useAiSettings";
import type { CategoryRow, DashboardSummary, TransactionRow } from "@/lib/database.types";

export function AiInsightsCard({
  summary,
  recent,
  categories,
}: {
  summary: DashboardSummary | null | undefined;
  recent: TransactionRow[];
  categories: CategoryRow[];
}) {
  const { settings, configured } = useAiSettings();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("");
  const [stages, setStages] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Stop any spoken reply if the card unmounts.
    return () => {
      try {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  const stopSpeaking = () => {
    playClick();
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    setSpeaking(false);
  };

  const speakResult = (content: string) => {
    if (!content.trim()) return;
    try {
      if (!("speechSynthesis" in window)) {
        setError("Spoken replies are not available in this browser.");
        return;
      }
      window.speechSynthesis.cancel();
      const clean = content.replace(/[*_#`]/g, "").slice(0, 600);
      const u = new SpeechSynthesisUtterance(clean);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  };

  const recRef = useRef<any>(null);
  const heardTextRef = useRef<string>("");

  const finalizeListening = () => {
    setListening(false);
    const rec = recRef.current;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
      } catch {}
      recRef.current = null;
    }
    const heard = heardTextRef.current.trim();
    heardTextRef.current = "";
    if (heard) {
      setStage(`Heard: “${heard}”`);
      void run(true);
    }
  };

  const stopListening = () => {
    playClick();
    setListening(false);
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        finalizeListening();
        return;
      }
      setTimeout(() => {
        finalizeListening();
      }, 250);
    } else {
      finalizeListening();
    }
  };

  const startListening = () => {
    const w = window as Window & {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    };
    const Speech = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Speech) {
      setError("Speech input is not available in this browser. Press Generate instead.");
      return;
    }
    const isSecure = typeof window !== 'undefined' && (window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isSecure) {
      setError("Microphone on mobile requires a secure HTTPS connection. Please use your HTTPS URL or press Generate.");
      return;
    }

    if (recRef.current) {
      try { recRef.current.stop(); } catch {}
    }

    const rec = new Speech();
    recRef.current = rec;
    heardTextRef.current = "";
    const userLang = navigator.language || "en-US";
    const isApple = typeof navigator !== "undefined" && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    rec.lang = (isApple && userLang.startsWith("ne")) ? "en-US" : userLang;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => {
      setListening(true);
      setError("");
    };
    rec.onresult = (e: any) => {
      let combined = "";
      for (let i = 0; i < e.results.length; i++) {
        const chunk = e.results[i][0]?.transcript || "";
        if (chunk) {
          if (combined && !combined.endsWith(" ") && !chunk.startsWith(" ")) {
            combined += " ";
          }
          combined += chunk;
        }
      }
      const heard = combined.trim();
      if (heard) heardTextRef.current = heard;
    };
    rec.onerror = (e: any) => {
      playError();
      setListening(false);
      recRef.current = null;
      const err = e?.error;
      if (err === "not-allowed") {
        setError("Microphone permission denied. Allow mic in browser settings.");
      } else if (err === "no-speech") {
        if (heardTextRef.current.trim()) {
          finalizeListening();
          return;
        }
        setError("No speech detected. Tap mic again and speak clearly.");
      } else if (err === "service-not-allowed") {
        setError("Dictation is disabled on your device. On iPhone: Go to Settings → General → Keyboard → Turn ON 'Enable Dictation'.");
      } else if (err !== "aborted") {
        setError("Could not hear clearly. Press Generate instead.");
      }
    };
    rec.onend = () => {
      finalizeListening();
    };
    try {
      rec.start();
    } catch {
      setListening(false);
      recRef.current = null;
      setError("Could not start microphone. Press Generate instead.");
    }
  };

  const toggleListening = () => {
    if (listening) {
      stopListening();
    } else {
      playClick();
      startListening();
    }
  };

  const stageRef = useRef(false);
  const pushStage = (s: string) => {
    setStage(s);
    setStages((prev) => (prev.includes(s) ? prev : [...prev, s]));
  };
  const stopSpeakingSilent = () => {
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    setSpeaking(false);
  };

  const run = async (speak = false) => {
    if (!summary) return;
    if (!configured) {
      playError();
      setError("Connect a free AI key first (AI & Agent page).");
      return;
    }
    playSend();
    stopSpeakingSilent();
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setError("");
    setText("");
    setStage("Reading your notes…");
    setStages(["Reading your recent notes…"]);
    setStartedAt(Date.now());
    try {
      pushStage("Finding patterns…");
      const full = await generateInsights(
        settings,
        summary,
        recent,
        categories,
        (t) => {
          if (!stageRef.current) {
            stageRef.current = true;
            pushStage("Writing your summary…");
          }
          setText((prev) => prev + t);
        },
        ctrl.signal,
      );
      pushStage("Done.");
      playReceive();
      if (speak) {
        playSuccess();
        speakResult(full);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        playClick();
        pushStage("Stopped.");
      } else {
        playError();
        setError(e instanceof Error ? e.message : "Could not generate insights.");
        setStage("");
      }
    } finally {
      setBusy(false);
      setStartedAt(null);
      stageRef.current = false;
    }
  };

  return (
    <section className="mb-7 overflow-hidden rounded-[28px] border border-border bg-card p-6 soft-shadow sm:p-7" data-testid="ai-insights">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
            <Sparkles size={13} /> Agent insights
          </p>
          <h2 className="serif mt-1.5 text-[24px] tracking-[-.02em]">What is your money saying?</h2>
          <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-muted-foreground">
            {configured
              ? "Uses your connected free key, in this browser only. Numbers come only from your notes."
              : "Connect a free OpenRouter or Gemini key to let the agent read your notes and summarise them."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              playClick();
              setShowDetails((v) => !v);
            }}
            title="What happens when I press Generate? Click for step-by-step details."
            aria-expanded={showDetails}
            aria-label="How insights work"
            className={`grid h-10 w-10 place-items-center rounded-full border transition ${showDetails ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            data-testid="button-insights-how"
          >
            <Info size={16} />
          </button>
          <SoundToggle testid="button-insights-sound" />
          {busy ? (
            <button
              onClick={() => {
                playClick();
                abortRef.current?.abort();
              }}
              title="Stop generating — click for details: keeps the partial summary, plays a soft click"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-xs font-bold transition hover:bg-muted active:scale-95"
              data-testid="button-insights-stop"
            >
              <LoaderCircle size={13} className="animate-spin" /> Stop
            </button>
          ) : (
            <>
              <button
                onClick={() => void run(false)}
                title="Generate insights — click for details: whoosh sound, agent reads your notes, finds patterns, streams a summary with a ding when done"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition hover:-translate-y-0.5 active:scale-95"
                data-testid="button-generate-insights"
              >
                {busy ? <ThinkingBars /> : <Sparkles size={14} />} {text ? "Refresh insights" : "Generate insights"}
              </button>
              <button
                onClick={toggleListening}
                disabled={busy}
                title={listening ? "Listening… click again to finish and generate insights" : "Ask by voice — click to start, click again to finish"}
                aria-label={listening ? "Stop listening and generate insights" : "Ask for insights by voice"}
                className={`grid h-10 w-10 place-items-center rounded-full transition active:scale-90 ${listening ? "animate-pulse bg-[#b76654] text-white ring-4 ring-[#b76654]/30" : "border border-border text-muted-foreground hover:text-foreground"}`}
                data-testid="button-insights-mic"
              >
                {listening ? <Square size={16} className="fill-current text-white" /> : <Mic size={17} />}
              </button>
              {speaking ? (
                <button
                  onClick={stopSpeaking}
                  title="Stop speaking — click for details: silences the voice immediately"
                  aria-label="Stop speaking"
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#b76654] text-white transition active:scale-90"
                  data-testid="button-insights-stop-speaking"
                >
                  <Square size={15} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    playClick();
                    speakResult(text);
                  }}
                  disabled={!text || busy}
                  title="Read insights aloud — click for details: speaks the summary in your browser voice"
                  aria-label="Read insights aloud"
                  className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-foreground active:scale-90 disabled:opacity-40"
                  data-testid="button-insights-speak"
                >
                  <Volume2 size={17} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {showDetails && (
        <div className="mt-3 rounded-[18px] border border-border bg-muted/50 p-4 text-[12px] leading-relaxed text-muted-foreground" data-testid="insights-how-it-works">
          <p className="font-bold text-foreground">What happens when you press Generate?</p>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
            <li><b>Whoosh</b> — your request starts; soft thinking ticks play while it works.</li>
            <li><b>Reading notes</b> — the agent loads recent notes + balances. Only your real numbers are used.</li>
            <li><b>Finding patterns</b> — top spending areas and month income vs expenses are compared.</li>
            <li><b>Ding</b> — the summary streams in live. Tap any step below for details.</li>
          </ol>
          <button
            onClick={() => {
              playClick();
              setShowDetails(false);
            }}
            className="mt-2 inline-flex items-center gap-1 font-bold text-primary hover:underline"
            data-testid="button-insights-hide-how"
          >
            Got it <ChevronDown size={13} className="rotate-180" />
          </button>
        </div>
      )}
      {listening && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground" data-testid="text-insights-listening">
          <AudioLines size={13} className="animate-pulse" /> Listening… say “tell me my spending” or anything — I'll generate.
        </p>
      )}

      {stages.length > 0 && (
        <div className="mt-4">
          <AgentActivity steps={stages} busy={busy} startedAt={startedAt} testid="insights-steps" />
        </div>
      )}
      {/* Screen-reader / legacy hook kept for existing tests */}
      {stage && busy && (
        <p className="sr-only" data-testid="text-insights-stage">
          {stage}
        </p>
      )}
      {error && (
        <div className="mt-4 rounded-xl bg-[#f5e5df] px-4 py-3 text-[13px] text-[#914e40]" role="alert" data-testid="status-insights-error">
          {error}{" "}
          {!configured && (
            <Link href="/ai" className="font-bold underline underline-offset-2">
              Go to AI &amp; Agent
            </Link>
          )}
        </div>
      )}
      {text ? (
        <div className="mt-4 whitespace-pre-wrap rounded-[18px] bg-[#eee8d9] p-4 text-[13.5px] leading-relaxed text-[#304036]" data-testid="text-insights-result">
          {text}
          {busy && <span className="animate-pulse">▍</span>}
        </div>
      ) : (
        !error && (
          <div className="mt-4 rounded-[18px] border border-dashed border-border p-4 text-[12px] text-muted-foreground">
            No insights yet — press Generate, or tap the mic and speak. Nothing is sent anywhere until you do.
          </div>
        )
      )}
    </section>
  );
}
