import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, HandCoins, Hourglass, XCircle } from "lucide-react";

import {
  DEFAULT_SCENARIOS,
  analyzeFeasibility,
  type FeasibilityVerdict,
  type FinancialBase,
  type IdeaNumbers,
  type LoanScenarioInput,
} from "@/lib/feasibility";

const money0 = (n: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(n);

const VERDICT_STYLE: Record<FeasibilityVerdict, { label: string; cls: string; icon: React.ReactNode }> = {
  ready: { label: "Ready", cls: "bg-[#e6eee3] text-[#466548]", icon: <CheckCircle2 size={14} /> },
  wait: { label: "Wait & save", cls: "bg-[#fdf3e3] text-[#8a6a2f]", icon: <Hourglass size={14} /> },
  loan: { label: "Needs a loan", cls: "bg-[#e3ecf7] text-[#2f5a8a]", icon: <HandCoins size={14} /> },
  not_advisable: { label: "Not advisable", cls: "bg-[#f5e5df] text-[#914e40]", icon: <XCircle size={14} /> },
};

function Bar({ pct, tone }: { pct: number; tone: "ok" | "warn" | "bad" }) {
  const cls = tone === "ok" ? "bg-[#638566]" : tone === "warn" ? "bg-[#c99a3f]" : "bg-[#b76654]";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

/**
 * Full feasibility verdict for one idea against the user's real numbers.
 * Pure math (lib/feasibility) — no AI needed at render time.
 */
export function IdeaReport({
  title,
  idea,
  base,
  scenarios: scenarioProp,
}: {
  title: string;
  idea: IdeaNumbers;
  base: FinancialBase;
  scenarios?: LoanScenarioInput[];
}) {
  const [custom, setCustom] = useState<LoanScenarioInput[] | null>(null);
  const scenarios = custom ?? scenarioProp ?? DEFAULT_SCENARIOS;
  const report = useMemo(() => analyzeFeasibility(base, idea, scenarios), [base, idea, scenarios]);
  const v = VERDICT_STYLE[report.verdict];

  const setScenario = (i: number, patch: Partial<LoanScenarioInput>) =>
    setCustom((prev) => {
      const list = [...(prev ?? scenarioProp ?? DEFAULT_SCENARIOS)];
      list[i] = { ...list[i], ...patch };
      return list;
    });

  // Ceiling meters (0-100, higher = more headroom).
  const cashHeadroom = report.reserveFloor > 0 || base.cashOnHand > 0
    ? Math.max(0, Math.min(1, report.cashAfterReserve / Math.max(1, idea.one_time_cost || report.reserveFloor)))
    : 1;
  const incomeHeadroom = base.avgMonthlyIncome > 0
    ? Math.max(0, Math.min(1, (report.monthlySurplus - report.monthlyObligations - idea.monthly_cost) / Math.max(1, base.avgMonthlyIncome * 0.3)))
    : 0;

  return (
    <div className="rounded-[20px] border border-border bg-card p-5 soft-shadow sm:p-6" data-testid="idea-report">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="serif text-xl leading-tight">{title}</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${v.cls}`} data-testid="idea-verdict">
          {v.icon} {v.label}
          {report.verdict === "wait" && report.waitMonths !== null ? ` · ~${report.waitMonths} mo` : ""}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground" data-testid="idea-reason">
        {report.verdictReason}
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-bold">
            <span>Cash ceiling {report.bindingConstraint === "cash" && <span className="text-[#8a6a2f]">· binding</span>}</span>
            <span className="font-normal text-muted-foreground">{money0(Math.max(0, report.cashAfterReserve))} usable</span>
          </div>
          <Bar pct={cashHeadroom * 100} tone={report.bindingConstraint === "cash" ? "bad" : "ok"} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-bold">
            <span>Income ceiling {report.bindingConstraint === "income" && <span className="text-[#8a6a2f]">· binding</span>}</span>
            <span className="font-normal text-muted-foreground">surplus {money0(report.monthlySurplus)}/mo</span>
          </div>
          <Bar pct={incomeHeadroom * 100} tone={report.bindingConstraint === "income" ? "bad" : report.monthlySurplus > 0 ? "ok" : "warn"} />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          {report.weakMonthOk ? <CheckCircle2 size={14} className="text-[#638566]" /> : <AlertTriangle size={14} className="text-[#b76654]" />}
          Weak-month test (income −20%): {report.weakMonthOk ? "survives" : "goes negative"}
          {report.bindingConstraint === "weak_month" && <span className="text-[#8a6a2f]">· binding</span>}
        </div>
      </div>

      {report.scenarios.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Clock3 size={13} /> Loan scenarios for the shortfall of {money0(report.shortfall)}
          </p>
          <div className="mt-2 space-y-2">
            {report.scenarios.map((s, i) => (
              <div key={s.label} className={`rounded-2xl border p-3.5 ${s.ok ? "border-[#cfe0cf] bg-[#f4f8f3]" : "border-border bg-muted/40"}`} data-testid={`idea-scenario-${i}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-bold">{s.label}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${s.ok ? "bg-[#e6eee3] text-[#466548]" : "bg-[#f5e5df] text-[#914e40]"}`}>
                    {s.ok ? "Fits" : "Fails"}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <label className="flex items-center gap-1">
                    Rate
                    <input
                      type="number" min="0" step="any" value={s.annualRatePct}
                      onChange={(e) => setScenario(i, { annualRatePct: Number(e.target.value) || 0 })}
                      className="field mono w-[70px] px-2 py-1 text-[12px]" aria-label={`${s.label} rate percent`}
                    />%
                  </label>
                  <label className="flex items-center gap-1">
                    Years
                    <input
                      type="number" min="0.5" step="0.5" value={s.years}
                      onChange={(e) => setScenario(i, { years: Number(e.target.value) || 1 })}
                      className="field mono w-[60px] px-2 py-1 text-[12px]" aria-label={`${s.label} years`}
                    />
                  </label>
                </div>
                <p className="mono mt-1.5 text-[15px] font-semibold">EMI {money0(s.emi)}/mo</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  Total interest {money0(s.totalInterest)} · debt load {Math.round(s.dtiAfter * 100)}% · weak month {money0(s.weakMonthNet)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{s.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.tips.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-3" data-testid="idea-tips">
          {report.tips.map((t, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground">
              <span className="mt-0.5 shrink-0 text-primary">•</span>{t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
