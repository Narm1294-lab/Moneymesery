import { useEffect, useState } from "react";
import {
  AudioLines,
  Brain,
  Check,
  ChevronDown,
  Database,
  FileSearch,
  LoaderCircle,
  PencilLine,
  Volume2,
  VolumeX,
} from "lucide-react";
import { isSoundEnabled, playClick, setSoundEnabled } from "@/lib/sounds";

/** Human-friendly explanation for every agent step. Click a step to expand it. */
export const STEP_DETAILS: Record<string, string> = {
  "Listening…": "Capturing your voice or text. Nothing is sent anywhere until you press send.",
  "Reading your recent notes…": "Loading your last 25 notes, categories and balances from this device so the reply uses only your real numbers.",
  "Thinking…": "The AI is reasoning over your message + money context and drafting a reply. This streams back live.",
  "Finding patterns…": "Scanning income vs expenses and top categories to spot trends worth mentioning.",
  "Writing your summary…": "Composing your personalised summary, token by token. You can stop it any time.",
  "Draft ready — review before saving.": "The agent prepared a note draft below. Check the amount + category, then press Save note.",
  "Loan draft ready — review before saving.": "A loan record is ready in the card below. Review who owes whom, then confirm.",
  "Repayment draft ready — review before saving.": "A repayment draft is ready. The app splits interest-first automatically — just confirm.",
  "Idea draft ready — review before saving.": "Your big-money idea is captured. Confirm to run the full feasibility math on the Ideas page.",
  "Done.": "Finished. Ask a follow-up or save the draft.",
  "Stopped.": "You stopped the reply. The partial text is kept so nothing is lost.",
};

function stepIcon(step: string) {
  if (step.startsWith("Listening")) return <AudioLines size={13} />;
  if (step.startsWith("Reading")) return <Database size={13} />;
  if (step.startsWith("Thinking")) return <Brain size={13} />;
  if (step.startsWith("Finding")) return <FileSearch size={13} />;
  if (step.startsWith("Writing")) return <PencilLine size={13} />;
  if (step.includes("ready")) return <Check size={13} />;
  return <LoaderCircle size={13} className="animate-spin" />;
}

/** Pulsing equalizer bars shown while the agent is working. */
export function ThinkingBars() {
  return (
    <span className="agent-eq" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="agent-eq-bar" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

/** Animated three-dot typing indicator. */
export function TypingDots() {
  return (
    <span className="agent-dots" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="agent-dot" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  );
}

/** Sound on/off toggle used in agent headers. */
export function SoundToggle({ testid = "button-sound-toggle" }: { testid?: string }) {
  const [on, setOn] = useState(isSoundEnabled());
  return (
    <button
      onClick={() => {
        const next = !on;
        setOn(next);
        setSoundEnabled(next);
        if (next) playClick();
      }}
      title={on ? "Mute interface sounds (click for details: dings, whooshes & ticks off)" : "Unmute interface sounds (click for details: dings, whooshes & ticks on)"}
      aria-pressed={on}
      aria-label={on ? "Mute interface sounds" : "Unmute interface sounds"}
      className={`rounded-full p-2 transition ${on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
      data-testid={testid}
    >
      {on ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}

/**
 * Interactive activity timeline: each step is a button — click it to see
 * exactly what the agent is doing at that stage. Shows elapsed time while busy.
 */
export function AgentActivity({
  steps,
  busy,
  startedAt,
  testid = "assistant-steps",
}: {
  steps: string[];
  busy: boolean;
  startedAt: number | null;
  testid?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!busy || !startedAt) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [busy, startedAt]);

  if (steps.length === 0) return null;
  return (
    <div className="flex justify-start" data-testid={testid}>
      <div className="w-auto max-w-[70%] rounded-xl border border-border bg-muted/60 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {busy ? <ThinkingBars /> : <Check size={12} className="text-primary" />}
            {busy ? "Working" : "Activity"}
            {busy && elapsed > 0 && <span className="font-mono normal-case tracking-normal">· {elapsed}s</span>}
          </p>
          <p className="text-[9px] text-muted-foreground">tap for details</p>
        </div>
        <div className="mt-1 space-y-0.5">
          {steps.map((s, i) => {
            const isLast = i === steps.length - 1;
            const active = busy && isLast;
            const detail = STEP_DETAILS[s] ?? "The agent is working on this stage. Click to collapse.";
            const expanded = open === s;
            return (
              <button
                key={`${s}-${i}`}
                onClick={() => {
                  playClick();
                  setOpen(expanded ? null : s);
                }}
                aria-expanded={expanded}
                title={`What does "${s}" mean? Click for details.`}
                className={`flex w-full flex-col rounded-lg px-2 py-1 text-left text-[11px] transition hover:bg-background ${
                  active ? "bg-background font-semibold text-foreground" : "text-muted-foreground"
                }`}
                data-testid={`step-${i}`}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className={active ? "text-primary" : ""}>{stepIcon(s)}</span>
                  <span className="flex-1">
                    {s}
                    {active && busy && <TypingDots />}
                  </span>
                  {active && busy ? (
                    <LoaderCircle size={12} className="animate-spin text-primary" />
                  ) : (
                    <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                  )}
                </span>
                {expanded && <span className="mt-0.5 pl-5 text-[10px] font-normal leading-relaxed text-muted-foreground">{detail}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Quick prompts — each button explains itself and fills the input on click. */
export function QuickPrompts({ onPick, symbol }: { onPick: (text: string) => void; symbol: string }) {
  const prompts = [
    { label: "Explain my spending", detail: "Asks the agent to summarise where your money went this month.", text: "Explain my spending this month — top categories and one tip." },
    { label: `Log lunch ${symbol}25`, detail: "Dictates a draft expense note you review before saving.", text: `Spent ${symbol}25 on lunch` },
    { label: "Lent money?", detail: "Starts a loan draft — the agent asks who + how much.", text: "I lent money to a friend" },
    { label: "Big idea?", detail: "Starts an idea draft with cost + return questions.", text: "I want to start a small shop" },
  ];
  const [hint, setHint] = useState<string | null>(null);
  return (
    <div className="px-1 pb-1">
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              playClick();
              onPick(p.text);
            }}
            onMouseEnter={() => setHint(p.detail)}
            onFocus={() => setHint(p.detail)}
            onMouseLeave={() => setHint(null)}
            title={`${p.label} — ${p.detail} (click to use)`}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:border-primary hover:text-primary active:scale-95"
            data-testid={`quick-prompt-${p.label}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
