import type { LoanPaymentRow, LoanRow } from './database.types';

export interface LoanCalculations {
  daysElapsed: number;
  monthsElapsed: number;
  accruedInterest: number;
  totalPayableOrReceivable: number;
  principalRemaining: number;
  netRemainingBalance: number;
  isOverdue: boolean;
  effectiveAnnualRate: number;
}

/**
 * Calculates exact accrued interest and remaining balance based on loan terms
 * Supports simple monthly interest (common in Nepal: 1%, 1.5%, 2% per month),
 * annual interest, or non-interest loans.
 */
export function calculateLoanDetails(
  loan: LoanRow,
  asOfDate: Date = new Date(),
): LoanCalculations {
  const start = new Date(loan.start_date);
  const now = asOfDate;
  const msElapsed = Math.max(0, now.getTime() - start.getTime());
  const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));
  const monthsElapsed = daysElapsed / 30.4167;

  let accruedInterest = 0;
  const principal = Number(loan.principal) || 0;
  const rate = Number(loan.interest_rate) || 0;
  const repaid = Number(loan.amount_repaid) || 0;

  let effectiveAnnualRate = rate;
  if (loan.interest_period === 'monthly') {
    effectiveAnnualRate = rate * 12;
  }

  if (loan.interest_type === 'simple' && rate > 0) {
    if (loan.interest_period === 'monthly') {
      // Monthly simple interest: Principal * (rate% / 30.4167 days) * daysElapsed
      accruedInterest = (principal * (rate / 100) * daysElapsed) / 30.4167;
    } else {
      // Yearly simple interest: Principal * (rate% / 365 days) * daysElapsed
      accruedInterest = (principal * (rate / 100) * daysElapsed) / 365;
    }
  } else if (loan.interest_type === 'compound' && rate > 0) {
    // Compound interest: monthly compounding
    const years = daysElapsed / 365;
    const compoundRate = effectiveAnnualRate / 100;
    accruedInterest =
      principal * Math.pow(1 + compoundRate / 12, 12 * years) - principal;
  }

  accruedInterest = Math.max(0, Math.round(accruedInterest * 100) / 100);
  const totalPayableOrReceivable =
    Math.round((principal + accruedInterest) * 100) / 100;
  const netRemainingBalance = Math.max(
    0,
    Math.round((totalPayableOrReceivable - repaid) * 100) / 100,
  );
  const principalRemaining = Math.max(
    0,
    Math.round((principal - repaid) * 100) / 100,
  );

  const isOverdue = loan.due_date
    ? new Date(loan.due_date).getTime() < now.getTime() && netRemainingBalance > 0
    : false;

  return {
  daysElapsed,
  monthsElapsed: Math.round(monthsElapsed * 10) / 10,
  accruedInterest,
  totalPayableOrReceivable,
  principalRemaining,
  netRemainingBalance,
  isOverdue,
  effectiveAnnualRate,
  };
}

/**
 * Total interest already settled on a loan, from explicit interest payment
 * rows. Legacy 'both' rows (recorded before splitting existed) carry no
 * split, so they are treated as principal — matching how amount_repaid
 * historically absorbed the full amount.
 */
export function loanInterestPaid(payments: LoanPaymentRow[]): number {
  const total = payments
    .filter((p) => p.payment_type === 'interest')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Interest still unsettled on a loan: accrued minus already-paid interest.
 */
export function loanInterestDue(loan: LoanRow, payments: LoanPaymentRow[], asOfDate: Date = new Date()): number {
  const accrued = calculateLoanDetails(loan, asOfDate).accruedInterest;
  return Math.max(0, Math.round((accrued - loanInterestPaid(payments)) * 100) / 100);
}

export interface PaymentSplit {
  interestPart: number;
  principalPart: number;
  interestDue: number;
}

/**
 * Interest-first split: a repayment settles outstanding interest before
 * touching principal. Principal (and its movement) never belongs in
 * income/expenses — only the interest part does.
 */
export function splitPayment(
  loan: LoanRow,
  payments: LoanPaymentRow[],
  amount: number,
  asOfDate: Date = new Date(),
): PaymentSplit {
  const total = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  const interestDue = loanInterestDue(loan, payments, asOfDate);
  const interestPart = Math.min(total, interestDue);
  return {
    interestPart: Math.round(interestPart * 100) / 100,
    principalPart: Math.round((total - interestPart) * 100) / 100,
    interestDue,
  };
}
