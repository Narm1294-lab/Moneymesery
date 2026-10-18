import { useCallback, useEffect, useRef, useState } from "react";
import type { AiSettings } from "@/lib/ai-providers";

export interface AiCreditInfo {
  /** Whether this key is a free-tier key */
  isFree?: boolean;
  /** Max requests per minute */
  reqLimitMinute?: number;
  /** Max requests per day */
  reqLimitDay?: number;
  /** Seconds until the minute rate-limit window resets */
  secsUntilMinuteReset?: number;
  /** Seconds until the daily limit resets (midnight UTC) */
  secsUntilDayReset?: number;
  /** Human label for the provider */
  providerLabel?: string;
  /** Raw error if fetch failed */
  error?: string;
  loading: boolean;
}

/** Seconds until next UTC midnight */
function secsUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  );
  return Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 1000));
}

/** Format seconds as "Xh Ym" or "Xm Ys" or "Xs" */
export function formatCountdown(secs: number): string {
  if (secs <= 0) return "now";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function fetchOpenRouterInfo(apiKey: string): Promise<Partial<AiCreditInfo>> {
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("API key rejected.");
    throw new Error(`OpenRouter returned ${res.status}.`);
  }
  const json = (await res.json()) as {
    data?: {
      is_free_tier?: boolean;
      rate_limit?: { requests?: number; interval?: string };
    };
  };
  const d = json.data ?? {};
  const isFree = !!d.is_free_tier;
  // OpenRouter free: 20 req/min, 50 req/day (documented limits)
  const reqLimitMinute = d.rate_limit?.interval === "minute" ? (d.rate_limit.requests ?? 20) : 20;
  const reqLimitDay = isFree ? 50 : 1000;
  return {
    isFree,
    reqLimitMinute,
    reqLimitDay,
    secsUntilMinuteReset: 60,
    secsUntilDayReset: secsUntilMidnightUtc(),
    providerLabel: "OpenRouter",
  };
}

export function useAiCredits(settings: AiSettings | null): AiCreditInfo {
  const [info, setInfo] = useState<AiCreditInfo>({ loading: false });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const doFetch = useCallback(async (s: AiSettings) => {
    if (!s.apiKey.trim()) { setInfo({ loading: false }); return; }
    setInfo((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      let data: Partial<AiCreditInfo>;
      if (s.provider === "openrouter") {
        data = await fetchOpenRouterInfo(s.apiKey.trim());
      } else if (s.provider === "gemini") {
        data = {
          providerLabel: "Google Gemini",
          isFree: true,
          reqLimitMinute: 15,
          reqLimitDay: 1500,
          secsUntilDayReset: secsUntilMidnightUtc(),
          secsUntilMinuteReset: 60,
        };
      } else {
        data = { providerLabel: "Custom endpoint", isFree: false };
      }
      setInfo({ ...data, loading: false });

      // Live countdown ticker
      if (countdownRef.current) clearInterval(countdownRef.current);
      let dayLeft = data.secsUntilDayReset ?? secsUntilMidnightUtc();
      let minLeft = data.secsUntilMinuteReset ?? 60;
      countdownRef.current = setInterval(() => {
        dayLeft = Math.max(0, dayLeft - 1);
        minLeft = minLeft <= 1 ? 60 : minLeft - 1; // reset minute window
        setInfo((prev) => ({
          ...prev,
          secsUntilDayReset: dayLeft,
          secsUntilMinuteReset: minLeft,
        }));
      }, 1000);
    } catch (e) {
      setInfo({ loading: false, error: e instanceof Error ? e.message : "Could not load usage info." });
    }
  }, []);

  useEffect(() => {
    if (!settings?.apiKey.trim()) { setInfo({ loading: false }); return; }
    void doFetch(settings);
    timerRef.current = setInterval(() => void doFetch(settings), 5 * 60 * 1000);
    return () => clearTimers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.provider, settings?.apiKey]);

  return info;
}
