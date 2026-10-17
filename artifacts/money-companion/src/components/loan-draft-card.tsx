import { useMemo, useState } from "react";
import { Check, HandCoins, LoaderCircle, Pencil, X } from "lucide-react";
import type { CategoryRow, LoanRow } from "@/lib/database.types";
import type { LoanDraft } from "@/lib/ai-agent";
import { matchCategoryName } from "@/lib/ai-agent";
import { splitPayment } from "@/lib/loanUtils";
import { useCreateLoan, useLoanPayments, useRecordLoanPayment } from "@/hooks/useFinance";
import { useCurrency } from "@/hooks/useCurrency";

const todayStr = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
};

/**
 * Confirm-before-save card for loan actions detected in notes/chat.
 * Principal NEVER becomes income/expense — only the interest portion of a
 * repayment is synced as an income/expense transaction.
 */
export function LoanDraftCard({
  loanDraft,
  loans,
  categories,
  onDone,
}: {
  loanDraft: LoanDraft;
  loans: LoanRow[];
  categories: CategoryRow[];
  onDone: () => void;
}) {
  if (loanDraft.kind === "loan_new") {
    return <NewLoanCard draft={loanDraft} onDone={onDone} />;
  }
  const loan = loans.find((l) => l.id === loanDraft.loan_id);
  if (!loan) return null;
  return <RepaymentCard draft={loanDraft} loan={loan} categories={categories} onDone={onDone} />;
}

function NewLoanCard({ draft, onDone }: { draft: Extract<LoanDraft, { kind: "loan_new" }>; onDone: () => void }) {
  const createLoan = useCreateLoan();
  const { currency, symbol, formatMoney: money } = useCurrency();
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState(draft.amount);
  const [counterparty, setCounterparty] = useState(draft.counterparty);
  const [loanType, setLoanType] = useState<"lent" | "borrowed">(draft.loan_type);
  const [interestRate, setInterestRate] = useState(draft.interest_rate);

  const lent = loanType === "lent";
  const save = () => {
    setError("");
    if (!amount || amount <= 0) {
      setError("Please enter a valid loan amount.");
      return;
    }
    if (!counterparty.trim()) {
      setError("Please specify who this loan is with.");
      return;
    }
    createLoan.mutate(
      {
        type: loanType,
        counterparty: counterparty.trim(),
        principal: amount,
        currency: currency,
        interest_rate: interestRate,
        interest_type: interestRate > 0 ? "simple" : "none",
        interest_period: "monthly",
        start_date: todayStr(),
        due_date: null,
        amount_repaid: 0,
        status: "active",
        notes: null,
      },
      {
        onSuccess: onDone,
        onError: (e) => setError(e instanceof Error ? e.message : "Could not save the loan."),
      },
    );
  };
  return (
    <div className="mt-3 rounded-xl bg-card p-3.5 shadow-sm border border-border/80" data-testid="loan-draft-new">
      {isEditing ? (
        <div className="space-y-3" data-testid="loan-draft-edit-panel">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Pencil size={13} />
              <span>Edit loan details</span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              title="Close edit panel"
              data-testid="button-close-loan-edit"
            >
              <X size={15} />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-muted-foreground">Loan direction</label>
            <div className="grid grid-cols-2 rounded-full bg-muted p-1">
              <button
                type="button"
                onClick={() => setLoanType("lent")}
                className={`rounded-full py-1 text-xs font-bold transition ${
                  loanType === "lent" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Lent (Given)
              </button>
              <button
                type="button"
                onClick={() => setLoanType("borrowed")}
                className={`rounded-full py-1 text-xs font-bold transition ${
                  loanType === "borrowed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Borrowed (Taken)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground">Amount</label>
            <div className="relative mt-1 flex items-center">
              <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground select-none">
                {symbol}
              </span>
              <input
                type="number"
                min="0.01"
                step="any"
                value={amount === 0 ? "" : amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="field mono text-base font-semibold w-full"
                style={{ paddingLeft: "34px" }}
                data-testid="input-edit-loan-amount"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground">
              {loanType === "lent" ? "Who borrowed it? (Borrower)" : "Who lent it? (Lender)"}
            </label>
            <input
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="e.g. Sarah, Bank, Mike"
              className="field mt-1 w-full text-xs"
              data-testid="input-edit-loan-counterparty"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground">Interest rate % (optional, 0 for none)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              className="field mt-1 w-full text-xs"
              data-testid="input-edit-loan-rate"
            />
          </div>

          {error && <p className="mt-1.5 text-[11px] text-destructive" role="alert">{error}</p>}

          <div className="mt-2.5 flex items-center gap-2 pt-1 border-t border-border/40">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-border px-3 py-2 text-[12px] font-bold text-foreground hover:bg-muted"
            >
              Done
            </button>
            <button
              type="button"
              onClick={save}
              disabled={createLoan.isPending || !amount || !counterparty.trim()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
              data-testid="button-loan-draft-save-edited"
            >
              {createLoan.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
              {createLoan.isPending ? "Saving…" : "Save loan"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <HandCoins size={12} /> Loan draft — principal, not {lent ? "income" : "expense"}
            </p>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary underline-offset-2 hover:underline"
              data-testid="button-loan-draft-edit-open"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          <p className="mono mt-1 text-xl font-semibold">
            {lent ? "Lent" : "Borrowed"} · {money(amount)}
          </p>
          <p className="mt-0.5 text-[12px] font-semibold">
            {lent ? "to" : "from"} {counterparty} · {interestRate > 0 ? `${interestRate}% interest` : "0% interest"}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            This stays on the Loans page only. Your income, expenses and balance will not move.
          </p>
          {error && <p className="mt-1.5 text-[11px] text-destructive" role="alert">{error}</p>}
          <div className="mt-2.5 flex gap-2">
            <button onClick={onDone} className="rounded-full border border-border px-3 py-2 text-[12px] font-bold" data-testid="button-loan-draft-cancel">
              Discard
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-background px-3 py-2 text-[12px] font-bold text-foreground transition hover:border-primary hover:text-primary active:scale-95"
              data-testid="button-loan-draft-edit"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={save}
              disabled={createLoan.isPending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
              data-testid="button-loan-draft-save"
            >
              {createLoan.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
              {createLoan.isPending ? "Saving…" : "Save loan"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function RepaymentCard({
  draft,
  loan,
  categories,
  onDone,
}: {
  draft: Extract<LoanDraft, { kind: "loan_payment" }>;
  loan: LoanRow;
  categories: CategoryRow[];
  onDone: () => void;
}) {
  const recordPayment = useRecordLoanPayment();
  const { formatMoney: money } = useCurrency();
  const paymentsQuery = useLoanPayments(loan.id, true);
  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const auto = useMemo(() => splitPayment(loan, payments, draft.amount), [loan, payments, draft.amount]);
  const [interestInput, setInterestInput] = useState<string | null>(null);
  const [principalInput, setPrincipalInput] = useState<string | null>(null);
  const [error, setError] = useState("");
  const isLent = loan.type === "lent";
  const lockedInterestOnly = draft.interestOnly === true;

  const interest = lockedInterestOnly ? draft.amount : interestInput !== null ? Number(interestInput) || 0 : auto.interestPart;
  const principal = lockedInterestOnly ? 0 : principalInput !== null ? Number(principalInput) || 0 : auto.principalPart;
  const total = Math.round((interest + principal) * 100) / 100;
  const valid = total === Math.round(draft.amount * 100) / 100 && (interest > 0 || principal > 0);

  const save = () => {
    setError("");
    if (!valid) {
      setError(`Interest + principal must add up to ${money(draft.amount)}.`);
      return;
    }
    const interestCat = matchCategoryName("interest", isLent ? "income" : "expense", categories);
    recordPayment.mutate(
      {
        loan,
        payment: {
          loan_id: loan.id,
          amount: draft.amount,
          payment_date: todayStr(),
          payment_type: interest > 0 && principal > 0 ? "both" : interest > 0 ? "interest" : "principal",
          notes: null,
        },
        syncToTransactions: interest > 0,
        interestAmount: interest,
        principalAmount: principal,
        interestCategoryId: interestCat?.id ?? null,
      },
      {
        onSuccess: onDone,
        onError: (e) => setError(e instanceof Error ? e.message : "Could not record the repayment."),
      },
    );
  };

  return (
    <div className="mt-3 rounded-xl bg-card p-3" data-testid="loan-draft-payment">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <HandCoins size={12} /> Repayment draft — {isLent ? `${loan.counterparty} pays you` : `you pay ${loan.counterparty}`}
      </p>
      <p className="mono mt-1 text-xl font-semibold">{money(draft.amount)}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {lockedInterestOnly
          ? "Interest only — the principal stays untouched."
          : `Interest still due on this loan: ${money(auto.interestDue)}. Settled first, automatically — adjust if needed.`}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-bold">
          Interest {isLent ? "(→ income)" : "(→ expense)"}
          <input
            type="number"
            min="0"
            step="any"
            disabled={lockedInterestOnly}
            value={lockedInterestOnly ? draft.amount : (interestInput ?? auto.interestPart)}
            onChange={(e) => setInterestInput(e.target.value)}
            className="field mono mt-1 py-2 text-[13px] disabled:opacity-70"
            aria-label="Interest portion"
            data-testid="input-loan-interest-part"
          />
        </label>
        <label className="block text-[11px] font-bold">
          Principal (→ loan only)
          <input
            type="number"
            min="0"
            step="any"
            disabled={lockedInterestOnly}
            value={lockedInterestOnly ? 0 : (principalInput ?? auto.principalPart)}
            onChange={(e) => setPrincipalInput(e.target.value)}
            className="field mono mt-1 py-2 text-[13px] disabled:opacity-70"
            aria-label="Principal portion"
            data-testid="input-loan-principal-part"
          />
        </label>
      </div>
      {!valid && (
        <p className="mt-1.5 text-[10px] font-semibold text-[#8a6a2f]">
          Split is {money(total)} — must equal {money(draft.amount)}.
        </p>
      )}
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        Only {money(interest)} will appear as {isLent ? "income" : "an expense"}. The principal only shrinks the loan.
      </p>
      {error && <p className="mt-1.5 text-[11px] text-destructive" role="alert">{error}</p>}
      <div className="mt-2.5 flex gap-2">
        <button onClick={onDone} className="flex-1 rounded-full border border-border py-2 text-[12px] font-bold" data-testid="button-loan-payment-cancel">
          <span className="inline-flex items-center gap-1"><X size={13} /> Discard</span>
        </button>
        <button
          onClick={save}
          disabled={recordPayment.isPending || !valid || paymentsQuery.isLoading}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
          data-testid="button-loan-payment-save"
        >
          {recordPayment.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
          {recordPayment.isPending ? "Saving…" : "Confirm repayment"}
        </button>
      </div>
    </div>
  );
}
