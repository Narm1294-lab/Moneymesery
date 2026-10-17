import { useCallback, useEffect, useState } from "react";
import {
  AI_STORAGE_KEY,
  RETIRED_MODELS,
  defaultBaseUrlFor,
  defaultModelFor,
  type AiProviderId,
  type AiSettings,
} from "@/lib/ai-providers";

const defaultSettings: AiSettings = {
  provider: "openrouter",
  apiKey: "",
  model: defaultModelFor("openrouter"),
  baseUrl: "",
};

function load(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    const provider: AiProviderId =
      parsed.provider === "gemini" || parsed.provider === "custom" || parsed.provider === "openrouter"
        ? parsed.provider
        : "openrouter";
    let model =
      typeof parsed.model === "string" && parsed.model.trim()
        ? parsed.model.trim()
        : defaultModelFor(provider);
    // Auto-migrate slugs the providers have retired (e.g. llama-3.3 :free,
    // gemini-2.0-flash) so saved settings keep working.
    if (RETIRED_MODELS[model] && RETIRED_MODELS[model] === provider) {
      model = defaultModelFor(provider);
    }
    return {
      provider,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model,
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
    };
  } catch {
    return defaultSettings;
  }
}

export function maskKey(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return t ? "••••" : "";
  return `••••${t.slice(-4)}`;
}

export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AI_STORAGE_KEY) setSettings(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((patch: Partial<AiSettings>) => {
    setSettings((prev) => {
      let next = { ...prev, ...patch };
      // When switching provider, refresh the model default unless user typed one.
      if (patch.provider && patch.provider !== prev.provider && !patch.model) {
        next = {
          ...next,
          model: defaultModelFor(patch.provider),
          baseUrl: patch.provider === "custom" ? prev.baseUrl : defaultBaseUrlFor(patch.provider),
        };
      }
      try {
        localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage full / private mode — keep in-memory state only
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSettings((prev) => {
      const next: AiSettings = {
        provider: prev.provider,
        apiKey: "",
        model: defaultModelFor(prev.provider),
        baseUrl: prev.provider === "custom" ? prev.baseUrl : "",
      };
      try {
        localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const configured =
    hydrated &&
    settings.apiKey.trim().length > 0 &&
    settings.model.trim().length > 0 &&
    (settings.provider !== "custom" || (settings.baseUrl || "").trim().length > 0);

  return { settings, update, clear, configured, hydrated };
}
