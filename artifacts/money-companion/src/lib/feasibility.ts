import type { LoanPaymentRow, LoanRow, TransactionRow } from "./database.types";
import { computePosition } from "./money-position";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface IdeaNumbers {
  one_time_cost: number;
  monthly_cost: number;
  expected_monthly_return: number;
  return_starts_in_months: number;
}

export interface FinancialBase {
  /** Average monthly income over recent full months. */
  avgMonthlyIncome: number;
  /** Average monthly expenses over recent full months. */
  avgMonthlyExpenses: number;
  /** Liquid cash available right now (on hand + openings). */
  cashOnHand: number;
  /** Current monthly debt burden (loan interest accrual on money owed). */
  monthlyObligations: number;
}

export interface LoanScenarioInput {
  label: string;
  annualRatePct: number;
  years: number;
}

export interface ScenarioResult extends LoanScenarioInput {
  loanAmount: number;
  emi: number;
  totalInterest: number;
  dtiAfter: number;
  weakMonthNet: number;
  ok: boolean;
  reason: string;
}

export type FeasibilityVerdict = "ready" | "wait" | "loan" | "not_advisable";

export interface FeasibilityReport {
  verdict: FeasibilityVerdict;
  verdictReason: string;
  /** Which ceiling binds — the lever that changes the answer. */
  bindingConstraint: "cash" | "income" | "weak_month" | "none";
  monthlySurplus: number;
  reserveFloor: number;
  cashAfterReserve: number;
  shortfall: number;
  waitMonths: number | null;
  monthlyObligations: number;
  dtiNow: number;
  weakMonthOk: boolean;
  scenarios: ScenarioResult[];
  tips: string[];
}

export const DEFAULT_SCENARIOS: LoanScenarioInput[] = [
  { label: "Bank loan", annualRatePct: 13, years: 3 },
  { label: "Cooperative", annualRatePct: 18, years: 2 },
  { label: "Family (0%)", annualRatePct: 0, years: 1 },
];

export const DTI_CAP = 0.36;
const RESERVE_MONTHS = 3;

/** Standard reducing-balance EMI. */
export function emi(principal: number, annualRatePct: number, years: number): { emi: number; totalInterest: number } {
  const P = Math.max(0, Number(principal) || 0);
  const n = Math.max(1, Math.round((Number(years) || 1) * 12));
  const r = Math.max(0, Number(annualRatePct) || 0) / 1200;
  if (P <= 0) return { emi: 0, totalInterest: 0 };
  if (r <= 0) {
    const e = P / n;
    return { emi: r2(e), totalInterest: 0 };
  }
  const factor = Math.pow(1 + r, n);
  const e = (P * r * factor) / (factor - 1);
  return { emi: r2(e), totalInterest: r2(e * n - P) };
}

/** Approximate monthly interest burden of money currently owed (borrowed loans). */
export function monthlyDebtBurden(loans: LoanRow[]): number {
  let total = 0;
  for (const l of loans) {
    if (l.status !== "active" || l.type !== "borrowed") continue;
    const rate = Number(l.interest_rate) || 0;
    if (rate <= 0) continue;
    const principal = Number(l.principal) || 0;
    total += l.interest_period === "monthly" ? (principal * rate) / 100 : (principal * rate) / 1200;
  }
  return r2(total);
}

/** Assemble the engine inputs from app data. Averages use last 6 full months. */
export function buildFinancialBase(
  transactions: TransactionRow[],
  loans: LoanRow[],
  payments: LoanPaymentRow[],
  openingsTotal: number,
  monthStartISO: string,
): FinancialBase {
  const avgs = monthlyAverages(transactions, 6);
  const position = computePosition(transactions, loans, payments, monthStartISO, openingsTotal);
  return {
    avgMonthlyIncome: avgs.income,
    avgMonthlyExpenses: avgs.expenses,
    cashOnHand: position.cashOnHand,
    monthlyObligations: monthlyDebtBurden(loans),
  };
}

/** Average income/expenses over the last N completed calendar months. */
export function monthlyAverages(transactions: TransactionRow[], months = 6, todayISO?: string): { income: number; expenses: number } {
  const today = (todayISO || new Date().toISOString()).slice(0, 10);
  const [y, m] = today.split("-").map(Number);
  const buckets = new Map<string, { income: number; expenses: number }>();
  for (let i = 1; i <= months; i++) {
    const d = new Date(Date.UTC(y, m - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { income: 0, expenses: 0 });
  }
  for (const t of transactions) {
    const key = t.transaction_date.slice(0, 7);
    const b = buckets.get(key);
    if (!b) continue;
    if (t.type === "income") b.income += Number(t.amount) || 0;
    else b.expenses += Number(t.amount) || 0;
  }
  let income = 0;
  let expenses = 0;
  for (const b of buckets.values()) {
    income += b.income;
    expenses += b.expenses;
  }
  return { income: r2(income / months), expenses: r2(expenses / months) };
}

export function analyzeFeasibility(
  fin: FinancialBase,
  idea: IdeaNumbers,
  scenarios: LoanScenarioInput[] = DEFAULT_SCENARIOS,
): FeasibilityReport {
  const income = Math.max(0, fin.avgMonthlyIncome);
  const expenses = Math.max(0, fin.avgMonthlyExpenses);
  const obligations = Math.max(0, fin.monthlyObligations);
  const cash = Math.max(0, fin.cashOnHand);
  const oneTime = Math.max(0, idea.one_time_cost);
  const monthlyCost = Math.max(0, idea.monthly_cost);
  const expectedReturn = Math.max(0, idea.expected_monthly_return);
  const startsIn = Math.max(0, Math.floor(idea.return_starts_in_months || 0));

  const surplus = r2(income - expenses);
  const reserveFloor = r2(expenses * RESERVE_MONTHS);
  const cashAfterReserve = r2(cash - reserveFloor);
  const dtiNow = income > 0 ? obligations / income : obligations > 0 ? 1 : 0;

  // Month still works if the idea's running cost + obligations fit the surplus,
  // counting expected returns once they begin.
  const monthlyPre = r2(surplus - monthlyCost - obligations);
  const monthlyPost = r2(surplus - monthlyCost - obligations + expectedReturn);
  // Bridge cash needed to survive until returns begin.
  const bridge = monthlyPre < 0 && expectedReturn > 0 ? r2(-monthlyPre * startsIn) : 0;

  const tips: string[] = [];
  const scenariosOut: ScenarioResult[] = [];
  let verdict: FeasibilityVerdict;
  let verdictReason: string;
  let bindingConstraint: FeasibilityReport["bindingConstraint"] = "none";
  let waitMonths: number | null = null;
  const shortfall = r2(Math.max(0, oneTime - Math.max(0, cashAfterReserve)));

  const weakBase = (extraMonthly: number) => r2(income * 0.8 - expenses - obligations - extraMonthly);

  const evalScenario = (s: LoanScenarioInput, loanAmount: number, ideaMonthly: number): ScenarioResult => {
    const { emi: e, totalInterest } = emi(loanAmount, s.annualRatePct, s.years);
    const dtiAfter = income > 0 ? (obligations + e) / income : 1;
    const weakMonthNet = r2(weakBase(ideaMonthly + e));
    const ok = dtiAfter <= DTI_CAP && weakMonthNet >= 0 && loanAmount > 0;
    const reason = !ok
      ? loanAmount <= 0
        ? "No loan needed."
        : dtiAfter > DTI_CAP
          ? `EMI would push debt load to ${Math.round(dtiAfter * 100)}% of income (safe ≤ 36%).`
          : "A weak month (income −20%) would go negative with this EMI."
      : `EMI ${e.toLocaleString()} fits: debt load ${Math.round(dtiAfter * 100)}%, weak month stays positive.`;
    return { ...s, loanAmount: r2(loanAmount), emi: e, totalInterest, dtiAfter: r2(dtiAfter), weakMonthNet, ok, reason };
  };

  if (shortfall <= 0 && monthlyPre >= 0) {
    verdict = "ready";
    verdictReason =
      expectedReturn > 0
        ? "Cash covers the upfront cost and the month still works — returns are a bonus."
        : "Cash covers the upfront cost and the month still works after the running cost.";
  } else if (shortfall <= 0 && expectedReturn > 0 && monthlyPost >= 0 && cashAfterReserve - oneTime - bridge >= 0) {
    verdict = "ready";
    verdictReason = `Cash covers the upfront cost plus a ${startsIn}-month bridge until returns begin.`;
  } else if (shortfall > 0) {
    bindingConstraint = "cash";
    const savable = r2(surplus - obligations);
    if (savable > 0) {
      waitMonths = Math.ceil(shortfall / savable);
      if (waitMonths <= 24) {
        verdict = "wait";
        verdictReason = `Short by ${shortfall.toLocaleString()}. At Rs ${savable.toLocaleString()}/month saved, ready in ~${waitMonths} month${waitMonths === 1 ? "" : "s"}.`;
      } else {
        verdict = "loan";
        verdictReason = `Short by ${shortfall.toLocaleString()} — saving alone takes ${waitMonths} months, so a loan is the realistic path. Scenarios below.`;
      }
    } else {
      verdict = "loan";
      verdictReason = `Short by ${shortfall.toLocaleString()} with no monthly room to save — only a loan (or a cheaper idea) works. Scenarios below.`;
    }
    for (const s of scenarios) scenariosOut.push(evalScenario(s, shortfall, monthlyCost));
    if (verdict === "loan" && !scenariosOut.some((s) => s.ok)) {
      verdict = "not_advisable";
      verdictReason = `Short by ${shortfall.toLocaleString()} and no loan scenario survives the 36% debt-load and weak-month tests. Shrink the idea or grow income first.`;
    }
  } else {
    // Cash is fine but the month doesn't work, even with returns.
    bindingConstraint = "income";
    verdict = "not_advisable";
    verdictReason =
      expectedReturn > 0
        ? "The upfront cost is payable, but the monthly math never works — running cost plus obligations outpace income even after returns begin."
        : "The upfront cost is payable, but the monthly running cost plus obligations outpace income.";
    tips.push("Cut the idea's monthly cost, raise expected returns, or clear existing obligations first.");
  }

  // Weak-month stress test on the affordable path (no new EMI, or covered above).
  const weakMonthOk = weakBase(verdict === "ready" ? monthlyCost : 0) >= 0;
  if (!weakMonthOk && verdict === "ready") {
    bindingConstraint = "weak_month";
    tips.push("A weak month (income −20%) would go negative — keep a bigger buffer or trim monthly costs before starting.");
  }
  if (dtiNow > DTI_CAP) {
    tips.push(`Existing debt load is ${Math.round(dtiNow * 100)}% of income (safe ≤ 36%) — clear dues before adding more.`);
  }
  if (cash < reserveFloor) {
    tips.push(`Cash is below a ${RESERVE_MONTHS}-month safety reserve (${reserveFloor.toLocaleString()}) — rebuild reserves alongside any plan.`);
  }
  if (verdict === "wait" && waitMonths !== null) {
    tips.push(`Putting aside the full surplus monthly reaches the goal fastest; every extra rupee of spending delays it.`);
  }

  return {
    verdict,
    verdictReason,
    bindingConstraint,
    monthlySurplus: surplus,
    reserveFloor,
    cashAfterReserve,
    shortfall,
    waitMonths,
    monthlyObligations: obligations,
    dtiNow: r2(dtiNow),
    weakMonthOk,
    scenarios: scenariosOut,
    tips: tips.slice(0, 4),
  };
}
