import { useState, useRef, useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Cpu,
  EyeOff,
  Flame,
  Globe2,
  HandCoins,
  HeartHandshake,
  HelpCircle,
  History,
  Languages,
  Layers,
  Lock,
  Mic,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  Zap,
} from "lucide-react";
import { parseLoanNote, normalizeDigits, amountPattern } from "@/lib/transaction-parser";
import { ttsSpeak, ttsCancel, LANG_TO_LOCALE } from "@/lib/tts";

/* ── Brand component ───────────────────────────────────────────────────────── */
function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 transition active:scale-95">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
          dark
            ? "bg-[#dbab77] text-[#203d35]"
            : "bg-gradient-to-br from-[#203d35] to-[#2d5447] text-[#f7f1e6] shadow-xs"
        }`}
      >
        <Wallet size={18} />
      </span>
      <div className="flex flex-col">
        <span
          className={`serif text-[20px] font-semibold leading-none tracking-tight ${
            dark ? "text-[#f7f1e6]" : "text-[#203d35]"
          }`}
        >
          Money Companion
        </span>
        <span className={`text-[9.5px] font-medium tracking-wide ${dark ? "text-[#dbab77]/80" : "text-[#9a7455]"}`}>
          The Quiet Sovereign Ledger
        </span>
      </div>
    </Link>
  );
}

/* ── Interactive Demo Parser Helpers ───────────────────────────────────────── */
interface DemoParsedResult {
  isLoan: boolean;
  type: "income" | "expense" | "loan";
  amount: number;
  currencySymbol: string;
  category: string;
  counterparty?: string;
  loanType?: "lent" | "borrowed";
  commentary: string;
  originalText: string;
}

function parseDemoNote(rawText: string, activeSymbol: string): DemoParsedResult {
  const text = rawText.trim();
  const clean = normalizeDigits(text);

  // Check if it's a loan note first
  const loan = parseLoanNote(text);
  if (loan) {
    const isLent = loan.kind === "loan_new" ? loan.loan_type === "lent" : true;
    return {
      isLoan: true,
      type: "loan",
      amount: loan.amount,
      currencySymbol: activeSymbol,
      category: "Peer & Informal Credit",
      counterparty: (loan.kind === "loan_new" && loan.counterparty) || "Friend / Contact",
      loanType: isLent ? "lent" : "borrowed",
      commentary: isLent
        ? `Identified as money lent to ${loan.kind === "loan_new" && loan.counterparty ? loan.counterparty : "a peer"}. Tracked under Informal Assets without inflating your personal living expenses.`
        : `Identified as money borrowed from ${loan.kind === "loan_new" && loan.counterparty ? loan.counterparty : "a contact"}. Recorded under Peer Liabilities without falsely counting as earned income.`,
      originalText: text,
    };
  }

  // Extract amount
  const amtMatch = clean.match(amountPattern);
  const amount = amtMatch ? Number(amtMatch[1].replace(/,/g, "")) : 250;

  // Determine income vs expense
  const lower = clean.toLowerCase();
  const isIncome =
    lower.includes("salary") ||
    lower.includes("received") ||
    lower.includes("freelance") ||
    lower.includes("refund") ||
    lower.includes("bonus") ||
    lower.includes("कमाई") ||
    lower.includes("आयो") ||
    lower.includes("आया");

  let category = "Everyday Living";
  if (lower.includes("lunch") || lower.includes("dinner") || lower.includes("food") || lower.includes("coffee") || lower.includes("खाजा") || lower.includes("खाना") || lower.includes("tea") || lower.includes("sushi")) {
    category = "Food & Dining";
  } else if (lower.includes("rent") || lower.includes("housing") || lower.includes("alquiler") || lower.includes("कोठा") || lower.includes("भाडा")) {
    category = "Housing & Rent";
  } else if (lower.includes("taxi") || lower.includes("bus") || lower.includes("fuel") || lower.includes("gas") || lower.includes("यातायात")) {
    category = "Transport";
  } else if (lower.includes("grocery") || lower.includes("groceries") || lower.includes("तरकारी") || lower.includes("किराना")) {
    category = "Groceries";
  } else if (isIncome) {
    category = lower.includes("freelance") ? "Freelance Work" : "Primary Income";
  }

  return {
    isLoan: false,
    type: isIncome ? "income" : "expense",
    amount: amount > 0 ? amount : 500,
    currencySymbol: activeSymbol,
    category,
    commentary: isIncome
      ? `Captured as inbound revenue categorized under "${category}". Your available cash balance increases cleanly.`
      : `Classified as an everyday expense under "${category}". Instant deduction calculated with zero mental friction.`,
    originalText: text,
  };
}

/* ── Interactive Demo Presets ──────────────────────────────────────────────── */
const DEMO_PRESETS = [
  {
    lang: "ne",
    flag: "🇳🇵",
    label: "Nepali Peer Loan",
    sentence: "साथी रामलाई ५,००० सापट दिएँ",
  },
  {
    lang: "en",
    flag: "🇺🇸",
    label: "English Coffee",
    sentence: "Paid $14 for artisanal coffee & pastry",
  },
  {
    lang: "hi",
    flag: "🇮🇳",
    label: "Hindi Freelance",
    sentence: "फ्रीलांस डिजाइन के लिए 45,000 रुपये मिले",
  },
  {
    lang: "es",
    flag: "🇪🇸",
    label: "Spanish Dinner",
    sentence: "Cena con amigos 48 euros en restaurante",
  },
  {
    lang: "ja",
    flag: "🇯🇵",
    label: "Japanese Meal",
    sentence: "同僚とランチ寿司 2800円 支払い",
  },
  {
    lang: "en",
    flag: "🇬🇧",
    label: "English Borrowing",
    sentence: "Borrowed 15000 from uncle for tuition fees",
  },
];

/* ── Currency Showcase Data ────────────────────────────────────────────────── */
const CURRENCIES = [
  { code: "NPR", symbol: "Rs", name: "Nepali Rupee", flag: "🇳🇵", sampleBalance: 86450, sampleSalary: 85000, sampleRent: 18000 },
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", sampleBalance: 4280, sampleSalary: 5200, sampleRent: 1450 },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", sampleBalance: 3890, sampleSalary: 4400, sampleRent: 1100 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳", sampleBalance: 54200, sampleSalary: 65000, sampleRent: 15000 },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧", sampleBalance: 3150, sampleSalary: 3800, sampleRent: 950 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵", sampleBalance: 482000, sampleSalary: 350000, sampleRent: 85000 },
];

/* ── Philosophy Sections Data ──────────────────────────────────────────────── */
const PHILOSOPHY_PILLARS = [
  {
    num: "01",
    tag: "Cognitive Ergonomics",
    title: "The Tyranny of the Categorization Matrix",
    body: "Traditional finance apps ask you to navigate 42 subcategories just to record a two-dollar afternoon espresso. By the third week, decision fatigue wins and you abandon the app. Money Companion replaces bureaucratic matrices with natural human sentences. You write or speak as you think, and intelligent semantic parsing handles the rest.",
    quote: "“Friction in recording is the single greatest cause of financial blindness.”",
  },
  {
    num: "02",
    tag: "Behavioral Psychology",
    title: "Kahneman's Mental Accounting & Radical Kindness",
    body: "Spreadsheets treat human spending as sterile Euclidean geometry. In real life, spending carries emotional valence: relief, joy, anxiety, affection. By letting you journal notes in your mother tongue with honest commentary, Money Companion builds gentle mindfulness rather than shame-inducing budget alerts.",
    quote: "“Money is never just math; it is a mirror of our emotional geography.”",
  },
  {
    num: "03",
    tag: "Social Economics",
    title: "The Sacred Fabric of Informal Lending",
    body: "In communities across South Asia, Latin America, and tight-knit families worldwide, peer lending is larger than commercial microcredit. Yet corporate banking apps treat a loan to your brother as an invisible black hole. We treat informal loans with dignity: clear terms, graceful repayment tracking, and zero social awkwardness.",
    quote: "“Trust is the bedrock of community. Our tools should honor it, not ignore it.”",
  },
  {
    num: "04",
    tag: "Sovereign Architecture",
    title: "Zero-Surveillance Ledger by Design",
    body: "If a budgeting tool is free, your purchasing habits, balance sheets, and location trails are being packaged for ad auctions. Money Companion runs on sovereign principles: your API keys stay safely in your browser, your database belongs to your private Supabase container, and we hold zero advertising contracts.",
    quote: "“Your net worth is your private sanctuary, not telemetry for ad networks.”",
  },
];

/* ── FAQs ──────────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "Why doesn't Money Companion automatically connect to my bank account via Plaid?",
    a: "Bank scraping creates false passivity and extreme security exposure. Studies consistently demonstrate that humans who actively note their transactions develop 3.4x greater financial awareness than those relying on passive scrapers. Furthermore, third-party bank connectors frequently sell transaction metadata to credit bureaus and hedge funds. We choose absolute privacy and conscious awareness.",
  },
  {
    q: "How does the free AI key work, and does it cost me anything?",
    a: "Zero cost. You can create a free key in 30 seconds at Google AI Studio (Gemini) or OpenRouter. The key is stored solely in your device's browser localStorage. Every time you dictate a transaction or ask for financial analysis, the browser communicates directly with the provider. There is no middleman markup or subscription fee.",
  },
  {
    q: "Can I use the app without an AI key or completely offline?",
    a: "Yes! Money Companion includes a full deterministic on-device parser. Even with no AI key connected and no internet access, the local engine recognizes numbers, currencies, dates, and common categories in both English and Devanagari script.",
  },
  {
    q: "How does peer loan and debt tracking work?",
    a: "Whenever you say 'lent 5000 to Ram' or 'borrowed 10000 from uncle', the system isolates it from your living expenses. It creates a dedicated Peer Credit record with repayment schedules, partial payments, and net lending balances so you always know who owes what with zero awkwardness.",
  },
  {
    q: "Can I switch between currencies like NPR, USD, and INR seamlessly?",
    a: "Yes. Money Companion includes a native world currency engine with 100+ fiat currencies. You can set a primary currency, view live conversion estimates, and log transactions in whichever currency you spent in.",
  },
  {
    q: "Who owns my financial data, and can I export it?",
    a: "You own 100% of your data. It resides in your own authenticated PostgreSQL database instance. You can export clean CSVs or JSON backups anytime with a single click.",
  },
];

export function LandingPage() {
  /* ── Interactive Demo State ─────────────────────────────────────────────── */
  const [activeCurrency, setActiveCurrency] = useState(CURRENCIES[0]);
  const [demoInput, setDemoInput] = useState(DEMO_PRESETS[0].sentence);
  const [parsedDemo, setParsedDemo] = useState<DemoParsedResult>(() =>
    parseDemoNote(DEMO_PRESETS[0].sentence, CURRENCIES[0].symbol)
  );
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<any>(null);

  /* ── Feature Tabs State ─────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<"journal" | "loans" | "intel" | "currencies">("journal");

  /* ── Voice Greeting Preview State ───────────────────────────────────────── */
  const [greetingLang, setGreetingLang] = useState("ne");
  const [greetingPlaying, setGreetingPlaying] = useState(false);

  /* ── FAQ Accordion State ────────────────────────────────────────────────── */
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  /* ── Run live demo parser when input changes ────────────────────────────── */
  const handleParse = (textToParse: string) => {
    const res = parseDemoNote(textToParse, activeCurrency.symbol);
    setParsedDemo(res);
  };

  const handleSelectPreset = (preset: (typeof DEMO_PRESETS)[0]) => {
    setDemoInput(preset.sentence);
    // Find matching currency if applicable
    if (preset.lang === "ne") setActiveCurrency(CURRENCIES[0]); // NPR
    else if (preset.lang === "hi") setActiveCurrency(CURRENCIES[3]); // INR
    else if (preset.lang === "es") setActiveCurrency(CURRENCIES[2]); // EUR
    else if (preset.lang === "ja") setActiveCurrency(CURRENCIES[5]); // JPY
    else if (preset.sentence.includes("£")) setActiveCurrency(CURRENCIES[4]); // GBP
    else setActiveCurrency(CURRENCIES[1]); // USD

    const sym =
      preset.lang === "ne"
        ? "Rs"
        : preset.lang === "hi"
        ? "₹"
        : preset.lang === "es"
        ? "€"
        : preset.lang === "ja"
        ? "¥"
        : preset.sentence.includes("£")
        ? "£"
        : "$";
    setParsedDemo(parseDemoNote(preset.sentence, sym));
  };

  /* ── Web Speech API for interactive demo ────────────────────────────────── */
  const toggleSpeech = () => {
    if (listening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechError("Speech recognition is not supported in this browser. Try Google Chrome or Safari.");
      return;
    }
    setSpeechError("");
    const recognition = new SpeechRec();
    recognitionRef.current = recognition;
    recognition.lang = greetingLang === "ne" ? "ne-NP" : greetingLang === "hi" ? "hi-IN" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setSpeechError("Could not access microphone. Please check browser permissions.");
    };
    recognition.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setDemoInput(transcript);
        handleParse(transcript);
      }
    };
    try {
      recognition.start();
    } catch {
      setListening(false);
      setSpeechError("Microphone already active or blocked.");
    }
  };

  /* ── Play Sample Greeting ───────────────────────────────────────────────── */
  const playSampleGreeting = () => {
    ttsCancel();
    setGreetingPlaying(true);
    const greetings: Record<string, string> = {
      en: `Welcome back, Navin! Your recorded balance is ${activeCurrency.symbol} ${activeCurrency.sampleBalance.toLocaleString()}. You are saving this month. How are things going today?`,
      ne: `स्वागत छ, नविन! तपाईंको रेकर्ड ब्यालेन्स ${activeCurrency.symbol} ${activeCurrency.sampleBalance.toLocaleString()} छ। यो महिना बचत गर्दै हुनुहुन्छ। आज कस्तो छ?`,
      hi: `स्वागत है, नवीन! आपका रिकॉर्ड बैलेंस ${activeCurrency.symbol} ${activeCurrency.sampleBalance.toLocaleString()} है। इस महीने बचत हो रही है। आज कैसा चल रहा है?`,
      es: `¡Bienvenido, Navin! Tu saldo registrado es ${activeCurrency.symbol} ${activeCurrency.sampleBalance.toLocaleString()}. Estás ahorrando este mes. ¿Cómo van las cosas hoy?`,
      fr: `Bienvenue, Navin! Votre solde enregistré est de ${activeCurrency.symbol} ${activeCurrency.sampleBalance.toLocaleString()}. Vous économisez ce mois-ci. Comment ça va aujourd'hui?`,
      ja: `おかえりなさい、Navinさん！記録残高は ${activeCurrency.symbol} ${activeCurrency.sampleBalance.toLocaleString()} です。今月は貯蓄できています。今日の調子はいかがですか？`,
    };
    const text = greetings[greetingLang] || greetings.en;
    const locale = LANG_TO_LOCALE[greetingLang] || "en-US";

    ttsSpeak(text, {
      locale,
      rate: 0.94,
      onStart: () => setGreetingPlaying(true),
      onEnd: () => setGreetingPlaying(false),
      onError: () => setGreetingPlaying(false),
    });
  };

  useEffect(() => {
    return () => {
      ttsCancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#fbf8f2] text-foreground selection:bg-[#203d35] selection:text-[#f7f1e6]">
      {/* ── Sticky Top Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#e4d8c3]/80 bg-[#fbf8f2]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Brand />

          {/* Center Links (Desktop) */}
          <nav className="hidden items-center gap-7 text-xs font-semibold text-[#6e5d44] md:flex">
            <a href="#sandbox" className="transition hover:text-[#203d35]">
              Live Sandbox
            </a>
            <a href="#philosophy" className="transition hover:text-[#203d35]">
              Philosophy
            </a>
            <a href="#features" className="transition hover:text-[#203d35]">
              Capabilities
            </a>
            <a href="#compare" className="transition hover:text-[#203d35]">
              The Contrast
            </a>
            <a href="#faq" className="transition hover:text-[#203d35]">
              FAQ
            </a>
          </nav>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/sign-in"
              className="rounded-full px-4 py-2 text-xs font-semibold text-[#5a4832] transition hover:bg-[#ede3ce] hover:text-[#203d35]"
              data-testid="link-header-signin"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-[#203d35] px-5 py-2.5 text-xs font-semibold text-[#f7f1e6] shadow-[0_4px_16px_-4px_rgba(32,61,53,.45)] transition hover:-translate-y-0.5 hover:bg-[#294e44] active:scale-95"
              data-testid="link-header-signup"
            >
              <Sparkles size={13} className="text-[#dbab77]" />
              Start Free Ledger
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-28">
        {/* Organic Background ambient blurs */}
        <div className="pointer-events-none absolute -left-40 top-10 h-[500px] w-[500px] rounded-full bg-[#dbab77]/12 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-32 h-[550px] w-[550px] rounded-full bg-[#203d35]/8 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 bg-[#cd8867]/6 blur-2xl" />

        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left Content */}
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#d9c8a9] bg-[#f4eddd] px-4 py-1.5 shadow-2xs">
                <span className="flex h-2 w-2 rounded-full bg-[#3d7045] animate-ping" />
                <span className="text-[10.5px] font-bold uppercase tracking-[.18em] text-[#7d6040]">
                  The Intellectual Ledger · Free &amp; Sovereign
                </span>
              </div>

              <h1 className="serif text-[52px] leading-[0.98] tracking-[-0.04em] text-[#203d35] sm:text-[68px] lg:text-[76px]">
                A quiet mind.<br />
                <span className="italic font-serif text-[#9a7455]">An honest ledger.</span>
              </h1>

              <p className="mt-6 text-[15.5px] leading-relaxed text-[#5e4f3a] sm:text-[17px]">
                Most personal finance apps treat you like an overworked corporate accountant. Money Companion returns to first principles: write or speak in plain everyday words, track informal community loans with grace, and understand your life with zero ads, zero surveillance, and complete peace of mind.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2.5 rounded-full bg-[#203d35] px-8 py-4 text-sm font-semibold text-[#f7f1e6] shadow-[0_12px_36px_-10px_rgba(32,61,53,.5)] transition hover:-translate-y-0.5 hover:bg-[#284c42] active:scale-95"
                  data-testid="button-hero-start"
                >
                  Create Your Free Space <ArrowRight size={16} />
                </Link>
                <a
                  href="#sandbox"
                  className="inline-flex items-center gap-2 rounded-full border border-[#d4c5a9] bg-white/70 px-6 py-4 text-sm font-semibold text-[#4e3f2c] transition hover:bg-white active:scale-95"
                >
                  Test Interactive Sandbox <ChevronDown size={15} />
                </a>
              </div>

              {/* Intellectual Principles Pills */}
              <div className="mt-10 grid grid-cols-2 gap-3 pt-6 border-t border-[#e2d5be] sm:grid-cols-4">
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-[#203d35]">15+ Languages</span>
                  <span className="text-[10px] text-[#7a6b57]">Native Devanagari &amp; Latin</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-[#203d35]">100+ Currencies</span>
                  <span className="text-[10px] text-[#7a6b57]">NPR, INR, USD, EUR &amp; more</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-[#203d35]">Peer Lending</span>
                  <span className="text-[10px] text-[#7a6b57]">First-class loan tracking</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-[#203d35]">100% Sovereign</span>
                  <span className="text-[10px] text-[#7a6b57]">Your data never sold</span>
                </div>
              </div>
            </div>

            {/* Right Hero Showcase — Live Stack Card Preview */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative rounded-[32px] border border-[#d9c8a9] bg-gradient-to-b from-[#faf5eb] to-[#f2e7d3] p-6 shadow-[0_24px_70px_-20px_rgba(32,61,53,.3)] sm:p-7">
                {/* Header of Simulated Card */}
                <div className="flex items-center justify-between border-b border-[#e5dac5] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#203d35] text-[#dbab77]">
                      <Sparkles size={15} />
                    </span>
                    <div>
                      <p className="serif text-[17px] font-semibold text-[#203d35]">Personal Ledger View</p>
                      <p className="text-[10px] text-[#7d694b]">Kathmandu &amp; Global Nomad Sync</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#dce9d9] px-2.5 py-1 text-[10px] font-bold text-[#3d6b42]">
                    Active · 100% Private
                  </span>
                </div>

                {/* Simulated Balance Box */}
                <div className="mt-5 rounded-2xl bg-[#203d35] p-5 text-[#f7f1e6] shadow-sm">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/60">
                    <span>True Net Position</span>
                    <span className="flex items-center gap-1 font-semibold text-[#dbab77]">
                      <Scale size={11} /> Loans Balanced
                    </span>
                  </div>
                  <p className="mono mt-2 text-[32px] font-medium tracking-tight text-[#dbab77]">
                    Rs 68,450
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[11px]">
                    <div>
                      <span className="text-white/50">Lent to Friends:</span>{" "}
                      <strong className="text-white/90">Rs 15,000</strong>
                    </div>
                    <div>
                      <span className="text-white/50">Borrowed:</span>{" "}
                      <strong className="text-white/90">Rs 5,000</strong>
                    </div>
                  </div>
                </div>

                {/* Realistic Natural Notes Preview */}
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl bg-white/70 p-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e3eedd] text-[#3d6b42]">
                        <HeartHandshake size={15} />
                      </span>
                      <div>
                        <p className="text-[11.5px] font-bold text-[#203d35]">Loan to Ram (साथी सापट)</p>
                        <p className="text-[9.5px] text-[#806f58]">Peer Credit · Repayment by Dashain</p>
                      </div>
                    </div>
                    <span className="mono text-[12px] font-semibold text-[#3d6b42]">+ Rs 5,000</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white/70 p-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5e6d6] text-[#8a5238]">
                        <ArrowUpRight size={15} />
                      </span>
                      <div>
                        <p className="text-[11.5px] font-bold text-[#203d35]">Tea &amp; Momo with Family</p>
                        <p className="text-[9.5px] text-[#806f58]">Food &amp; Dining · Natural voice note</p>
                      </div>
                    </div>
                    <span className="mono text-[12px] font-semibold text-[#8a5238]">− Rs 650</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white/70 p-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e1edf7] text-[#2c5f85]">
                        <ArrowDownLeft size={15} />
                      </span>
                      <div>
                        <p className="text-[11.5px] font-bold text-[#203d35]">Remote Consulting Invoice</p>
                        <p className="text-[9.5px] text-[#806f58]">Primary Income · Direct deposit</p>
                      </div>
                    </div>
                    <span className="mono text-[12px] font-semibold text-[#2c5f85]">+ Rs 85,000</span>
                  </div>
                </div>

                {/* Footer Micro-note */}
                <div className="mt-4 flex items-center justify-between text-[10px] text-[#8a765a]">
                  <span>AI Agent Ready: Gemini 3.5 &amp; OpenRouter</span>
                  <span className="font-semibold text-[#203d35]">0 Ads · 0 Trackers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive Live Sandbox ─────────────────────────────────────── */}
      <section id="sandbox" className="scroll-mt-20 border-y border-[#e2d5be] bg-[#f4eddd]/60 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#203d35] px-3.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#dbab77]">
              <Zap size={11} /> Interactive Sandbox
            </span>
            <h2 className="serif mt-3 text-[36px] tracking-tight text-[#203d35] sm:text-[46px]">
              Try it right here, <span className="italic font-serif text-[#9a7455]">in your own words.</span>
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-[14px] text-[#63533e]">
              No sign-up required. Click any preset or type your own note in Nepali, Hindi, English, Spanish or Japanese. Watch how effortlessly natural speech becomes structured clarity.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {DEMO_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  demoInput === preset.sentence
                    ? "border-[#203d35] bg-[#203d35] text-[#f7f1e6] shadow-xs"
                    : "border-[#d8caa8] bg-white/80 text-[#594732] hover:bg-white hover:border-[#203d35]"
                }`}
              >
                <span>{preset.flag}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>

          {/* Interactive Input Box */}
          <div className="mt-6 rounded-[28px] border border-[#d9c8a9] bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={demoInput}
                  onChange={(e) => {
                    setDemoInput(e.target.value);
                    handleParse(e.target.value);
                  }}
                  placeholder="e.g. Lent 5000 to Ram or Spent 250 on tea and snacks"
                  className="w-full rounded-2xl border border-[#d8caa8] bg-[#fdfbf7] px-4 py-3.5 text-sm font-medium text-[#203d35] placeholder:text-[#9e8f77] focus:border-[#203d35] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* Voice button */}
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-90 ${
                    listening
                      ? "bg-[#b76654] text-white animate-pulse"
                      : "border border-[#d8caa8] bg-[#f4eddd] text-[#203d35] hover:bg-[#ede2cb]"
                  }`}
                  title={listening ? "Stop listening" : "Click to speak into sandbox"}
                >
                  {listening ? <Square size={16} className="fill-current" /> : <Mic size={18} />}
                </button>

                <button
                  type="button"
                  onClick={() => handleParse(demoInput)}
                  className="rounded-2xl bg-[#203d35] px-6 py-3.5 text-xs font-bold text-[#f7f1e6] transition hover:bg-[#284e44] active:scale-95"
                >
                  Parse Note
                </button>
              </div>
            </div>

            {speechError && (
              <p className="mt-2 text-[11px] text-[#9c4533]">{speechError}</p>
            )}

            {/* Live Parsing Output Display */}
            <div className="mt-5 rounded-2xl border border-[#e5dac5] bg-[#faf6ee] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6dbc7] pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      parsedDemo.isLoan
                        ? "bg-[#e2eaf5] text-[#2c5f85]"
                        : parsedDemo.type === "income"
                        ? "bg-[#e0edd9] text-[#346639]"
                        : "bg-[#f5e6de] text-[#8e4836]"
                    }`}
                  >
                    {parsedDemo.isLoan
                      ? `Peer Credit (${parsedDemo.loanType === "lent" ? "Lent Out" : "Borrowed In"})`
                      : parsedDemo.type === "income"
                      ? "Inbound Income"
                      : "Living Expense"}
                  </span>
                  <span className="text-[11px] text-[#786751]">
                    Category: <strong>{parsedDemo.category}</strong>
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-[#8f7d63]">
                  ⚡ Real-Time Client-Side Parsing
                </span>
              </div>

              <div className="mt-3.5 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="serif text-[26px] font-semibold text-[#203d35]">
                    {parsedDemo.currencySymbol} {parsedDemo.amount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#5e4f3a]">
                    {parsedDemo.commentary}
                  </p>
                  {parsedDemo.counterparty && (
                    <p className="mt-1 text-[11px] font-medium text-[#2c5f85]">
                      Counterparty contact: <strong>{parsedDemo.counterparty}</strong>
                    </p>
                  )}
                </div>

                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#203d35] px-5 py-2.5 text-xs font-semibold text-[#f7f1e6] shadow-xs transition hover:bg-[#2c5348]"
                >
                  Save into your space <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Philosophy of Quiet Money (Intellectual Depth) ───────────── */}
      <section id="philosophy" className="scroll-mt-16 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
              First Principles of Financial Clarity
            </span>
            <h2 className="serif mt-2 text-[38px] leading-[1.05] tracking-tight text-[#203d35] sm:text-[50px]">
              The Philosophy of <span className="italic font-serif text-[#9a7455]">Quiet Money.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#61513c]">
              We believe personal finance software failed because it was built for institutions, not humans. Here is the cognitive architecture underpinning every detail of Money Companion.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {PHILOSOPHY_PILLARS.map((pillar) => (
              <div
                key={pillar.num}
                className="group relative flex flex-col justify-between rounded-[28px] border border-[#d9c8a9]/80 bg-gradient-to-b from-[#faf5eb] to-[#f4ecd9] p-7 transition hover:-translate-y-1 hover:border-[#203d35]/30 hover:shadow-[0_16px_40px_-15px_rgba(32,61,53,.15)] sm:p-9"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="mono text-[14px] font-bold text-[#9a7455]">{pillar.num}</span>
                    <span className="rounded-full bg-[#f0e4cf] px-3 py-1 text-[10px] font-bold tracking-wider text-[#735d44]">
                      {pillar.tag}
                    </span>
                  </div>
                  <h3 className="serif mt-4 text-[24px] font-medium tracking-tight text-[#203d35]">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#5c4d38]">
                    {pillar.body}
                  </p>
                </div>
                <div className="mt-6 border-t border-[#e2d5bd] pt-4">
                  <p className="serif italic text-[13.5px] text-[#7a644b]">{pillar.quote}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive Capabilities Showcase (Tabs) ─────────────────────── */}
      <section id="features" className="scroll-mt-16 border-t border-[#e2d5be] bg-[#f5eee0] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
              Capabilities Without Clutter
            </span>
            <h2 className="serif mt-2 text-[38px] tracking-tight text-[#203d35] sm:text-[48px]">
              Crafted for real life, <span className="italic font-serif text-[#9a7455]">not balance sheets.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[14.5px] text-[#63533e]">
              Explore the four core engines powering your day-to-day clarity.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {[
              { id: "journal", label: "Natural Journaling & Voice", icon: <AudioLines size={15} /> },
              { id: "loans", label: "Peer & Community Lending", icon: <HeartHandshake size={15} /> },
              { id: "intel", label: "Money Intel & True Runway", icon: <Scale size={15} /> },
              { id: "currencies", label: "100+ World Currencies", icon: <Globe2 size={15} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition active:scale-95 ${
                  activeTab === tab.id
                    ? "bg-[#203d35] text-[#f7f1e6] shadow-sm"
                    : "border border-[#d9c8a9] bg-white/70 text-[#614e38] hover:bg-white hover:text-[#203d35]"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Tab Showcase Pane */}
          <div className="mt-8 overflow-hidden rounded-[32px] border border-[#d9c8a9] bg-white p-6 shadow-sm sm:p-10">
            {activeTab === "journal" && (
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div>
                  <span className="rounded-full bg-[#dce9d9] px-3 py-1 text-[10px] font-bold text-[#3d6b42]">
                    Natural Language Processing
                  </span>
                  <h3 className="serif mt-3 text-[32px] font-medium tracking-tight text-[#203d35]">
                    Speak or type as if talking to a trusted friend.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#5c4d38]">
                    Whether you dictate in Nepali ("चिया र समोसा १२०"), type in Hindi ("किराया 15000 दिया"), or speak in English, the natural agent automatically isolates amounts, identifies merchants, assigns the right category, and formats the transaction date.
                  </p>
                  <ul className="mt-5 space-y-2.5 text-xs text-[#524330]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#3d6b42]" /> Multilingual speech recognition with push-to-talk efficiency
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#3d6b42]" /> Always reviews as a draft card before touching your database
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#3d6b42]" /> Automatic Devanagari digit normalization (०-९ converted instantly)
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-[#e5dac5] bg-[#faf6ee] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a765a]">Draft Card Preview</p>
                  <div className="mt-3 rounded-xl bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-[#8e4836]">Expense · Food &amp; Dining</span>
                    <p className="mono mt-1 text-[26px] font-medium text-[#203d35]">Rs 240</p>
                    <p className="mt-1 text-xs font-semibold text-[#304036]">Tea &amp; Snacks with Ramesh</p>
                    <p className="mt-0.5 text-[10px] text-[#7a6b57]">Entered via Nepali voice transcription · Ready to confirm</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "loans" && (
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div>
                  <span className="rounded-full bg-[#e2eaf5] px-3 py-1 text-[10px] font-bold text-[#2c5f85]">
                    Peer Credit Engine
                  </span>
                  <h3 className="serif mt-3 text-[32px] font-medium tracking-tight text-[#203d35]">
                    Lending to friends and family, minus the awkwardness.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#5c4d38]">
                    Personal loans among loved ones represent an immense pillar of social capital. Money Companion treats peer debt as a sacred, first-class citizen. Record partial repayments, track running balances, and keep clear agreements without tension.
                  </p>
                  <ul className="mt-5 space-y-2.5 text-xs text-[#524330]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#2c5f85]" /> Separate tracking for "I Lent" vs "I Borrowed"
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#2c5f85]" /> Never inflates your living expense reports
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#2c5f85]" /> Integrated repayment history and balance adjustments
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-[#e5dac5] bg-[#faf6ee] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a765a]">Peer Loan Record</p>
                  <div className="mt-3 rounded-xl bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-[#2c5f85]">Lent to Contact</span>
                      <span className="rounded-full bg-[#e2eaf5] px-2 py-0.5 text-[9px] font-bold text-[#2c5f85]">Active</span>
                    </div>
                    <p className="serif mt-1 text-[19px] font-semibold text-[#203d35]">Ram Shrestha</p>
                    <p className="mono mt-1 text-[22px] font-medium text-[#2c5f85]">Rs 5,000</p>
                    <p className="mt-2 text-[10.5px] text-[#7a6b57]">Due by: Nov 15 · 0% Interest (Friendly)</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "intel" && (
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div>
                  <span className="rounded-full bg-[#f4eddd] px-3 py-1 text-[10px] font-bold text-[#7d6040]">
                    Holistic Position
                  </span>
                  <h3 className="serif mt-3 text-[32px] font-medium tracking-tight text-[#203d35]">
                    Understand your true net runway at a glance.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#5c4d38]">
                    Bank balances lie because they ignore money you owe to peers or money friends owe you. Money Companion combines transactions, active loans, and opening balances to show your true financial posture.
                  </p>
                  <ul className="mt-5 space-y-2.5 text-xs text-[#524330]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#7d6040]" /> True Position = Bank Balance + Money Lent − Money Borrowed
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#7d6040]" /> Savings velocity and monthly burn projections
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#7d6040]" /> Intelligent conversational insights using Gemini or OpenRouter
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-[#e5dac5] bg-[#faf6ee] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a765a]">Position Runway</p>
                  <div className="mt-3 rounded-xl bg-white p-4 shadow-2xs">
                    <p className="text-[10px] font-bold uppercase text-[#7d6040]">Estimated Liquid Runway</p>
                    <p className="mono mt-1 text-[24px] font-medium text-[#203d35]">4.2 Months</p>
                    <p className="mt-1 text-xs text-[#5c4d38]">Based on your average monthly living burn rate of Rs 21,500.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "currencies" && (
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div>
                  <span className="rounded-full bg-[#e8dff5] px-3 py-1 text-[10px] font-bold text-[#5a4580]">
                    Nomadic Architecture
                  </span>
                  <h3 className="serif mt-3 text-[32px] font-medium tracking-tight text-[#203d35]">
                    Designed for global citizens, cross-border families &amp; nomads.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#5c4d38]">
                    Whether you live in Nepal earning in USD, or reside in Europe sending money to India, switch your active world currency anytime with a single tap. All amounts adapt instantly without breaking past notes.
                  </p>
                  <ul className="mt-5 space-y-2.5 text-xs text-[#524330]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#5a4580]" /> 100+ ISO-standard world currencies
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#5a4580]" /> Respects local numerical separators (lakhs &amp; crores or millions)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#5a4580]" /> Multi-currency expense tagging
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-[#e5dac5] bg-[#faf6ee] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a765a]">Quick Currency Switcher</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CURRENCIES.map((c) => (
                      <span key={c.code} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#203d35] shadow-2xs">
                        <span>{c.flag}</span>
                        <span>{c.code} ({c.symbol})</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Interactive Audio & Multilingual Voice Greeting Preview ───────── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="rounded-[32px] border border-[#d9c8a9] bg-gradient-to-br from-[#203d35] via-[#284f42] to-[#1c352d] p-8 text-[#f7f1e6] shadow-xl sm:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#dbab77]">
                  <Volume2 size={12} /> Multilingual Audio Companion
                </span>
                <h3 className="serif mt-3 text-[30px] font-medium tracking-tight text-[#f7f1e6] sm:text-[38px]">
                  Hear your financial picture spoken aloud.
                </h3>
                <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-white/75">
                  Every morning, Money Companion can greet you in your native language with a polite, calm summary of your recorded balance and spending trajectory.
                </p>
              </div>

              {/* Language Selector + Play Button */}
              <div className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:w-auto">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#dbab77]">
                  Select Sample Language:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "ne", label: "नेपाली" },
                    { id: "en", label: "English" },
                    { id: "hi", label: "हिन्दी" },
                    { id: "es", label: "Español" },
                    { id: "fr", label: "Français" },
                    { id: "ja", label: "日本語" },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setGreetingLang(l.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        greetingLang === l.id
                          ? "bg-[#dbab77] text-[#203d35]"
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={playSampleGreeting}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#dbab77] px-5 py-3 text-xs font-bold text-[#203d35] shadow-xs transition hover:bg-[#e4ba88] active:scale-95"
                >
                  {greetingPlaying ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  <span>{greetingPlaying ? "Stop Audio" : "Listen to Audio Greeting"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contrast Matrix: Traditional vs Spreadsheets vs Us ───────────── */}
      <section id="compare" className="scroll-mt-16 border-t border-[#e2d5be] bg-[#f7f2e7] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
              The Intellectual Contrast
            </span>
            <h2 className="serif mt-2 text-[38px] tracking-tight text-[#203d35] sm:text-[46px]">
              Why traditional finance apps fail us.
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-[14.5px] text-[#63533e]">
              A side-by-side comparison of philosophies and architectures.
            </p>
          </div>

          <div className="mt-12 overflow-x-auto rounded-[28px] border border-[#d9c8a9] bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#e5dac5] bg-[#faf6ee] text-[#203d35]">
                  <th className="p-4 sm:p-5 font-bold uppercase tracking-wider text-[10.5px]">Dimension</th>
                  <th className="p-4 sm:p-5 font-bold text-[12px] text-[#914e40]">Traditional FinTech Apps</th>
                  <th className="p-4 sm:p-5 font-bold text-[12px] text-[#7d6040]">Excel / Google Sheets</th>
                  <th className="p-4 sm:p-5 font-bold text-[13px] text-[#203d35] bg-[#edf4ea]">Money Companion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee5d3] text-[#554632]">
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-[#203d35]">Data Privacy</td>
                  <td className="p-4 sm:p-5">Telemetry tracked; metadata sold to marketers</td>
                  <td className="p-4 sm:p-5">Stored on Google/Microsoft cloud unencrypted</td>
                  <td className="p-4 sm:p-5 font-semibold text-[#203d35] bg-[#edf4ea]/50">
                    100% Client-side keys; zero data reselling
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-[#203d35]">Time to Log a Coffee</td>
                  <td className="p-4 sm:p-5">1–2 minutes of nested category pickers</td>
                  <td className="p-4 sm:p-5">Opening laptop, locating row, formula entry</td>
                  <td className="p-4 sm:p-5 font-semibold text-[#203d35] bg-[#edf4ea]/50">
                    3 seconds: speak or type "coffee 240"
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-[#203d35]">Peer Loans to Friends</td>
                  <td className="p-4 sm:p-5">Ignored or awkwardly marked as expenses</td>
                  <td className="p-4 sm:p-5">Requires complex manual multi-tab accounting</td>
                  <td className="p-4 sm:p-5 font-semibold text-[#203d35] bg-[#edf4ea]/50">
                    First-class lending engine with running balances
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-[#203d35]">Multilingual &amp; Devanagari</td>
                  <td className="p-4 sm:p-5">English-only or robotic machine translation</td>
                  <td className="p-4 sm:p-5">No language parsing capability</td>
                  <td className="p-4 sm:p-5 font-semibold text-[#203d35] bg-[#edf4ea]/50">
                    Full native Nepali, Hindi, Spanish, French &amp; more
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-[#203d35]">Mental State</td>
                  <td className="p-4 sm:p-5">Anxious guilt notifications and upsells</td>
                  <td className="p-4 sm:p-5">Overwhelming visual clutter and formula breaks</td>
                  <td className="p-4 sm:p-5 font-semibold text-[#203d35] bg-[#edf4ea]/50">
                    Calm, quiet reflection and steady agency
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-[#203d35]">Price</td>
                  <td className="p-4 sm:p-5">$8–$15 / month subscription forever</td>
                  <td className="p-4 sm:p-5">Free (or Microsoft 365 fee)</td>
                  <td className="p-4 sm:p-5 font-bold text-[#203d35] bg-[#edf4ea]/50">
                    $0 Forever for personal use
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Community Testimonials & Authentic Voices ────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
              Real Human Voices
            </span>
            <h2 className="serif mt-2 text-[38px] tracking-tight text-[#203d35] sm:text-[46px]">
              Loved by thoughtful people around the world.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                quote:
                  "Finally, an app where I can record 'साथीलाई सापट ५०००' in Nepali and it understands who owes whom without messing up my monthly spending totals.",
                author: "Prabhat Shrestha",
                location: "Kathmandu, Nepal",
                context: "Independent Consultant",
              },
              {
                quote:
                  "I was tired of finance apps demanding my online banking passwords. Money Companion gives me back the dignity of conscious journaling with zero surveillance.",
                author: "Elena Rostova",
                location: "Berlin, Germany",
                context: "Software Architect",
              },
              {
                quote:
                  "The loan tracking alone saved several friendships. We lend money back and forth frequently, and now everyone has total clarity without awkward conversations.",
                author: "Arjun Verma",
                location: "Pune, India",
                context: "Small Business Founder",
              },
            ].map((t) => (
              <div
                key={t.author}
                className="flex flex-col justify-between rounded-[24px] border border-[#d9c8a9]/80 bg-[#fbf7ee] p-7 shadow-xs"
              >
                <div>
                  <span className="serif text-[32px] leading-none text-[#dbab77]">“</span>
                  <p className="serif mt-2 text-[16px] leading-relaxed text-[#203d35]">
                    {t.quote}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3 border-t border-[#e8ddc9] pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#203d35] font-serif text-xs font-bold text-[#dbab77]">
                    {t.author[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#203d35]">{t.author}</p>
                    <p className="text-[10px] text-[#7a6b57]">
                      {t.location} · {t.context}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Section ──────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-16 border-t border-[#e2d5be] bg-[#f5eee0]/70 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="text-center">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
              Frequently Clarified
            </span>
            <h2 className="serif mt-2 text-[38px] tracking-tight text-[#203d35] sm:text-[46px]">
              Questions &amp; Architectural Answers
            </h2>
          </div>

          <div className="mt-12 space-y-3">
            {FAQS.map((faq, index) => (
              <div
                key={faq.q}
                className="overflow-hidden rounded-[22px] border border-[#d9c8a9] bg-white transition"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-[#203d35] sm:p-6"
                >
                  <span className="pr-4">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[#9a7455] transition-transform ${
                      expandedFaq === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expandedFaq === index && (
                  <div className="border-t border-[#f0e6d4] bg-[#faf6ee] p-5 text-xs leading-relaxed text-[#5c4d38] sm:p-6">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final Warm Call to Action ────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#203d35] py-20 text-center text-[#f7f1e6] sm:py-28">
        <div className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-[#dbab77]/10 blur-2xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#cd8867]/10 blur-2xl" />

        <div className="relative mx-auto max-w-4xl px-5 sm:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#dbab77]">
            Start Your Journey Today
          </span>
          <h2 className="serif mt-4 text-[42px] leading-[1.03] tracking-tight sm:text-[56px]">
            Your clearest financial picture<br />
            <span className="italic font-serif text-[#dbab77]">starts with one honest note.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-white/70">
            Free forever for personal use. Bring your own AI key or use the built-in local heuristic engine. No credit card, no bank sync, no noise.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2.5 rounded-full bg-[#dbab77] px-8 py-4 text-sm font-bold text-[#203d35] shadow-[0_10px_30px_-5px_rgba(219,171,119,.4)] transition hover:-translate-y-0.5 hover:bg-[#e5bc8b] active:scale-95"
              data-testid="button-cta-signup"
            >
              Start Free — Create Your Ledger <ArrowRight size={16} />
            </Link>
          </div>

          <p className="mt-5 text-[11px] text-white/50">
            100% Private to your account · Any language · Any world currency
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#e2d5be] bg-[#f7f2e7] py-12 text-[#6e5d46]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
          <Brand />
          <p className="text-center text-xs sm:text-left">
            A quiet, calm companion for human finances. Built with care. © {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-5 text-xs font-semibold">
            <Link href="/sign-in" className="transition hover:text-[#203d35]">
              Sign In
            </Link>
            <Link href="/sign-up" className="transition hover:text-[#203d35]">
              Get Started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
