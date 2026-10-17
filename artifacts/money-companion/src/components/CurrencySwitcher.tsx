import { useState } from "react";
import { Check, ChevronDown, Globe, Sparkles } from "lucide-react";
import { playClick } from "@/lib/sounds";
import { useCurrency } from "@/hooks/useCurrency";

export function CurrencyBadgeSwitcher() {
  const { currency, symbol, setCurrency, availableCurrencies } = useCurrency();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
        title="Switch currency"
        data-testid="button-currency-badge"
      >
        <span className="mono text-[11px] font-bold text-[#e6b98d]">{symbol}</span>
        <span>{currency}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 max-h-64 w-52 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-2xl">
            <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Select Currency
            </p>
            {availableCurrencies.slice(0, 15).map((c) => (
              <button
                key={c.code}
                onClick={() => {
                  setCurrency(c.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                  currency === c.code ? "bg-primary text-primary-foreground font-bold" : "hover:bg-muted text-foreground"
                }`}
                data-testid={`option-currency-${c.code}`}
              >
                <span>
                  <strong className="mono mr-1.5">{c.symbol}</strong> {c.code} · {c.name}
                </span>
                {currency === c.code && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function GlobalConfigurationSection() {
  const {
    currency,
    currencyInfo,
    setCurrency,
    aiLanguage,
    setAiLanguage,
    formatMoney,
    availableCurrencies,
    availableLanguages,
  } = useCurrency();

  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  // Collapsible boxes — same pattern as the Free AI key panel.
  // All default to closed so the page stays compact; tap to open.
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const samplePreview = formatMoney(14250.75);

  return (
    <div className="space-y-6">
      {/* Worldwide Currency Card — collapsible like the Free AI key box */}
      <div className="rounded-[24px] border border-border bg-card p-5 sm:p-6 soft-shadow" data-testid="panel-currency-config">
        <button
          onClick={() => {
            playClick();
            setCurrencyOpen((v) => !v);
          }}
          aria-expanded={currencyOpen}
          title="Active currency settings — click to close/open this box"
          className="flex w-full items-center justify-between gap-3 border-b border-border/70 pb-4 text-left"
          data-testid="button-currency-toggle"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#29473d]/10 text-[#29473d]">
              <Globe size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
                Worldwide Configuration
              </span>
              <span className="serif block text-2xl font-bold tracking-tight">Active Currency</span>
              {!currencyOpen && (
                <span className="block truncate text-[11px] font-normal text-muted-foreground">
                  {currencyInfo.symbol} {currency} · {currencyInfo.name} — tap to open.
                </span>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-right">
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Current</span>
              <span className="mono text-sm font-bold text-primary">
                {currencyInfo.symbol} {currency}
              </span>
            </span>
            <ChevronDown size={17} className={`text-muted-foreground transition ${currencyOpen ? "rotate-180" : ""}`} />
          </span>
        </button>

        {currencyOpen && (
        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-bold text-foreground">
                Select any currency in the world
              </label>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setGridOpen((v) => !v);
                }}
                aria-expanded={gridOpen}
                title={gridOpen ? "Close the currency boxes (details: hides the grid, preview stays)" : "Open the currency boxes (details: shows all currency options)"}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition hover:text-foreground"
                data-testid="button-currency-grid-toggle"
              >
                {gridOpen ? "Close boxes" : "Open boxes"}
                <ChevronDown size={12} className={`transition-transform ${gridOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
            {gridOpen && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {availableCurrencies.slice(0, 16).map((c) => {
                const active = currency === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      playClick();
                      setCurrency(c.code);
                      setShowCustom(false);
                    }}
                    title={`${c.name} — click to set as active currency`}
                    className={`flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition active:scale-95 ${
                      active
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                        : "border-border bg-background hover:border-primary/50 text-foreground"
                    }`}
                    data-testid={`select-currency-${c.code}`}
                  >
                    <div>
                      <span className="mono block font-bold text-sm leading-none">{c.symbol} {c.code}</span>
                      <span className="text-[10px] text-muted-foreground truncate block mt-0.5">{c.name}</span>
                    </div>
                    {active && <Check size={14} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            {!showCustom ? (
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                data-testid="button-custom-currency"
              >
                + Enter custom currency code (e.g. BHD, OMR, NZD)
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={5}
                  placeholder="e.g. CHF"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value.toUpperCase())}
                  className="field mono text-xs uppercase w-28"
                  data-testid="input-custom-currency"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customInput.trim()) {
                      setCurrency(customInput.trim());
                      setCustomInput("");
                      setShowCustom(false);
                    }
                  }}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  data-testid="button-apply-custom-currency"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Live Formatting Preview — collapsible */}
          <div className="mt-4 rounded-2xl bg-[#efe8d9]/70 p-4 text-xs">
            <button
              type="button"
              onClick={() => {
                playClick();
                setPreviewOpen((v) => !v);
              }}
              aria-expanded={previewOpen}
              title={previewOpen ? "Close the preview box" : "Open the preview box"}
              className="flex w-full items-center justify-between text-left"
              data-testid="button-currency-preview-toggle"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#735843] block">
                Live Currency Formatting Preview
              </span>
              <ChevronDown size={13} className={`text-[#735843] transition-transform ${previewOpen ? "rotate-180" : ""}`} />
            </button>
            {previewOpen && (
              <>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="mono text-2xl font-bold text-[#2d473b]">{samplePreview}</span>
                  <span className="text-muted-foreground">({currencyInfo.name})</span>
                </div>
                <p className="mt-1.5 text-[11px] text-[#5e6b5d] leading-relaxed">
                  Applied automatically to your Dashboard, Transactions, Loans &amp; Debt, Categories analysis, and AI agent drafts.
                </p>
              </>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Multilingual AI & Interactivity Card — collapsible too */}
      <div className="rounded-[24px] border border-border bg-card p-5 sm:p-6 soft-shadow" data-testid="panel-ai-lang-config">
        <button
          onClick={() => {
            playClick();
            setLangOpen((v) => !v);
          }}
          aria-expanded={langOpen}
          title="AI language settings — click to close/open this box"
          className="flex w-full items-center justify-between gap-3 border-b border-border/70 pb-4 text-left"
          data-testid="button-lang-toggle"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#e3ebdd] text-[#3d5c43]">
              <Sparkles size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
                Interactive AI &amp; Worldwide Languages
              </span>
              <span className="serif block text-2xl font-bold tracking-tight">AI Language &amp; Dialogue</span>
            </span>
          </span>
          <ChevronDown size={17} className={`shrink-0 text-muted-foreground transition ${langOpen ? "rotate-180" : ""}`} />
        </button>

        {langOpen && (
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-foreground">
              Response Language
            </label>
            <select
              value={aiLanguage}
              onChange={(e) => setAiLanguage(e.target.value)}
              className="field text-sm"
              data-testid="select-ai-language"
            >
              {availableLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/50 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#3d5c43]">
              <span className="h-2 w-2 rounded-full bg-[#4e7d56] animate-pulse" />
              Full Worldwide Multilingual Input &amp; Output
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              You can type or speak in <strong>any language in the world</strong> (English, नेपाली, हिन्दी, Español, Français, Deutsch, 中文, 日本語, العربية, etc.). The AI agent will detect your language and reply conversationally and fluently in the same language, while accurately parsing amounts, categories, and loans in <strong>{currency} ({currencyInfo.symbol})</strong>.
            </p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
