import type { LoanPaymentRow, LoanRow, TransactionRow } from "./database.types";
import { calculateLoanDetails } from "./loanUtils";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface MoneyPosition {
  // Profit view — what you earned vs spent. Loan principal never appears here.
  incomeLifetime: number;
  expensesLifetime: number;
  surplusLifetime: number;
  // Cash view — every rupee that actually moved, this month and ever.
  openingsTotal: number;
  cashInMonth: number;
  cashOutMonth: number;
  cashNetMonth: number;
  cashInLifetime: number;
  cashOutLifetime: number;
  cashOnHand: number;
  // Obligation view — open loan balances including accrued interest.
  toReceive: number;
  toPay: number;
  activeLoanCount: number;
}

const empty: MoneyPosition = {
  incomeLifetime: 0,
  expensesLifetime: 0,
  surplusLifetime: 0,
  openingsTotal: 0,
  cashInMonth: 0,
  cashOutMonth: 0,
  cashNetMonth: 0,
  cashInLifetime: 0,
  cashOutLifetime: 0,
  cashOnHand: 0,
  toReceive: 0,
  toPay: 0,
  activeLoanCount: 0,
};

/**
 * Principal portion of a payment row for CASH movement purposes.
 * Interest rows move no loan principal; legacy 'both' rows (recorded before
 * splitting existed) carry the full amount, matching how amount_repaid
 * historically absorbed them.
 */
function principalMoved(payment: LoanPaymentRow): number {
  if (payment.payment_type === "interest") return 0;
  return r2(payment.amount);
}

/**
 * Separates three views a financially aware person needs:
 *  1. Income/expenses — performance (did I earn more than I spent?)
 *  2. Cash inflow/outflow + on hand — liquidity (what actually moved / remains?)
 *  3. To receive / to pay — obligations (who owes whom?)
 *
 * Loan principal flows through views 2 and 3 only. Interest flows through
 * views 1 and 2 (it arrives/leaves as an income/expense transaction).
 */
export function computePosition(
  transactions: TransactionRow[],
  loans: LoanRow[],
  payments: LoanPaymentRow[],
  monthStartISO: string,
  openingsTotal = 0,
): MoneyPosition {
  const pos = { ...empty };
  const inMonth = (date: string | null | undefined) => !!date && date.slice(0, 10) >= monthStartISO;

  // Starting money — cash in hand, bank, wallets — counts as cash ever in.
  pos.openingsTotal = r2(openingsTotal);
  pos.cashInLifetime += pos.openingsTotal;

  for (const t of transactions) {
    const amt = r2(t.amount);
    const monthly = inMonth(t.transaction_date);
    if (t.type === "income") {
      pos.incomeLifetime += amt;
      pos.cashInLifetime += amt;
      if (monthly) pos.cashInMonth += amt;
    } else {
      pos.expensesLifetime += amt;
      pos.cashOutLifetime += amt;
      if (monthly) pos.cashOutMonth += amt;
    }
  }

  const loanById = new Map(loans.map((l) => [l.id, l]));
  for (const l of loans) {
    const principal = r2(l.principal);
    const monthly = inMonth(l.start_date);
    if (l.type === "lent") {
      // You handed cash out — it left your hand but is NOT spending.
      pos.cashOutLifetime += principal;
      if (monthly) pos.cashOutMonth += principal;
    } else {
      // You received cash — it is in your hand but is NOT income.
      pos.cashInLifetime += principal;
      if (monthly) pos.cashInMonth += principal;
    }
    if (l.status === "active") {
      pos.activeLoanCount += 1;
      const balance = calculateLoanDetails(l).netRemainingBalance;
      if (l.type === "lent") pos.toReceive += balance;
      else pos.toPay += balance;
    }
  }

  for (const p of payments) {
    const loan = loanById.get(p.loan_id);
    if (!loan) continue;
    const moved = principalMoved(p);
    if (moved <= 0) continue;
    const monthly = inMonth(p.payment_date);
    if (loan.type === "lent") {
      // Principal returned to you — cash in, not income.
      pos.cashInLifetime += moved;
      if (monthly) pos.cashInMonth += moved;
    } else {
      // You repaid principal — cash out, not spending.
      pos.cashOutLifetime += moved;
      if (monthly) pos.cashOutMonth += moved;
    }
  }

  pos.incomeLifetime = r2(pos.incomeLifetime);
  pos.expensesLifetime = r2(pos.expensesLifetime);
  pos.surplusLifetime = r2(pos.incomeLifetime - pos.expensesLifetime);
  pos.cashInMonth = r2(pos.cashInMonth);
  pos.cashOutMonth = r2(pos.cashOutMonth);
  pos.cashNetMonth = r2(pos.cashInMonth - pos.cashOutMonth);
  pos.cashInLifetime = r2(pos.cashInLifetime);
  pos.cashOutLifetime = r2(pos.cashOutLifetime);
  pos.cashOnHand = r2(pos.cashInLifetime - pos.cashOutLifetime);
  pos.toReceive = r2(pos.toReceive);
  pos.toPay = r2(pos.toPay);
  return pos;
}
