// Browser-only BYOK provider layer.
// Keys live in localStorage (see useAiSettings) and are sent directly from
// the browser to the chosen provider. Nothing is proxied through our servers.

export type AiProviderId = "openrouter" | "gemini" | "custom";

export interface AiSettings {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCallOptions {
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

export const AI_STORAGE_KEY = "mc.ai-settings.v1";

export const PROVIDER_META: Record<
  AiProviderId,
  { label: string; keyUrl: string; keyLabel: string; help: string }
> = {
  openrouter: {
    label: "OpenRouter (free models)",
    keyUrl: "https://openrouter.ai/keys",
    keyLabel: "OpenRouter API key",
    help: "Create a free key at openrouter.ai/keys. The default model openrouter/free auto-picks a currently-free model — or refresh the list below and pin a :free slug. Free tiers are rate-limited (20 req/min, 50/day).",
  },
  gemini: {
    label: "Google Gemini (free API)",
    keyUrl: "https://aistudio.google.com/apikey",
    keyLabel: "Gemini API key",
    help: "Get a free key from Google AI Studio (aistudio.google.com/apikey). Google retires old models (2.0-flash is shut down) — refresh the list below to pick a live model.",
  },
  custom: {
    label: "Custom OpenAI-compatible",
    keyUrl: "",
    keyLabel: "API key",
    help: "Any OpenAI-compatible /chat/completions endpoint (e.g. a local proxy or another provider). Enter its base URL below.",
  },
};

export function defaultModelFor(provider: AiProviderId): string {
  const env = import.meta.env as Record<string, string | undefined>;
  // NOTE: free-model slugs rotate. openrouter/free is OpenRouter's router that
  // auto-selects a currently-free model, so it never goes stale. For Gemini,
  // Google shut down gemini-2.0-flash (June 2026) and is retiring 2.5-flash
  // (Oct 2026) — 3.5-flash is the current free-tier replacement.
  if (provider === "openrouter")
    return env.VITE_AI_OPENROUTER_MODEL || "openrouter/free";
  if (provider === "gemini")
    return env.VITE_AI_GEMINI_MODEL || "gemini-3.5-flash";
  return env.VITE_AI_CUSTOM_MODEL || "gpt-3.5-turbo";
}

/** Model slugs we know are dead — auto-migrated to current defaults on load. */
export const RETIRED_MODELS: Record<string, AiProviderId> = {
  "meta-llama/llama-3.3-70b-instruct:free": "openrouter",
  "gemini-2.0-flash": "gemini",
  "gemini-2.0-flash-001": "gemini",
  "gemini-2.0-flash-lite": "gemini",
  "gemini-2.0-flash-lite-001": "gemini",
  "gemini-2.5-flash": "gemini",
  "gemini-2.5-flash-lite": "gemini",
};

export interface AiModelOption {
  id: string;
  name: string;
  context?: number;
}

/** Live free-model list from OpenRouter. Public endpoint — no key needed. */
export async function listOpenRouterModels(signal?: AbortSignal): Promise<AiModelOption[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", { signal });
  if (!res.ok) throw new Error(`Could not load the model list (${res.status}).`);
  const json = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
    }>;
  };
  const rows = json.data || [];
  const free = rows.filter((m) => {
    if (!m.id) return false;
    const p = Number(m.pricing?.prompt ?? NaN);
    const c = Number(m.pricing?.completion ?? NaN);
    return m.id.endsWith(":free") || (m.id === "openrouter/free") || (p === 0 && c === 0);
  });
  const options = free.map((m) => ({
    id: m.id as string,
    name: m.name || (m.id as string),
    context: m.context_length,
  }));
  // Router first, then the rest alphabetically.
  options.sort((a, b) => {
    if (a.id === "openrouter/free") return -1;
    if (b.id === "openrouter/free") return 1;
    return a.id.localeCompare(b.id);
  });
  if (options.length === 0) throw new Error("No free models listed right now. Try again later.");
  return options;
}

/** Live model list for a Gemini key. Filters to text-generation models. */
export async function listGeminiModels(apiKey: string, signal?: AbortSignal): Promise<AiModelOption[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { signal },
  );
  if (!res.ok) {
    if (res.status === 400 || res.status === 403)
      throw new Error("Key rejected while listing models. Check the key.");
    throw new Error(`Could not load the model list (${res.status}).`);
  }
  const json = (await res.json()) as {
    models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }>;
  };
  const options = (json.models || [])
    .filter((m) => m.name && (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => ({
      id: (m.name as string).replace(/^models\//, ""),
      name: m.displayName || (m.name as string).replace(/^models\//, ""),
    }));
  if (options.length === 0) throw new Error("No text models available for this key.");
  return options;
}

export function defaultBaseUrlFor(provider: AiProviderId): string {
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  const env = import.meta.env as Record<string, string | undefined>;
  if (provider === "custom") return env.VITE_AI_CUSTOM_BASE_URL || "";
  return "";
}

export function isAiConfigured(s: AiSettings | null): s is AiSettings {
  if (!s || !s.apiKey.trim() || !s.model.trim()) return false;
  if (s.provider === "custom" && !(s.baseUrl || "").trim()) return false;
  return true;
}

/**
 * Guess which provider a pasted key belongs to, so non-technical users land
 * on the right tab without knowing key formats.
 *  - Google AI Studio keys start with "AIza"
 *  - OpenRouter keys start with "sk-or-"
 */
export function detectProviderFromKey(key: string): AiProviderId | null {
  const k = key.trim();
  if (k.startsWith("AIza")) return "gemini";
  if (k.startsWith("sk-or-")) return "openrouter";
  return null;
}

/**
 * True when the model name clearly belongs to a different provider than the
 * selected tab — the most common "simple user" mistake. Custom endpoints
 * accept anything, so they are never flagged.
 */
export function modelMatchesProvider(model: string, provider: AiProviderId): boolean {
  const m = model.trim();
  if (!m || provider === "custom") return true;
  if (provider === "gemini") return !m.includes("/");
  // openrouter tab: Gemini-style names (gemini-*, models/...) won't work here.
  return !m.startsWith("gemini-") && !m.startsWith("models/");
}

function friendlyError(status: number, bodyText: string): Error {
  // Provider error bodies are often JSON like {"error":{"message":"..."}} —
  // prefer the inner message over raw JSON.
  let detail = bodyText.slice(0, 180);
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } | string; message?: string };
    const inner =
      typeof parsed.error === "string"
        ? parsed.error
        : parsed.error?.message || parsed.message;
    if (inner) detail = String(inner).slice(0, 220);
  } catch {
    // keep raw snippet
  }
  if (status === 401 || status === 403)
    return new Error(`That key was rejected (401/403). Check the key and try again. ${detail}`);
  if (status === 404)
    return new Error(
      `That model is unavailable or retired (404) — free-model slugs change often. Open AI & Agent, refresh the model list, and pick a current model. ${detail}`,
    );
  if (status === 429)
    return new Error("Rate limit reached on the free tier. Wait a minute and retry.");
  if (status >= 500)
    return new Error("The AI provider had a server error. Please retry.");
  return new Error(`AI request failed (${status}). ${detail}`);
}

async function openAiCompatibleComplete(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  opts: AiCallOptions,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 800,
      stream: false,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw friendlyError(res.status, text);
  const json = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("The AI returned an empty reply. Try again or pick another model from the live list.");
  return content;
}

async function openAiCompatibleStream(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  onToken: (t: string) => void,
  opts: AiCallOptions,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 900,
      stream: true,
    }),
  });
  if (!res.ok) throw friendlyError(res.status, await res.text());
  if (!res.body) {
    const full = await openAiCompatibleComplete(baseUrl, apiKey, model, messages, opts, extraHeaders);
    onToken(full);
    return full;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = json.choices?.[0]?.delta?.content || "";
          if (delta) {
            full += delta;
            onToken(delta);
          }
        } catch {
          // ignore keep-alive / partial frames
        }
      }
    }
  }
  if (!full) {
    // Some proxies don't stream; fall back to a normal call.
    const fallback = await openAiCompatibleComplete(baseUrl, apiKey, model, messages, opts, extraHeaders);
    onToken(fallback);
    return fallback;
  }
  return full;
}

interface GeminiContent {
  role?: string;
  parts: Array<{ text: string }>;
}

function toGeminiBody(messages: AiChatMessage[], maxTokens: number, temperature: number) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents: GeminiContent[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Hello" }] });
  return {
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  };
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

function extractGeminiText(json: GeminiResponse): string {
  // Skip thought parts; join real text parts across all candidates.
  const texts: string[] = [];
  for (const c of json.candidates || []) {
    for (const p of c.content?.parts || []) {
      if (!p.thought && p.text) texts.push(p.text);
    }
  }
  // Fallback: if only thought parts exist, use them rather than nothing.
  if (texts.length === 0) {
    for (const c of json.candidates || []) {
      for (const p of c.content?.parts || []) {
        if (p.text) texts.push(p.text);
      }
    }
  }
  return texts.join("").trim();
}

/** A 200 with no text means blocked / stopped — surface the real reason. */
function geminiEmptyError(json: GeminiResponse, raw: string): Error {
  const block = json.promptFeedback?.blockReason;
  if (block)
    return new Error(
      `Gemini blocked this request (${block}). Try simpler wording, or pick another model from the live list.`,
    );
  const finish = json.candidates?.[0]?.finishReason;
  if (!json.candidates || json.candidates.length === 0)
    return new Error(
      `Gemini returned no answer (no candidates). This model may not be fully served on your key yet — pick another from the live list, e.g. gemini-3.1-flash-lite. Raw: ${raw.slice(0, 160)}`,
    );
  if (finish && finish !== "STOP")
    return new Error(
      `Gemini stopped without text (${finish}). Try again or pick another model from the live list.`,
    );
  return new Error(
    `The AI returned an empty reply. Try again or pick another model. Raw: ${raw.slice(0, 160)}`,
  );
}
async function geminiComplete(
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  opts: AiCallOptions,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      signal: opts.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toGeminiBody(messages, opts.maxTokens ?? 800, opts.temperature ?? 0.2)),
    },
  );
  const text = await res.text();
  if (!res.ok) throw friendlyError(res.status, text);
  const json = JSON.parse(text) as GeminiResponse;
  const out = extractGeminiText(json);
  if (!out) throw geminiEmptyError(json, text);
  return out;
}

async function geminiStream(
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  onToken: (t: string) => void,
  opts: AiCallOptions,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      signal: opts.signal,
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(toGeminiBody(messages, opts.maxTokens ?? 900, opts.temperature ?? 0.4)),
    },
  );
  if (!res.ok) throw friendlyError(res.status, await res.text());
  if (!res.body) {
    const full = await geminiComplete(apiKey, model, messages, opts);
    onToken(full);
    return full;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() || "";
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        try {
          const json = JSON.parse(trimmed.slice(5).trim()) as GeminiResponse;
          const delta = extractGeminiText(json);
          if (delta) {
            full += delta;
            onToken(delta);
          } else {
            // Remember block/stop signals so an empty stream still explains itself.
            const block = json.promptFeedback?.blockReason;
            if (block) throw geminiEmptyError(json, trimmed);
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Gemini blocked")) throw e;
          // ignore keep-alive / partial frames
        }
      }
    }
  }
  if (!full) {
    const fallback = await geminiComplete(apiKey, model, messages, opts);
    onToken(fallback);
    return fallback;
  }
  return full;
}

export async function chatComplete(
  settings: AiSettings,
  messages: AiChatMessage[],
  opts: AiCallOptions = {},
): Promise<string> {
  if (!isAiConfigured(settings)) throw new Error("Connect a free AI key first.");
  if (settings.provider === "gemini") {
    return geminiComplete(settings.apiKey.trim(), settings.model.trim(), messages, opts);
  }
  const base =
    settings.provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : (settings.baseUrl || "").trim();
  if (!base) throw new Error("Enter the custom endpoint base URL first.");
  const extra: Record<string, string> =
    settings.provider === "openrouter"
      ? {
          "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://money-companion.app",
          "X-Title": "Money Companion",
        }
      : {};
  return openAiCompatibleComplete(base, settings.apiKey.trim(), settings.model.trim(), messages, opts, extra);
}

export async function streamChat(
  settings: AiSettings,
  messages: AiChatMessage[],
  onToken: (t: string) => void,
  opts: AiCallOptions = {},
): Promise<string> {
  if (!isAiConfigured(settings)) throw new Error("Connect a free AI key first.");
  if (settings.provider === "gemini") {
    return geminiStream(settings.apiKey.trim(), settings.model.trim(), messages, onToken, opts);
  }
  const base =
    settings.provider === "openrouter"
      ? "https://openrouter.ai/api/v1"
      : (settings.baseUrl || "").trim();
  if (!base) throw new Error("Enter the custom endpoint base URL first.");
  const extra: Record<string, string> =
    settings.provider === "openrouter"
      ? {
          "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://money-companion.app",
          "X-Title": "Money Companion",
        }
      : {};
  try {
    return await openAiCompatibleStream(base, settings.apiKey.trim(), settings.model.trim(), messages, onToken, opts, extra);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    // Streaming not supported by endpoint? Fall back to one-shot + fake tokens.
    const full = await openAiCompatibleComplete(base, settings.apiKey.trim(), settings.model.trim(), messages, opts, extra);
    onToken(full);
    return full;
  }
}

export async function testConnection(settings: AiSettings): Promise<string> {
  // Gemini: keep the probe to a single plain user message — some newly
  // released models answer these most reliably.
  const messages: AiChatMessage[] =
    settings.provider === "gemini"
      ? [{ role: "user", content: "Reply with exactly this word: ok" }]
      : [
          { role: "system", content: "Reply with exactly: ok" },
          { role: "user", content: "ping" },
        ];
  // Note: newer Gemini models "think" before answering and thoughts consume
  // the output budget — keep it generous or the reply arrives empty
  // (finishReason MAX_TOKENS with no text).
  const reply = await chatComplete(settings, messages, { maxTokens: 500, temperature: 0 });
  return reply;
}
