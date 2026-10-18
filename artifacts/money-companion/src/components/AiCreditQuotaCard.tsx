import { Clock, Info, RefreshCw, Sparkles, Zap } from "lucide-react";
import { useAiCredits, formatCountdown } from "@/hooks/useAiCredits";
import { useAiSettings } from "@/hooks/useAiSettings";

export function AiCreditQuotaCard() {
  const { settings, configured } = useAiSettings();
  const credits = useAiCredits(configured ? settings : null);

  if (!configured) {
    return (
      <div className="rounded-[22px] border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <Sparkles size={16} className="text-[#dbab77]" />
          <span>No AI Key Configured</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed">
          Connect your free Google Gemini or OpenRouter key below to see your live credit balance, daily request limits, and refresh countdowns.
        </p>
      </div>
    );
  }

  const isGemini = settings.provider === "gemini";
  const isOpenRouter = settings.provider === "openrouter";

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#d9c8a9]/60 bg-gradient-to-br from-[#faf6ee] to-[#f4eddd] p-5 shadow-xs sm:p-6" data-testid="ai-credit-quota-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5dac5] pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#203d35] text-[#f7f1e6] shadow-xs">
            <Zap size={18} className="text-[#dbab77]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="serif text-[18px] font-medium tracking-tight text-[#203d35]">
                AI Credit &amp; Rate-Limit Quota
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-[#e3ebdd] px-2.5 py-0.5 text-[10px] font-bold text-[#466548]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#466548]" />
                {credits.isFree !== false ? "Free Tier" : "Pro / Pay-As-You-Go"}
              </span>
            </div>
            <p className="text-[11px] text-[#7d694b]">
              Connected provider: <strong className="text-[#203d35]">{credits.providerLabel || settings.provider}</strong>
              {" · "}Model: <strong className="mono text-[10.5px] text-[#203d35]">{settings.model}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => credits.refetch?.()}
          disabled={credits.loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#d4c5a9] bg-white/70 px-3.5 py-1.5 text-[11px] font-semibold text-[#5a4832] transition hover:bg-white active:scale-95 disabled:opacity-50"
          title="Refresh credit status from provider"
          data-testid="button-refresh-credits"
        >
          <RefreshCw size={12} className={credits.loading ? "animate-spin" : ""} />
          {credits.loading ? "Checking…" : "Refresh quota"}
        </button>
      </div>

      {credits.error ? (
        <div className="mt-4 rounded-xl bg-[#f8e7e1] p-3.5 text-xs text-[#9c4533]">
          <p className="font-bold">Quota status notice:</p>
          <p className="mt-0.5">{credits.error}</p>
          <p className="mt-1 text-[11px] text-[#7d3b2c]">
            Requests may still work normally if your key is valid. Free tier models auto-throttle if sent too quickly.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Balance / Tier */}
          <div className="rounded-[18px] border border-white/60 bg-white/80 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a765a]">Credit Balance</p>
            <p className="serif mt-1 text-[22px] font-medium text-[#203d35]">
              {isOpenRouter ? (
                credits.creditBalance !== undefined ? (
                  `$${credits.creditBalance.toFixed(4)}`
                ) : credits.isFree ? (
                  "$0.00 (Free)"
                ) : (
                  "Active"
                )
              ) : isGemini ? (
                "100% Free"
              ) : (
                "Self-Hosted"
              )}
            </p>
            <p className="mt-0.5 text-[10.5px] text-[#7a6b57]">
              {isOpenRouter && typeof credits.usage === "number"
                ? `Total used: $${credits.usage.toFixed(4)}`
                : isGemini
                ? "No billing required"
                : "Standard account"}
            </p>
          </div>

          {/* Card 2: Daily Limit */}
          <div className="rounded-[18px] border border-white/60 bg-white/80 p-3.5 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a765a]">Daily Request Limit</p>
            <p className="serif mt-1 text-[22px] font-medium text-[#203d35]">
              {credits.reqLimitDay ? `${credits.reqLimitDay.toLocaleString()} req/day` : "Unlimited"}
            </p>
            <p className="mt-0.5 text-[10.5px] text-[#7a6b57]">
              {isGemini ? "Generous 1,500 free calls/day" : "Resets daily at 00:00 UTC"}
            </p>
          </div>

          {/* Card 3: Minute Rate Limit & Refresh Timer */}
          <div className="rounded-[18px] border border-white/60 bg-white/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a765a]">Minute Refresh</p>
              <Clock size={12} className="text-[#9a7455]" />
            </div>
            <p className="serif mt-1 text-[22px] font-medium text-[#203d35]">
              {credits.secsUntilMinuteReset !== undefined ? (
                <span className={credits.secsUntilMinuteReset <= 10 ? "text-amber-600 font-bold" : "text-[#203d35]"}>
                  {formatCountdown(credits.secsUntilMinuteReset)}
                </span>
              ) : (
                "Rolling window"
              )}
            </p>
            <p className="mt-0.5 text-[10.5px] text-[#7a6b57]">
              Limit: <strong>{credits.reqLimitMinute ?? 15} req/min</strong>
            </p>
          </div>

          {/* Card 4: Daily Reset Countdown */}
          <div className="rounded-[18px] border border-white/60 bg-white/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a765a]">Daily Reset Countdown</p>
              <span className="text-[11px]">⏳</span>
            </div>
            <p className="serif mt-1 text-[22px] font-medium text-[#203d35]">
              {credits.secsUntilDayReset !== undefined ? (
                <span className="text-[#203d35] font-semibold">
                  {formatCountdown(credits.secsUntilDayReset)}
                </span>
              ) : (
                "Midnight UTC"
              )}
            </p>
            <p className="mt-0.5 text-[10.5px] text-[#7a6b57]">
              Full daily quota restores automatically
            </p>
          </div>
        </div>
      )}

      {/* Practical Guide info */}
      <div className="mt-4 flex flex-col gap-2 rounded-[16px] bg-[#ebdcc4]/50 px-4 py-3 text-[11px] leading-relaxed text-[#5e4d35] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Info size={14} className="shrink-0 text-[#9a7455]" />
          <span>
            <strong>How credit refresh works:</strong> If you ever see a rate-limit error, wait for the{" "}
            <strong>Minute Refresh</strong> timer to hit zero. Daily quotas reset every midnight UTC.
          </span>
        </div>
        <span className="shrink-0 text-[10.5px] font-semibold text-[#825b39]">
          ✓ Safe browser-only storage
        </span>
      </div>
    </div>
  );
}
