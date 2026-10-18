import { useState } from "react";
import { Check, ChevronDown, KeyRound, LoaderCircle, PlugZap, RefreshCw, Trash2 } from "lucide-react";
import {
  PROVIDER_META,
  defaultModelFor,
  detectProviderFromKey,
  listGeminiModels,
  listOpenRouterModels,
  modelMatchesProvider,
  testConnection,
  type AiModelOption,
  type AiProviderId,
  type AiSettings,
} from "@/lib/ai-providers";
import { maskKey, useAiSettings } from "@/hooks/useAiSettings";
import { AiCreditQuotaCard } from "@/components/AiCreditQuotaCard";

const PROVIDERS: AiProviderId[] = ["openrouter", "gemini", "custom"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function AiSettingsPanel({ compact = false, defaultOpen }: { compact?: boolean; defaultOpen?: boolean }) {
  const { settings, update, clear, configured } = useAiSettings();
  const [open, setOpen] = useState(defaultOpen ?? compact);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [models, setModels] = useState<AiModelOption[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelMsg, setModelMsg] = useState("");
  const [customModel, setCustomModel] = useState(false);
  const meta = PROVIDER_META[settings.provider];
  // Plain-language helpers so users never need to know key formats:
  // a Gemini key only works with gemini-* models, an OpenRouter key only
  // with OpenRouter slugs.
  const detectedProvider = detectProviderFromKey(settings.apiKey);
  const keyTabMismatch = detectedProvider !== null && detectedProvider !== settings.provider;
  const detectedLabel =
    detectedProvider === "gemini" ? "Google Gemini" : detectedProvider === "openrouter" ? "OpenRouter" : "";
  const modelOk = modelMatchesProvider(settings.model, settings.provider);

  const setProvider = (provider: AiProviderId) => {
    setTestMsg("");
    setTestOk(null);
    setModels(null);
    setModelMsg("");
    setCustomModel(false);
    update({ provider });
  };

  const refreshModels = async () => {
    setLoadingModels(true);
    setModelMsg("");
    try {
      if (settings.provider === "openrouter") {
        // Public endpoint — works even before pasting a key.
        const list = await listOpenRouterModels();
        setModels(list);
        setCustomModel(false);
        if (!list.some((m) => m.id === settings.model)) update({ model: list[0].id });
        setModelMsg(`${list.length} free models live right now — the list rotates, refresh anytime.`);
      } else if (settings.provider === "gemini") {
        if (!settings.apiKey.trim()) {
          setModelMsg("Paste your Gemini key first, then refresh the list.");
          return;
        }
        const list = await listGeminiModels(settings.apiKey.trim());
        setModels(list);
        setCustomModel(false);
        if (!list.some((m) => m.id === settings.model)) {
          const preferred = list.find((m) => m.id === defaultModelFor("gemini")) || list[0];
          update({ model: preferred.id });
        }
        setModelMsg(`${list.length} models available on your key.`);
      }
    } catch (e) {
      setModelMsg(e instanceof Error ? e.message : "Could not load models.");
    } finally {
      setLoadingModels(false);
    }
  };

  const onTest = async () => {
    const payload: AiSettings = { ...settings, apiKey: settings.apiKey.trim() };
    if (!payload.apiKey) {
      setTestOk(false);
      setTestMsg("Paste a key first.");
      return;
    }
    const detected = detectProviderFromKey(payload.apiKey);
    if (detected && detected !== payload.provider) {
      setTestOk(false);
      setTestMsg(
        `That looks like a ${detected === "gemini" ? "Google Gemini" : "OpenRouter"} key, but you're on the other tab. Press “Switch” above first — keys only work on their own tab.`,
      );
      return;
    }
    if (!modelMatchesProvider(payload.model, payload.provider)) {
      setTestOk(false);
      setTestMsg("That model name doesn't belong to this key type. Press “Use the recommended model” above, or load the live list.");
      return;
    }
    if (payload.provider === "custom" && !(payload.baseUrl || "").trim()) {
      setTestOk(false);
      setTestMsg("Enter the custom base URL first.");
      return;
    }
    setTesting(true);
    setTestMsg("");
    setTestOk(null);
    try {
      await testConnection(payload);
      setTestOk(true);
      setTestMsg("Connected — your free key works.");
    } catch (e) {
      setTestOk(false);
      setTestMsg(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-border bg-card p-5 soft-shadow sm:p-6" data-testid="ai-settings">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
        data-testid="button-ai-settings-toggle"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#e6eee3] text-[#4b684d]">
            <PlugZap size={19} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">Free AI key</span>
            <span className="block truncate text-[11px] font-normal text-muted-foreground">
              {configured ? `Connected (${meta.label} · ${maskKey(settings.apiKey)})` : "Bring your own free key — stored only in this browser. Tap to open."}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {configured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e6eee3] px-2.5 py-1 text-[10px] font-bold text-[#4b684d]">
              <Check size={12} /> Ready
            </span>
          )}
          <ChevronDown size={17} className={`text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (<>
      {configured && (
        <div className="mt-4">
          <AiCreditQuotaCard />
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1.5" role="tablist" aria-label="AI provider">
        {PROVIDERS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={settings.provider === p}
            onClick={() => setProvider(p)}
            className={`rounded-xl px-2 py-2.5 text-[11px] font-bold transition sm:text-xs ${
              settings.provider === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`ai-provider-${p}`}
          >
            {p === "openrouter" ? "OpenRouter" : p === "gemini" ? "Gemini" : "Custom"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {!configured && (
          <ol className="space-y-1.5 rounded-2xl bg-muted/60 p-4 text-[12px] leading-relaxed" data-testid="ai-simple-steps">
            <li><strong>1.</strong> Get a free key — <strong>Google AI Studio</strong> (starts with <span className="mono">AIza…</span>) or <strong>OpenRouter</strong> (starts with <span className="mono">sk-or-…</span>). Links are below.</li>
            <li><strong>2.</strong> Just <strong>paste it</strong> in the box. The app detects which company it belongs to and tells you if you're on the wrong tab.</li>
            <li><strong>3.</strong> Press <strong>Load live model list</strong> and pick a model — never type a model name from memory, they expire.</li>
            <li><strong>4.</strong> Press <strong>Test connection</strong>. Green means the agent is ready.</li>
          </ol>
        )}
        <Field label={meta.keyLabel}>
          <div className="relative">
            <KeyRound size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showKey ? "text" : "password"}
              value={settings.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder={settings.provider === "gemini" ? "AIza…" : "sk-or-…"}
              className="field mono text-[13px]"
              style={{ paddingLeft: "38px", paddingRight: "76px" }}
              autoComplete="off"
              spellCheck={false}
              data-testid="input-ai-key"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
              data-testid="button-ai-toggle-key"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          {keyTabMismatch && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fdf3e3] px-4 py-2.5 text-[12px] font-semibold text-[#8a6a2f]" role="alert" data-testid="status-key-tab-hint">
              <span>This looks like a {detectedLabel} key, but you're on the {settings.provider === "gemini" ? "Gemini" : settings.provider === "openrouter" ? "OpenRouter" : "Custom"} tab — keys only work on their own tab.</span>
              <button
                type="button"
                onClick={() => detectedProvider && setProvider(detectedProvider)}
                className="rounded-full bg-[#8a6a2f] px-3.5 py-1.5 text-[11px] font-bold text-white"
                data-testid="button-switch-provider"
              >
                Switch to {detectedLabel}
              </button>
            </div>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Model">
            {customModel || settings.provider === "custom" || !models ? (
              <input
                value={settings.model}
                onChange={(e) => update({ model: e.target.value })}
                placeholder={defaultModelFor(settings.provider)}
                className="field mono text-[13px]"
                spellCheck={false}
                data-testid="input-ai-model"
              />
            ) : (
              <select
                value={models.some((m) => m.id === settings.model) ? settings.model : "__custom__"}
                onChange={(e) => {
                  if (e.target.value === "__custom__") setCustomModel(true);
                  else update({ model: e.target.value });
                }}
                className="field mono text-[13px]"
                data-testid="select-ai-model"
              >
                {!models.some((m) => m.id === settings.model) && (
                  <option value="__custom__">{settings.model} (not in live list)</option>
                )}
                {models.map((m) => (
                  <option key={m.id} value={m.id} title={m.name}>
                    {m.id}
                  </option>
                ))}
              </select>
            )}
            {settings.provider !== "custom" && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={refreshModels}
                  disabled={loadingModels}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
                  data-testid="button-refresh-models"
                >
                  {loadingModels ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {loadingModels ? "Loading…" : models ? "Refresh live list" : "Load live model list"}
                </button>
                {models && !customModel && (
                  <button
                    type="button"
                    onClick={() => setCustomModel(true)}
                    className="rounded-full px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Type manually
                  </button>
                )}
                {customModel && models && (
                  <button
                    type="button"
                    onClick={() => setCustomModel(false)}
                    className="rounded-full px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Back to list
                  </button>
                )}
              </div>
            )}
            {modelMsg && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground" data-testid="status-ai-models">
                {modelMsg}
              </p>
            )}
            {!modelOk && (
              <div className="mt-1.5 rounded-xl bg-[#fdf3e3] px-4 py-2.5 text-[12px] font-semibold text-[#8a6a2f]" role="alert" data-testid="status-model-mismatch">
                <p>
                  “<span className="mono">{settings.model.trim()}</span>” doesn't match a{" "}
                  {settings.provider === "gemini" ? "Gemini key (needs a gemini-* name)" : "OpenRouter key (needs an OpenRouter name like openrouter/free)"}.
                  Keys only work with their own company's models.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCustomModel(false);
                    update({ model: defaultModelFor(settings.provider) });
                  }}
                  className="mt-1.5 rounded-full bg-[#8a6a2f] px-3.5 py-1.5 text-[11px] font-bold text-white"
                  data-testid="button-fix-model"
                >
                  Use the recommended model
                </button>
              </div>
            )}
          </Field>
          {settings.provider === "custom" && (
            <Field label="Base URL">
              <input
                value={settings.baseUrl || ""}
                onChange={(e) => update({ baseUrl: e.target.value })}
                placeholder="https://your-endpoint/v1"
                className="field mono text-[13px]"
                spellCheck={false}
                data-testid="input-ai-baseurl"
              />
            </Field>
          )}
        </div>

        {testMsg && (
          <div
            role="status"
            className={`rounded-xl px-4 py-2.5 text-[12px] font-semibold ${testOk ? "bg-[#e6eee3] text-[#466548]" : "bg-[#f5e5df] text-[#914e40]"}`}
            data-testid="status-ai-test"
          >
            {testMsg}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onTest}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
            data-testid="button-ai-test"
          >
            {testing && <LoaderCircle size={14} className="animate-spin" />}
            {testing ? "Testing…" : "Test connection"}
          </button>
          {settings.apiKey.trim() && (
            <p className="text-[11px] font-semibold text-[#4b684d]" data-testid="status-ai-autosave">
              ✓ Key saved automatically on this device — no save button needed. It stays after reload; remove it anytime.
            </p>
          )}
          {settings.apiKey && (
            <button
              onClick={() => {
                clear();
                setTestMsg("");
                setTestOk(null);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
              data-testid="button-ai-remove"
            >
              <Trash2 size={14} /> Remove key
            </button>
          )}
        </div>

        {!compact && (
          <details className="rounded-2xl bg-muted/60 p-4 text-[12px] leading-relaxed text-muted-foreground">
            <summary className="cursor-pointer font-bold text-foreground">How to get a free key</summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>
                <strong>OpenRouter:</strong> sign up at openrouter.ai, open{" "}
                <span className="mono">openrouter.ai/keys</span>, create a key. The default{" "}
                <span className="mono">openrouter/free</span> auto-picks a live free model — or load
                the live list above and pin a <span className="mono">:free</span> slug. Old guides
                naming <span className="mono">llama-3.3-70b-instruct:free</span> no longer work; it
                rotated off the free tier.
              </li>
              <li>
                <strong>Gemini:</strong> visit Google AI Studio{" "}
                <span className="mono">aistudio.google.com/apikey</span>, create an API key, then load
                the live list above. Google shut down <span className="mono">gemini-2.0-flash</span>{" "}
                (June 2026) — current free models are <span className="mono">gemini-3.5-flash</span>{" "}
                and <span className="mono">gemini-3.1-flash-lite</span>.
              </li>
              <li>
                <strong>Custom:</strong> paste any OpenAI-compatible base URL + key + model name.
              </li>
            </ol>
            <p className="mt-2 text-[11px]">
              Your key never leaves this browser except directly to the provider you chose. Remove it anytime
              with “Remove key”. {meta.keyUrl && (
                <a className="font-bold text-primary underline-offset-2 hover:underline" href={meta.keyUrl} target="_blank" rel="noreferrer">
                  Get a key →
                </a>
              )}
            </p>
          </details>
        )}
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {meta.help} Free tiers can be rate-limited — if the agent stalls, wait a minute and retry.
        </p>
      </div>
      </>)}
    </div>
  );
}
