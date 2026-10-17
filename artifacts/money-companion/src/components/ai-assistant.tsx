import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AudioLines,
  Check,
  ChevronDown,
  Info,
  LoaderCircle,
  MessageCircle,
  Mic,
  Pencil,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { runChatAgent, matchCategoryName, stripCodeBlocks, type AgentDraft, type IdeaDraft, type LoanDraft } from "@/lib/ai-agent";
import { playClick, playError, playListenStart, playPop, playReceive, playSend, playSuccess, playThinkingTick } from "@/lib/sounds";
import { AgentActivity, QuickPrompts, SoundToggle, TypingDots } from "@/components/agent-activity";
import { useAiSettings } from "@/hooks/useAiSettings";
import { useCurrency } from "@/hooks/useCurrency";
import { useCreateTransaction, useLoans, useSaveIdea } from "@/hooks/useFinance";
import { ttsSpeak, ttsCancel, LANG_TO_LOCALE } from "@/lib/tts";
import type { CategoryRow, DashboardSummary, TransactionRow } from "@/lib/database.types";
import { AiSettingsPanel } from "@/components/ai-settings";
import { LoanDraftCard } from "@/components/loan-draft-card";
import { IdeaDraftCard } from "@/components/idea-draft-card";

interface ChatMsg {
  id: number;
  role: "user" | "assistant";
  content: string;
  draft?: AgentDraft | null;
  loanDraft?: LoanDraft | null;
  ideaDraft?: IdeaDraft | null;
  pending?: boolean;
}

let idCounter = 1;


export function AiAssistantFloating({
  summary,
  recent,
  categories,
}: {
  summary: DashboardSummary | null | undefined;
  recent: TransactionRow[];
  categories: CategoryRow[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          playPop();
          setOpen(true);
        }}
        aria-label="Open AI assistant"
        title="Open AI assistant — chat, dictate notes, review drafts before saving. Click for the interactive agent."
        className="fixed bottom-[76px] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary p-3.5 text-primary-foreground shadow-xl transition hover:-translate-y-0.5 active:scale-95 md:bottom-8 md:right-8"
        data-testid="button-open-assistant"
      >
        <MessageCircle size={22} />
      </button>
      {open && (
        <AiAssistantSheet
          summary={summary}
          recent={recent}
          categories={categories}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function AiAssistantSheet({
  summary,
  recent,
  categories,
  onClose,
}: {
  summary: DashboardSummary | null | undefined;
  recent: TransactionRow[];
  categories: CategoryRow[];
  onClose: () => void;
}) {
  const { settings, configured } = useAiSettings();
  const { currency, symbol, formatMoney: fmt, aiLanguage } = useCurrency();
  const create = useCreateTransaction();
  const loansQuery = useLoans();
  const loans = loansQuery.data ?? [];
  const speechLocale = aiLanguage === 'auto'
    ? 'auto'
    : (LANG_TO_LOCALE[aiLanguage] ?? 'en-US');

  const greetingByLang: Record<string, string> = {
    auto: `Hello! I'm your Money Companion. Talk to me in any language! Try: "Spent ${symbol}25 on lunch", "Lent ${symbol}100 to Sarah".`,
    en: `Hello! I'm your Money Companion. Try: "Spent ${symbol}25 on lunch" or "Lent ${symbol}100 to Sarah".`,
    ne: `नमस्ते! म तपाईंको Money Companion हुँ। जुनसुकै भाषामा कुरा गर्नुस्! उदाहरण: "${symbol}500 खाजामा खर्च गरे" वा "${symbol}1000 रामलाई दिए"।`,
    hi: `नमस्ते! मैं आपका Money Companion हूँ। किसी भी भाषा में बात करें! जैसे: "${symbol}200 खाने पर खर्च किया" या "${symbol}500 राम को दिए"।`,
    es: `¡Hola! Soy tu Money Companion. ¡Habla en cualquier idioma! Ejemplo: "Gasté ${symbol}25 en almuerzo" o "Presté ${symbol}100 a Juan".`,
    fr: `Bonjour! Je suis votre Money Companion. Parlez dans n'importe quelle langue! Exemple: "Dépensé ${symbol}25 pour le déjeuner" ou "Prêté ${symbol}100 à Marie".`,
    de: `Hallo! Ich bin Ihr Money Companion. Sprechen Sie in jeder Sprache! Beispiel: "${symbol}25 für Mittagessen ausgegeben" oder "${symbol}100 an Lisa geliehen".`,
    zh: `你好！我是您的Money Companion。用任何语言交流！例如："午餐花了${symbol}25" 或 "借给王先生${symbol}100"。`,
    ja: `こんにちは！Money Companionです。どの言語でも話せます！例："ランチに${symbol}25使いました" や "田中さんに${symbol}100貸しました"。`,
    ar: `مرحبا! أنا مساعدك المالي. تحدث بأي لغة! مثال: "أنفقت ${symbol}25 على الغداء" أو "أقرضت ${symbol}100 لأحمد".`,
    pt: `Olá! Sou seu Money Companion. Fale em qualquer idioma! Exemplo: "Gastei ${symbol}25 no almoço" ou "Emprestei ${symbol}100 para João".`,
    ru: `Привет! Я ваш Money Companion. Говорите на любом языке! Пример: "Потратил ${symbol}25 на обед" или "Одолжил ${symbol}100 Ивану".`,
    ko: `안녕하세요! 저는 Money Companion입니다. 어떤 언어로도 대화하세요! 예: "점심에 ${symbol}25 썼어요" 또는 "김씨에게 ${symbol}100 빌려줬어요".`,
  };
  const initialGreeting = greetingByLang[aiLanguage] ?? greetingByLang.auto;

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: idCounter++,
      role: "assistant",
      content: initialGreeting,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceReply, setVoiceReply] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("mc.voice_reply");
      if (saved !== null) return saved === "true";
    } catch {}
    return true; // Interactive voice ON by default!
  });
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [changeCat, setChangeCat] = useState<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const thinkSoundRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      ttsCancel();
    };
  }, []);

  const toggleVoiceReply = () => {
    playClick();
    setVoiceReply((prev) => {
      const next = !prev;
      try { localStorage.setItem("mc.voice_reply", String(next)); } catch {}
      if (!next) {
        ttsCancel();
        setSpeakingMsgId(null);
      }
      return next;
    });
  };

  const speakMessage = (id: number, text: string) => {
    if (speakingMsgId === id) {
      ttsCancel();
      setSpeakingMsgId(null);
      return;
    }
    playClick();
    setSpeakingMsgId(id);
    ttsSpeak(text, {
      locale: speechLocale,
      rate: 0.92,
      onStart: () => setSpeakingMsgId(id),
      onEnd: () => setSpeakingMsgId(null),
      onError: () => setSpeakingMsgId(null),
    });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, steps, busy]);

  // Gentle thinking ticks while the agent works — stops when done.
  useEffect(() => {
    if (busy) {
      let n = 0;
      thinkSoundRef.current = setInterval(() => playThinkingTick(n++), 1400);
    } else if (thinkSoundRef.current) {
      clearInterval(thinkSoundRef.current);
      thinkSoundRef.current = null;
    }
    return () => {
      if (thinkSoundRef.current) clearInterval(thinkSoundRef.current);
      thinkSoundRef.current = null;
    };
  }, [busy]);

  const stop = () => {
    playClick();
    ttsCancel();
    setSpeakingMsgId(null);
    abortRef.current?.abort();
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    // busyRef guards rapid double-sends (e.g. double-Enter) that state can't catch.
    if (!text || busy || busyRef.current) return;
    busyRef.current = true;
    ttsCancel();
    setSpeakingMsgId(null);
    playSend();
    if (!configured) {
      playError();
      setError("Connect a free AI key below first — then I can run.");
      busyRef.current = false;
      return;
    }
    setError("");
    setSavedNote("");
    const userMsg: ChatMsg = { id: idCounter++, role: "user", content: text };
    // If a draft is still waiting for a category and the user just names one
    // ("Food", "put it under lunch"), file it instantly — no AI round-trip.
    const awaiting = [...messages].reverse().find((m) => m.draft && !m.draft.category_id && !m.pending);
    if (awaiting?.draft) {
      const hit = matchCategoryName(text, awaiting.draft.type, categories);
      if (hit) {
        const reply: ChatMsg = {
          id: idCounter++,
          role: "assistant",
          content: `Filed under ${hit.name} — press Save note to confirm.`,
        };
        setMessages((prev) =>
          prev
            .map((m) =>
              m.id === awaiting.id && m.draft ? { ...m, draft: { ...m.draft, category_id: hit.id } } : m,
            )
            .concat([userMsg, reply]),
        );
        setInput("");
        if (voiceReply) {
          setSpeakingMsgId(reply.id);
          ttsSpeak(reply.content, {
            locale: speechLocale,
            rate: 0.92,
            onStart: () => setSpeakingMsgId(reply.id),
            onEnd: () => setSpeakingMsgId(null),
            onError: () => setSpeakingMsgId(null),
          });
        }
        busyRef.current = false;
        return;
      }
    }
    const history = [...messages, userMsg]
      .filter((m) => !m.pending)
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));
    const pendingDraft = awaiting?.draft ?? null;
    const pendingLoan = [...messages].reverse().find((m) => m.loanDraft && !m.pending)?.loanDraft ?? null;
    const activeLoans = loans.filter((l) => l.status === "active");
    const lentTotal = activeLoans.filter((l) => l.type === "lent").reduce((s, l) => s + (Number(l.principal) || 0), 0);
    const borrowedTotal = activeLoans.filter((l) => l.type === "borrowed").reduce((s, l) => s + (Number(l.principal) || 0), 0);
    const moneyContext = summary
      ? `month income ${summary.month_income}, month expenses ${summary.month_expenses}, open loans: ${activeLoans.length} (lent out ${lentTotal}, borrowed ${borrowedTotal})`
      : `open loans: ${activeLoans.length}`;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setStartedAt(Date.now());
    setSteps(["Listening…", "Reading your recent notes…"].slice(0, 1));
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const assistantId = idCounter++;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", pending: true }]);
    let streamed = "";
    try {
      const result = await runChatAgent(
        settings,
        history,
        {
          summary: summary ?? null,
          recent,
          categories,
          pendingDraft,
          loans,
          loanPayments: {},
          pendingLoan,
          moneyContext,
          currencyCode: currency,
          preferredLanguage: aiLanguage,
        },
        {
          signal: ctrl.signal,
          onStep: (s) => setSteps((prev) => (prev.includes(s) ? prev : [...prev, s])),
          onToken: (t) => {
            streamed += t;
            // Never show machine-readable fence blocks, even mid-stream.
            const clean = stripCodeBlocks(streamed);
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: clean } : m)));
          },
        },
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: result.reply || streamed || "Done.", draft: result.draft, loanDraft: result.loanDraft, ideaDraft: result.ideaDraft, pending: false }
            : m,
        ),
      );
      setSteps((prev) => [...prev, result.draft || result.loanDraft || result.ideaDraft ? "Draft ready — review before saving." : "Done."]);
      playReceive();
      if (voiceReply && result.reply) {
        setSpeakingMsgId(assistantId);
        ttsSpeak(result.reply, {
          locale: speechLocale,
          rate: 0.92,
          onStart: () => setSpeakingMsgId(assistantId),
          onEnd: () => setSpeakingMsgId(null),
          onError: () => setSpeakingMsgId(null),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      if ((e as Error).name === "AbortError") {
        playClick();
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: stripCodeBlocks(streamed) || "(stopped)", pending: false } : m)));
        setSteps((prev) => [...prev, "Stopped."]);
      } else {
        playError();
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setError(msg);
      }
    } finally {
      setBusy(false);
      setStartedAt(null);
      busyRef.current = false;
    }
  };

  const startSpeech = () => {
    const w = window as Window & {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onstart: (() => void) | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onstart: (() => void) | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        start: () => void;
      };
    };
    const Speech = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Speech) {
      setError("Speech input is not available in this browser. Type instead.");
      return;
    }
    const rec = new Speech();
    rec.lang = speechLocale === 'auto' ? (navigator.language || 'en-US') : speechLocale;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      ttsCancel();
      setSpeakingMsgId(null);
      playListenStart();
      setListening(true);
      setSteps(["Listening…"]);
      setStartedAt(Date.now());
      setError("");
      setVoiceReply(true);
      try { localStorage.setItem("mc.voice_reply", "true"); } catch {}
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      setError("I could not hear that clearly. Type instead.");
    };
    rec.onresult = (e) => {
      const heard = e.results[0][0].transcript;
      setListening(false);
      void send(heard);
    };
    rec.start();
  };

  const pickCategory = (msgId: number, categoryId: string) => {
    playClick();
    setError("");
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.draft ? { ...m, draft: { ...m.draft, category_id: categoryId } } : m,
      ),
    );
    setChangeCat((prev) => prev.filter((id) => id !== msgId));
  };

  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);

  const updateDraft = (msgId: number, patch: Partial<AgentDraft>) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.draft ? { ...m, draft: { ...m.draft, ...patch } } : m,
      ),
    );
  };

  const discardDraft = (msgId: number) => {
    playClick();
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, draft: null } : m)));
    if (editingDraftId === msgId) setEditingDraftId(null);
  };

  const saveDraft = (msg: ChatMsg) => {
    if (!msg.draft) return;
    const d = msg.draft;
    if (!d.amount || d.amount <= 0) {
      playError();
      setError("Please provide an amount greater than zero.");
      return;
    }
    if (!d.category_id) {
      playError();
      setError("Choose a category first — tap one on the draft card or reply with its name.");
      return;
    }
    playClick();
    create.mutate(
      {
        type: d.type,
        amount: d.amount,
        currency: currency,
        category_id: d.category_id,
        description: d.description || null,
        merchant: d.merchant || null,
        transaction_date: d.transaction_date,
        source: "text",
      },
      {
        onSuccess: () => {
          playSuccess();
          setSavedNote(`Saved ${d.type} ${fmt(d.amount)}.`);
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, draft: null } : m)));
          if (editingDraftId === msg.id) setEditingDraftId(null);
        },
        onError: (e) => {
          playError();
          setError(e instanceof Error ? e.message : "Could not save.");
        },
      },
    );
  };

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "Uncategorised";

  const clearLoanDraft = (msgId: number) => {
    playSuccess();
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, loanDraft: null } : m)));
    setSavedNote("Loan record updated.");
  };

  const clearIdeaDraft = (msgId: number) => {
    playSuccess();
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ideaDraft: null } : m)));
    setSavedNote("Idea saved — open the Ideas page for its feasibility verdict.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17251f]/45 backdrop-blur-[3px] sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex h-[min(880px,94dvh)] max-h-[94dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-[28px] border border-border bg-background shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles size={17} />
            </span>
            <div>
              <p className="text-sm font-bold">Agent</p>
              <p className="text-[11px] text-muted-foreground">
                {configured ? `Multilingual AI · Active currency: ${currency}` : "Connect a free key to start"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                playClick();
                setShowHowItWorks((v) => !v);
              }}
              title="How the agent works — click for step-by-step details (listening, reading notes, thinking, draft review)"
              aria-expanded={showHowItWorks}
              aria-label="How the agent works"
              className={`rounded-full p-2 transition ${showHowItWorks ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              data-testid="button-how-it-works"
            >
              <Info size={17} />
            </button>
            <SoundToggle />
            <button
              onClick={toggleVoiceReply}
              title={
                speakingMsgId !== null
                  ? "Speaking now — click to silence"
                  : voiceReply
                  ? "Interactive Voice ON — replies are spoken aloud (click to mute)"
                  : "Interactive Voice MUTED — click to hear spoken replies"
              }
              aria-pressed={voiceReply}
              aria-label="Toggle spoken replies"
              className={`rounded-full p-2 transition ${
                speakingMsgId !== null
                  ? "bg-primary/25 text-primary ring-2 ring-primary/40 animate-pulse"
                  : voiceReply
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              data-testid="button-voice-reply"
            >
              {speakingMsgId !== null ? (
                <AudioLines size={17} className="animate-pulse text-primary" />
              ) : voiceReply ? (
                <Volume2 size={17} />
              ) : (
                <VolumeX size={17} />
              )}
            </button>
            <button onClick={() => { ttsCancel(); setSpeakingMsgId(null); playClick(); onClose(); }} aria-label="Close assistant" title="Close assistant — your chat stays here until you reopen" className="rounded-full p-2 text-muted-foreground hover:bg-muted" data-testid="button-close-assistant">
              <X size={18} />
            </button>
          </div>
        </div>
        {showHowItWorks && (
          <div className="border-b border-border bg-muted/50 px-5 py-3 text-[12px] leading-relaxed text-muted-foreground" data-testid="how-it-works">
            <p className="font-bold text-foreground">How the agent works — tap any step below for details.</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
              <li><b>Listening</b> — captures your text or voice, on this device.</li>
              <li><b>Reading notes</b> — loads your recent notes + balances. Nothing is invented.</li>
              <li><b>Thinking</b> — streams the AI reply live. Hear soft ticks + watch the timeline.</li>
              <li><b>Draft review</b> — every note, loan or idea becomes a card. Nothing saves until you press Confirm.</li>
            </ol>
            <button
              onClick={() => {
                playClick();
                setShowHowItWorks(false);
              }}
              className="mt-2 inline-flex items-center gap-1 font-bold text-primary hover:underline"
              data-testid="button-hide-how-it-works"
            >
              Got it <ChevronDown size={13} className="rotate-180" />
            </button>
          </div>
        )}

        <div ref={scrollRef} className="min-h-[420px] flex-1 space-y-3.5 overflow-y-auto px-6 py-5" data-testid="assistant-messages">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[90%] rounded-2xl px-5 py-3.5 text-[14.5px] leading-relaxed ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                {m.pending && !m.content ? (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <LoaderCircle size={14} className="animate-spin" /> Thinking<TypingDots />
                  </span>
                ) : (
                  <div>
                    <p className="whitespace-pre-wrap">
                      {m.content}
                      {m.pending && <TypingDots />}
                    </p>
                    {m.role === "assistant" && !m.pending && m.content && (
                      <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
                        <button
                          onClick={() => speakMessage(m.id, m.content)}
                          title={speakingMsgId === m.id ? "Stop voice" : "Read aloud / Listen"}
                          aria-label={speakingMsgId === m.id ? "Stop voice" : "Read aloud"}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition active:scale-95 ${
                            speakingMsgId === m.id
                              ? "bg-primary/20 text-primary font-semibold ring-1 ring-primary/30"
                              : "bg-background/60 hover:bg-background hover:text-foreground"
                          }`}
                        >
                          {speakingMsgId === m.id ? (
                            <AudioLines size={13} className="animate-pulse text-primary" />
                          ) : (
                            <Volume2 size={13} />
                          )}
                          <span>{speakingMsgId === m.id ? "Speaking… tap to stop" : "Listen"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {m.draft && (
                  <div className="mt-3 rounded-xl bg-card p-3.5 text-foreground shadow-sm border border-border/80" data-testid="assistant-draft">
                    {editingDraftId === m.id ? (
                      <div className="space-y-3" data-testid="assistant-draft-edit-panel">
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                            <Pencil size={13} />
                            <span>Edit note details</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              setEditingDraftId(null);
                            }}
                            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                            title="Close edit panel"
                            data-testid="button-close-draft-edit"
                          >
                            <X size={15} />
                          </button>
                        </div>

                        {/* Money In or Out (Type) */}
                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-muted-foreground">Type</label>
                          <div className="grid grid-cols-2 rounded-full bg-muted p-1">
                            {(["expense", "income"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  playClick();
                                  const matchingCategory = categories.find(
                                    (c) =>
                                      c.type === t &&
                                      c.name.toLowerCase() ===
                                        categoryName(m.draft?.category_id ?? null).toLowerCase()
                                  );
                                  updateDraft(m.id, {
                                    type: t,
                                    category_id: matchingCategory ? matchingCategory.id : null,
                                  });
                                }}
                                className={`rounded-full py-1.5 text-xs font-bold capitalize transition ${
                                  m.draft?.type === t
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                data-testid={`button-edit-type-${t}`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Amount */}
                        <div>
                          <label className="block text-[11px] font-bold text-muted-foreground">Amount</label>
                          <div className="relative mt-1 flex items-center">
                            <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground select-none">
                              {symbol}
                            </span>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={m.draft.amount === 0 ? "" : m.draft.amount}
                              onChange={(e) =>
                                updateDraft(m.id, { amount: parseFloat(e.target.value) || 0 })
                              }
                              placeholder="0.00"
                              className="field mono text-base font-semibold w-full"
                              style={{ paddingLeft: "34px" }}
                              data-testid="input-edit-draft-amount"
                            />
                          </div>
                        </div>

                        {/* Category */}
                        <div>
                          <label className="block text-[11px] font-bold text-muted-foreground">Category</label>
                          <select
                            value={m.draft.category_id || ""}
                            onChange={(e) => updateDraft(m.id, { category_id: e.target.value || null })}
                            className="field mt-1 w-full text-xs"
                            data-testid="select-edit-draft-category"
                          >
                            <option value="">Choose category (required)</option>
                            {categories
                              .filter((c) => c.type === m.draft?.type)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {categories
                              .filter((c) => c.type === m.draft?.type)
                              .slice(0, 8)
                              .map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    playClick();
                                    updateDraft(m.id, { category_id: c.id });
                                  }}
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition border ${
                                    m.draft?.category_id === c.id
                                      ? "border-primary bg-primary/10 text-primary font-bold"
                                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                                  }`}
                                  data-testid={`pill-category-${c.id}`}
                                >
                                  {c.name}
                                </button>
                              ))}
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-[11px] font-bold text-muted-foreground">What was it?</label>
                          <input
                            type="text"
                            value={m.draft.description}
                            onChange={(e) => updateDraft(m.id, { description: e.target.value })}
                            placeholder="e.g. Lunch, Groceries, Salary…"
                            className="field mt-1 w-full text-xs"
                            data-testid="input-edit-draft-description"
                          />
                        </div>

                        {/* Merchant & Date */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-muted-foreground">Where or who?</label>
                            <input
                              type="text"
                              value={m.draft.merchant}
                              onChange={(e) => updateDraft(m.id, { merchant: e.target.value })}
                              placeholder="Shop or person"
                              className="field mt-1 w-full text-xs"
                              data-testid="input-edit-draft-merchant"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-muted-foreground">When?</label>
                            <input
                              type="date"
                              value={m.draft.transaction_date ? m.draft.transaction_date.slice(0, 10) : ""}
                              onChange={(e) => updateDraft(m.id, { transaction_date: e.target.value })}
                              className="field mt-1 w-full text-xs"
                              data-testid="input-edit-draft-date"
                            />
                          </div>
                        </div>

                        {/* Actions in Edit Panel */}
                        <div className="mt-2.5 flex items-center gap-2 pt-1 border-t border-border/40">
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              setEditingDraftId(null);
                            }}
                            className="rounded-full border border-border px-3.5 py-2 text-[12px] font-bold text-foreground hover:bg-muted transition"
                            data-testid="button-done-editing-draft"
                          >
                            Done
                          </button>
                          <button
                            type="button"
                            onClick={() => saveDraft(m)}
                            disabled={create.isPending || !m.draft?.category_id || !m.draft?.amount}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground disabled:opacity-50 transition active:scale-95"
                            data-testid="button-save-edited-draft"
                          >
                            <Check size={14} /> {create.isPending ? "Saving…" : "Save note"}
                          </button>
                        </div>
                        <div className="text-center pt-0.5">
                          <button
                            type="button"
                            onClick={() => discardDraft(m.id)}
                            className="text-[10px] text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
                            data-testid="button-discard-draft"
                          >
                            Discard draft
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Draft note — review</p>
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              setEditingDraftId(m.id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary underline-offset-2 hover:underline"
                            data-testid={`button-open-edit-${m.id}`}
                          >
                            <Pencil size={12} /> Edit
                          </button>
                        </div>
                        <p className="mono mt-1 text-xl font-semibold capitalize">
                          {m.draft.type} · {fmt(m.draft.amount)}
                        </p>
                        <p className="mt-0.5 text-[12px] font-semibold">{m.draft.description || "No description"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {categoryName(m.draft.category_id)} · {m.draft.merchant || "No shop"} · {m.draft.transaction_date}
                          {!m.draft.category_id && " · category needed"}
                          {m.draft.category_id && (
                            <button
                              onClick={() =>
                                setChangeCat((prev) => (prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]))
                              }
                              className="ml-1.5 font-bold text-primary underline-offset-2 hover:underline"
                              data-testid={`button-change-category-${m.id}`}
                            >
                              {changeCat.includes(m.id) ? "Hide" : "Change"}
                            </button>
                          )}
                        </p>
                        {(!m.draft.category_id || changeCat.includes(m.id)) && (
                          <div className="mt-2.5" data-testid="assistant-category-ask">
                            <p className="text-[11px] font-bold">
                              {m.draft.category_id ? "Pick a different category:" : "Which category should this go in?"}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {categories
                                .filter((c) => c.type === (m.draft as AgentDraft).type)
                                .map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => pickCategory(m.id, c.id)}
                                    className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-bold transition hover:border-primary hover:text-primary"
                                    data-testid={`button-pick-category-${c.id}`}
                                  >
                                    {c.name}
                                  </button>
                                ))}
                            </div>
                            <p className="mt-1.5 text-[10px] text-muted-foreground">
                              Tap one above — or just reply with the name, e.g. “Food”.
                            </p>
                          </div>
                        )}
                        <div className="mt-2.5 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              playClick();
                              setEditingDraftId(m.id);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-[12px] font-bold text-foreground transition hover:border-primary hover:text-primary active:scale-95"
                            data-testid={`button-edit-draft-${m.id}`}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => saveDraft(m)}
                            disabled={create.isPending || !m.draft?.category_id}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground disabled:opacity-50 transition active:scale-95"
                            data-testid="button-save-draft"
                          >
                            <Check size={14} /> {create.isPending ? "Saving…" : "Save note"}
                          </button>
                        </div>
                        {!m.draft.category_id && (
                          <p className="mt-1.5 text-[10px] text-muted-foreground">
                            Saving stays blocked until a category is chosen — category is required.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {m.loanDraft && (
                  <LoanDraftCard
                    loanDraft={m.loanDraft}
                    loans={loans}
                    categories={categories}
                    onDone={() => clearLoanDraft(m.id)}
                  />
                )}
                {m.ideaDraft && (
                  <IdeaDraftCard
                    ideaDraft={m.ideaDraft}
                    onDone={() => clearIdeaDraft(m.id)}
                  />
                )}
              </div>
            </div>
          ))}
          {steps.length > 0 && (
            <AgentActivity steps={steps} busy={busy} startedAt={startedAt} />
          )}
          {savedNote && (
            <p className="rounded-xl bg-[#e6eee3] px-4 py-2.5 text-[12px] font-semibold text-[#466548]" role="status">
              {savedNote}
            </p>
          )}
          {error && (
            <p className="rounded-xl bg-[#f5e5df] px-4 py-2.5 text-[12px] text-[#914e40]" role="alert" data-testid="status-assistant-error">
              {error}
            </p>
          )}
          {!configured && (
            <div className="pt-1">
              <AiSettingsPanel compact />
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          {!busy && messages.length <= 2 && (
            <div className="pb-2">
              <QuickPrompts symbol={symbol} onPick={(t) => void send(t)} />
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <button
              onClick={startSpeech}
              disabled={busy || listening}
              aria-label="Speak to the agent"
              title={listening ? "Listening… speak now (details: your voice is transcribed on-device, then sent as text)" : "Speak to the agent — click for details: mic transcribes your voice, then the agent thinks aloud"}
              className={`grid h-13 w-13 shrink-0 place-items-center rounded-full p-3.5 transition active:scale-90 ${listening ? "animate-pulse bg-[#b76654] text-white" : "bg-muted text-foreground hover:bg-muted/70"}`}
              data-testid="button-assistant-mic"
            >
              {listening ? <AudioLines size={20} /> : <Mic size={20} />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={listening ? "Listening…" : `Type or speak: ${symbol}240 lunch, या खाना में ${symbol}500…`}
              className="field field-lg"
              aria-label="Message the agent"
              data-testid="input-assistant"
            />
            {busy ? (
              <button onClick={stop} aria-label="Stop generating" title="Stop generating — click for details: keeps the partial reply, plays a soft click" className="grid h-13 w-13 shrink-0 place-items-center rounded-full border border-border p-3.5 transition hover:bg-muted active:scale-90" data-testid="button-assistant-stop">
                <LoaderCircle size={20} className="animate-spin" />
              </button>
            ) : (
              <button
                onClick={() => void send()}
                aria-label="Send message"
                title="Send message — click for details: whoosh sound, agent reads your notes, thinks, then streams a reply"
                disabled={!input.trim()}
                className="grid h-13 w-13 shrink-0 place-items-center rounded-full bg-primary p-3.5 text-primary-foreground transition hover:-translate-y-0.5 active:scale-90 disabled:opacity-40"
                data-testid="button-assistant-send"
              >
                <Send size={19} />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            The agent only sends data to your chosen provider when you press send. Review every draft before saving.
          </p>
        </div>
      </div>
    </div>
  );
}
