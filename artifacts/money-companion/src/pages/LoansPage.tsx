import { useMemo, useState, FormEvent, ReactNode } from 'react';
import { Link } from 'wouter';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Flame,
  HandCoins,
  History,
  Layers,
  LoaderCircle,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  useLoans,
  useCreateLoan,
  useUpdateLoan,
  useDeleteLoan,
  useRecordLoanPayment,
  useCategories,
  useLoanPayments,
} from '@/hooks/useFinance';
import { calculateLoanDetails, splitPayment } from '@/lib/loanUtils';
import { matchCategoryName } from '@/lib/ai-agent';
import { useCurrency } from '@/hooks/useCurrency';
import type {
  InterestPeriod,
  InterestType,
  LoanInput,
  LoanRow,
  LoanType,
} from '@/lib/database.types';

const dateLabel = (date: string) => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz,
  }).format(new Date(date));
};

const todayStr = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
};

export function LoansPage() {
  const { currency, symbol, formatMoney: money } = useCurrency();
  const loansQuery = useLoans();
  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();
  const deleteLoan = useDeleteLoan();
  const recordPayment = useRecordLoanPayment();

  const [typeFilter, setTypeFilter] = useState<'all' | LoanType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paid'>('active');
  const [search, setSearch] = useState('');

  // Dialog states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanRow | null>(null);
  const [deletingLoan, setDeletingLoan] = useState<LoanRow | null>(null);
  const [payingLoan, setPayingLoan] = useState<LoanRow | null>(null);
  const [notice, setNotice] = useState('');

  const loans = loansQuery.data ?? [];

  // Computed metrics across all loans
  const loanMetrics = useMemo(() => {
    let totalLentPrincipal = 0;
    let totalLentAccruedInterest = 0;
    let totalLentRemaining = 0;

    let totalBorrowedPrincipal = 0;
    let totalBorrowedAccruedInterest = 0;
    let totalBorrowedRemaining = 0;

    let activeLentCount = 0;
    let activeBorrowedCount = 0;

    for (const loan of loans) {
      const calc = calculateLoanDetails(loan);
      if (loan.type === 'lent') {
        totalLentPrincipal += Number(loan.principal);
        totalLentAccruedInterest += calc.accruedInterest;
        totalLentRemaining += calc.netRemainingBalance;
        if (loan.status === 'active') activeLentCount++;
      } else {
        totalBorrowedPrincipal += Number(loan.principal);
        totalBorrowedAccruedInterest += calc.accruedInterest;
        totalBorrowedRemaining += calc.netRemainingBalance;
        if (loan.status === 'active') activeBorrowedCount++;
      }
    }

    return {
      totalLentPrincipal,
      totalLentAccruedInterest,
      totalLentRemaining,
      totalBorrowedPrincipal,
      totalBorrowedAccruedInterest,
      totalBorrowedRemaining,
      activeLentCount,
      activeBorrowedCount,
      netReceivable: totalLentRemaining - totalBorrowedRemaining,
    };
  }, [loans]);

  // Filtered loans list
  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      if (typeFilter !== 'all' && l.type !== typeFilter) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = l.counterparty.toLowerCase().includes(query);
        const matchNotes = (l.notes || '').toLowerCase().includes(query);
        if (!matchName && !matchNotes) return false;
      }
      return true;
    });
  }, [loans, typeFilter, statusFilter, search]);

  return (
    <div className="page-enter">
      {/* Top Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#29473d]/10 text-[#29473d]">
              <HandCoins size={14} />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
              Borrowing &amp; Lending Record
            </p>
          </div>
          <h1 className="serif text-[38px] leading-[1.06] tracking-[-.035em] sm:text-[46px]">
            Loans &amp; Debt
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Clear records of money you lent to others and loans you have taken,
            with true day-to-day accrued interest.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5"
          data-testid="button-new-loan"
        >
          <Plus size={17} />
          New loan record
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between rounded-xl bg-[#e6eee3] px-4 py-3 text-sm text-[#466548]"
          data-testid="status-loan-notice"
        >
          <span>{notice}</span>
          <button
            onClick={() => setNotice('')}
            aria-label="Dismiss"
            data-testid="dismiss-loan-notice"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        {/* Money Given (Lent) */}
        <div className="relative overflow-hidden rounded-[24px] border border-[#d9c5ab] bg-[#fdfbf7] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-[#44634f]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e3ebd9] text-[#44634f]">
                <ArrowDownLeft size={16} />
              </span>
              Given Loan (To Receive)
            </span>
            <span className="rounded-full bg-[#e8eee4] px-2.5 py-0.5 text-[10px] font-bold text-[#4e6b57]">
              {loanMetrics.activeLentCount} active
            </span>
          </div>
          <p className="mono mt-3 text-[30px] font-bold tracking-tight text-[#2d4d40]" data-testid="metric-total-lent-remaining">
            {money(loanMetrics.totalLentRemaining)}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-[#eedfcb] pt-3 text-xs text-muted-foreground">
            <span>Principal: {money(loanMetrics.totalLentPrincipal)}</span>
            <span className="font-semibold text-[#4e6b57]">
              + {money(loanMetrics.totalLentAccruedInterest)} interest
            </span>
          </div>
        </div>

        {/* Money Received (Borrowed) */}
        <div className="relative overflow-hidden rounded-[24px] border border-[#e4cbbf] bg-[#fffaf8] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-[#98583b]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f6e5dc] text-[#98583b]">
                <ArrowUpRight size={16} />
              </span>
              Received Loan (To Pay)
            </span>
            <span className="rounded-full bg-[#f7e6dd] px-2.5 py-0.5 text-[10px] font-bold text-[#8d4f34]">
              {loanMetrics.activeBorrowedCount} active
            </span>
          </div>
          <p className="mono mt-3 text-[30px] font-bold tracking-tight text-[#84452a]" data-testid="metric-total-borrowed-remaining">
            {money(loanMetrics.totalBorrowedRemaining)}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-[#f0ded6] pt-3 text-xs text-muted-foreground">
            <span>Principal: {money(loanMetrics.totalBorrowedPrincipal)}</span>
            <span className="font-semibold text-[#98583b]">
              + {money(loanMetrics.totalBorrowedAccruedInterest)} interest
            </span>
          </div>
        </div>

        {/* Net Debt Position */}
        <div className="relative overflow-hidden rounded-[24px] border border-border bg-[#213e36] p-5 text-[#f7f2e8] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-white/70">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white">
                <Wallet size={15} />
              </span>
              Net Lending Position
            </span>
            <span className="text-[10px] text-white/50">Lent − Borrowed</span>
          </div>
          <p
            className={`mono mt-3 text-[30px] font-bold tracking-tight ${
              loanMetrics.netReceivable >= 0 ? 'text-[#c6e4c3]' : 'text-[#f5beaa]'
            }`}
            data-testid="metric-net-loan-position"
          >
            {loanMetrics.netReceivable >= 0 ? '+' : '−'}
            {money(Math.abs(loanMetrics.netReceivable))}
          </p>
          <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/60">
            {loanMetrics.netReceivable >= 0
              ? 'You are owed more than you owe others.'
              : 'You owe more than you have lent to others.'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <label className="relative flex flex-1 items-center">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 text-muted-foreground select-none"
          />
          <input
            className="field"
            style={{ paddingLeft: '44px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search person, bank, or notes…"
            aria-label="Search loans"
            data-testid="input-search-loans"
          />
        </label>

        {/* Direction Switcher */}
        <div className="flex rounded-full border border-border bg-card p-1">
          {(['all', 'lent', 'borrowed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                typeFilter === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`filter-type-${f}`}
            >
              {f === 'all' ? 'All Loans' : f === 'lent' ? 'Given (Lent)' : 'Received (Borrowed)'}
            </button>
          ))}
        </div>

        {/* Status Switcher */}
        <div className="flex rounded-full border border-border bg-card p-1">
          {(['active', 'paid', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`filter-status-${s}`}
            >
              {s === 'active' ? 'Ongoing' : s === 'paid' ? 'Settled' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Loans Cards List */}
      <div className="space-y-4">
        {loansQuery.isLoading ? (
          <div className="space-y-4 py-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-[24px] bg-muted" />
            ))}
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="rounded-[24px] border border-border bg-card p-12 text-center soft-shadow">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#eee5d6] text-[#4f6758]">
              <HandCoins size={22} />
            </div>
            <h3 className="serif text-xl">No loans recorded here</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters or search.'
                : 'Keep a clear track of money you give or receive on interest.'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground"
              data-testid="empty-add-loan"
            >
              <Plus size={15} />
              Record your first loan
            </button>
          </div>
        ) : (
          filteredLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onPay={() => setPayingLoan(loan)}
              onEdit={() => setEditingLoan(loan)}
              onDelete={() => setDeletingLoan(loan)}
              onToggleSettled={async () => {
                const nextStatus = loan.status === 'paid' ? 'active' : 'paid';
                await updateLoan.mutateAsync({
                  id: loan.id,
                  values: { status: nextStatus },
                });
                setNotice(
                  nextStatus === 'paid'
                    ? `Marked loan with ${loan.counterparty} as settled.`
                    : `Marked loan with ${loan.counterparty} as ongoing.`,
                );
              }}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <LoanFormModal
          title="Record a new loan"
          subtitle="Keep a true record of who, principal, and interest rate."
          busy={createLoan.isPending}
          onClose={() => setShowAddModal(false)}
          onSave={async (values) => {
            await createLoan.mutateAsync(values);
            setShowAddModal(false);
            setNotice(`Loan with ${values.counterparty} recorded.`);
          }}
        />
      )}

      {editingLoan && (
        <LoanFormModal
          title="Edit loan details"
          subtitle="Update principal, interest rate or tenure."
          initialData={editingLoan}
          busy={updateLoan.isPending}
          onClose={() => setEditingLoan(null)}
          onSave={async (values) => {
            await updateLoan.mutateAsync({ id: editingLoan.id, values });
            setEditingLoan(null);
            setNotice('Loan details updated.');
          }}
        />
      )}

      {payingLoan && (
        <RecordPaymentModal
          loan={payingLoan}
          busy={recordPayment.isPending}
          onClose={() => setPayingLoan(null)}
          onSave={async (payment, syncToTransactions, split) => {
            await recordPayment.mutateAsync({
              loan: payingLoan,
              payment,
              syncToTransactions,
              interestAmount: split.interestAmount,
              principalAmount: split.principalAmount,
              interestCategoryId: split.interestCategoryId,
            });
            setPayingLoan(null);
            setNotice(
              `Recorded payment of ${money(Number(payment.amount))} for ${payingLoan.counterparty} (interest ${money(split.interestAmount)}, principal ${money(split.principalAmount)}).`,
            );
          }}
        />
      )}

      {deletingLoan && (
        <ConfirmDeleteModal
          title="Remove this loan record?"
          message={`This will permanently delete the loan record for "${deletingLoan.counterparty}" and its associated payment logs.`}
          busy={deleteLoan.isPending}
          onClose={() => setDeletingLoan(null)}
          onConfirm={async () => {
            await deleteLoan.mutateAsync(deletingLoan.id);
            setDeletingLoan(null);
            setNotice('Loan record deleted.');
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Loan Card Component
// -------------------------------------------------------------
function LoanCard({
  loan,
  onPay,
  onEdit,
  onDelete,
  onToggleSettled,
}: {
  loan: LoanRow;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSettled: () => void;
}) {
  const { formatMoney: money } = useCurrency();
  const calc = calculateLoanDetails(loan);
  const isLent = loan.type === 'lent';
  const isSettled = loan.status === 'paid';
  const repaidPercent =
    calc.totalPayableOrReceivable > 0
      ? Math.min(100, (Number(loan.amount_repaid) / calc.totalPayableOrReceivable) * 100)
      : 0;

  return (
    <div
      className={`rounded-[24px] border p-5 transition-all soft-shadow sm:p-6 ${
        isSettled
          ? 'border-border/60 bg-card/60 opacity-80'
          : isLent
          ? 'border-[#dfd3c3] bg-card hover:border-[#cbba9e]'
          : 'border-[#e8d7cf] bg-card hover:border-[#cfb7aa]'
      }`}
      data-testid={`card-loan-${loan.id}`}
    >
      {/* Card Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
              isLent ? 'bg-[#e4eee2] text-[#426c4c]' : 'bg-[#f6e6dc] text-[#935436]'
            }`}
          >
            {isLent ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="serif text-xl tracking-tight text-foreground font-semibold">
                {loan.counterparty}
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isLent
                    ? 'bg-[#e4eee2] text-[#426c4c]'
                    : 'bg-[#f6e6dc] text-[#935436]'
                }`}
              >
                {isLent ? 'Given (Lent)' : 'Received (Borrowed)'}
              </span>
              {isSettled && (
                <span className="rounded-full bg-[#e3ebd9] px-2 py-0.5 text-[10px] font-bold text-[#44634f]">
                  ✓ Settled
                </span>
              )}
              {calc.isOverdue && !isSettled && (
                <span className="rounded-full bg-[#f8ded6] px-2 py-0.5 text-[10px] font-bold text-[#a44533]">
                  Overdue
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Started {dateLabel(loan.start_date)}
              {loan.due_date && ` · Due ${dateLabel(loan.due_date)}`}
              {` · Elapsed: ${calc.monthsElapsed > 0 ? `${calc.monthsElapsed} mos` : `${calc.daysElapsed} days`}`}
            </p>
          </div>
        </div>

        {/* Big Remaining Balance */}
        <div className="text-left sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {isLent ? 'Remaining to Receive' : 'Remaining to Pay'}
          </p>
          <p
            className={`mono text-2xl font-bold tracking-tight ${
              isSettled
                ? 'text-muted-foreground line-through'
                : isLent
                ? 'text-[#395c44]'
                : 'text-[#8c492c]'
            }`}
          >
            {money(calc.netRemainingBalance, loan.currency)}
          </p>
        </div>
      </div>

      {/* Interest & Breakdown Strip */}
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 sm:grid-cols-4">
        <div>
          <span className="text-[10px] text-muted-foreground">Principal (मूलधन)</span>
          <p className="mono text-sm font-semibold text-foreground">
            {money(Number(loan.principal), loan.currency)}
          </p>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground">Interest Rate (ब्याजदर)</span>
          <p className="text-sm font-semibold text-foreground">
            {Number(loan.interest_rate) === 0 ? (
              '0% (No interest)'
            ) : (
              <>
                {loan.interest_rate}% / {loan.interest_period === 'monthly' ? 'mo' : 'yr'}
                {loan.interest_period === 'monthly' && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({calc.effectiveAnnualRate}%/yr)
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground">Accrued Interest (ब्याज)</span>
          <p className="mono text-sm font-semibold text-[#a06842]">
            +{money(calc.accruedInterest, loan.currency)}
          </p>
        </div>

        <div>
          <span className="text-[10px] text-muted-foreground">Repaid so far (फिर्ता भएको)</span>
          <p className="mono text-sm font-semibold text-[#44634f]">
            {money(Number(loan.amount_repaid), loan.currency)}
          </p>
        </div>
      </div>

      {/* Repayment Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Repayment progress</span>
          <span>
            {repaidPercent.toFixed(1)}% ({money(Number(loan.amount_repaid))} of{' '}
            {money(calc.totalPayableOrReceivable)})
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isLent ? 'bg-[#4e7557]' : 'bg-[#98583b]'
            }`}
            style={{ width: `${Math.max(repaidPercent, 1)}%` }}
          />
        </div>
      </div>

      {loan.notes && (
        <p className="mt-3 text-xs italic text-muted-foreground">
          “{loan.notes}”
        </p>
      )}

      {/* Action Footer */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
        <div className="flex items-center gap-2">
          {!isSettled && (
            <button
              onClick={onPay}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:-translate-y-0.5"
              data-testid={`btn-pay-${loan.id}`}
            >
              <CreditCard size={14} />
              Record Repayment
            </button>
          )}

          <button
            onClick={onToggleSettled}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              isSettled
                ? 'border-border text-muted-foreground hover:text-foreground'
                : 'border-[#618a67]/30 bg-[#eef5ed] text-[#3d6044] hover:bg-[#e4ede3]'
            }`}
            data-testid={`btn-toggle-settle-${loan.id}`}
          >
            <CheckCircle2 size={14} />
            {isSettled ? 'Mark Ongoing' : 'Mark Settled'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid={`btn-edit-${loan.id}`}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-2 text-muted-foreground hover:bg-[#f6dfd8] hover:text-destructive"
            data-testid={`btn-delete-${loan.id}`}
            aria-label="Delete loan"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// New / Edit Loan Form Modal with Live Calculator
// -------------------------------------------------------------
function LoanFormModal({
  title,
  subtitle,
  initialData,
  busy,
  onClose,
  onSave,
}: {
  title: string;
  subtitle: string;
  initialData?: LoanRow;
  busy: boolean;
  onClose: () => void;
  onSave: (values: LoanInput) => void;
}) {
  const [type, setType] = useState<LoanType>(initialData?.type || 'lent');
  const { currency, symbol, formatMoney: money } = useCurrency();
  const [counterparty, setCounterparty] = useState(initialData?.counterparty || '');
  const [principal, setPrincipal] = useState(
    initialData?.principal ? String(initialData.principal) : '',
  );
  const [interestRate, setInterestRate] = useState(
    initialData?.interest_rate !== undefined ? String(initialData.interest_rate) : '1.5',
  );
  const [interestPeriod, setInterestPeriod] = useState<InterestPeriod>(
    initialData?.interest_period || 'monthly',
  );
  const [interestType, setInterestType] = useState<InterestType>(
    initialData?.interest_type || 'simple',
  );
  const [startDate, setStartDate] = useState(
    initialData?.start_date ? initialData.start_date.slice(0, 10) : todayStr(),
  );
  const [dueDate, setDueDate] = useState(
    initialData?.due_date ? initialData.due_date.slice(0, 10) : '',
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [error, setError] = useState('');

  // Live calculation preview
  const previewCalculation = useMemo(() => {
    const numPrincipal = Number(principal) || 0;
    const numRate = Number(interestRate) || 0;
    if (numPrincipal <= 0) return null;

    const mockLoan: LoanRow = {
      id: 'preview',
      user_id: 'preview',
      type,
      counterparty: counterparty || 'Person',
      principal: numPrincipal,
      currency: currency,
      interest_rate: numRate,
      interest_type: interestType,
      interest_period: interestPeriod,
      start_date: startDate || todayStr(),
      due_date: dueDate || null,
      amount_repaid: initialData?.amount_repaid || 0,
      status: 'active',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return calculateLoanDetails(mockLoan);
  }, [type, counterparty, principal, interestRate, interestPeriod, interestType, startDate, dueDate, initialData, currency]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!counterparty.trim()) {
      setError('Please provide who the loan is with (Person or Institution).');
      return;
    }
    const numPrincipal = Number(principal);
    if (!numPrincipal || numPrincipal <= 0) {
      setError('Principal amount must be greater than zero.');
      return;
    }

    onSave({
      type,
      counterparty: counterparty.trim(),
      principal: numPrincipal,
      currency: currency,
      interest_rate: Number(interestRate) || 0,
      interest_type: interestType,
      interest_period: interestPeriod,
      start_date: startDate,
      due_date: dueDate.trim() ? dueDate : null,
      amount_repaid: initialData?.amount_repaid || 0,
      status: initialData?.status || 'active',
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="serif text-2xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

      {error && (
        <div role="alert" className="mt-4 rounded-xl bg-[#f5e5df] px-4 py-3 text-sm text-[#914e40]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Loan Type Selector */}
        <div>
          <label className="mb-1.5 block text-xs font-bold">Direction of money</label>
          <div className="grid grid-cols-2 rounded-full bg-muted p-1">
            <button
              type="button"
              onClick={() => setType('lent')}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition ${
                type === 'lent'
                  ? 'bg-card text-[#3a6046] shadow-sm font-bold'
                  : 'text-muted-foreground'
              }`}
              data-testid="select-type-lent"
            >
              <ArrowDownLeft size={15} />
              Given (You Lent to them)
            </button>
            <button
              type="button"
              onClick={() => setType('borrowed')}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition ${
                type === 'borrowed'
                  ? 'bg-card text-[#8a492e] shadow-sm font-bold'
                  : 'text-muted-foreground'
              }`}
              data-testid="select-type-borrowed"
            >
              <ArrowUpRight size={15} />
              Received (You Borrowed)
            </button>
          </div>
        </div>

        {/* Counterparty & Principal */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold">
            {type === 'lent' ? 'Who did you lend to?' : 'Who did you borrow from?'}
            <input
              required
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="e.g. Ram Bahadur, Nabil Bank, Mama"
              className="field mt-1.5"
              data-testid="input-counterparty"
            />
          </label>

          <label className="block text-xs font-semibold">
            Principal Amount
            <div className="relative mt-1.5 flex items-center">
              <span className="pointer-events-none absolute left-4 text-sm font-semibold text-muted-foreground select-none">
                {symbol}
              </span>
              <input
                required
                type="number"
                min="1"
                step="any"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="50,000"
                className="field mono text-base"
                style={{ paddingLeft: '50px' }}
                data-testid="input-principal"
              />
            </div>
          </label>
        </div>

        {/* Interest Configuration */}
        <div className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Percent size={14} />
              Interest terms (ब्याजदर)
            </span>
            <span className="text-[10px] text-muted-foreground">
              Common in Nepal: 1%–2% / month (सय कडा १-२)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block text-[11px] font-semibold col-span-1">
              Rate (%)
              <input
                type="number"
                min="0"
                step="0.05"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="1.5"
                className="field mt-1"
                data-testid="input-interest-rate"
              />
            </label>

            <label className="block text-[11px] font-semibold col-span-1">
              Period
              <select
                value={interestPeriod}
                onChange={(e) => setInterestPeriod(e.target.value as InterestPeriod)}
                className="field mt-1"
                data-testid="select-interest-period"
              >
                <option value="monthly">Per Month (मासिक)</option>
                <option value="yearly">Per Year (वार्षिक)</option>
              </select>
            </label>

            <label className="block text-[11px] font-semibold col-span-1">
              Interest Type
              <select
                value={interestType}
                onChange={(e) => setInterestType(e.target.value as InterestType)}
                className="field mt-1"
                data-testid="select-interest-type"
              >
                <option value="simple">Simple (साधारण)</option>
                <option value="compound">Compound (चक्रीय)</option>
                <option value="none">0% (None)</option>
              </select>
            </label>
          </div>
        </div>

        {/* Start Date & Due Date */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold">
            Loan Date (ऋण लिएको/दिएको मिति)
            <input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="field mt-1.5"
              data-testid="input-start-date"
            />
          </label>

          <label className="block text-xs font-semibold">
            Due Date (तिर्नुपर्ने मिति - Optional)
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="field mt-1.5"
              data-testid="input-due-date"
            />
          </label>
        </div>

        {/* Notes */}
        <label className="block text-xs font-semibold">
          Notes or terms (Optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Loan for business expansion, cash given via eSewa"
            className="field mt-1.5"
            data-testid="input-notes"
          />
        </label>

        {/* Live Calculation Preview Banner */}
        {previewCalculation && (
          <div className="rounded-2xl bg-[#efe8d9] p-4 text-[#2d473b]">
            <div className="flex items-center justify-between text-xs font-bold text-[#355243]">
              <span>Real-time Interest Calculation</span>
              <span>
                {interestPeriod === 'monthly'
                  ? `${interestRate}% / mo (${previewCalculation.effectiveAnnualRate}%/yr)`
                  : `${interestRate}% / yr`}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground text-[10px]">Elapsed to date:</span>
                <p className="font-semibold">{previewCalculation.daysElapsed} days ({previewCalculation.monthsElapsed} mos)</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Accrued Interest:</span>
                <p className="mono font-semibold text-[#8b4e2f]">+{money(previewCalculation.accruedInterest)}</p>
              </div>
            </div>
            <div className="mt-2 border-t border-[#d8cdb8] pt-2 flex items-center justify-between">
              <span className="text-xs font-bold">Total Balance with Interest:</span>
              <span className="mono text-base font-bold text-[#203a2e]">
                {money(previewCalculation.totalPayableOrReceivable)}
              </span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-border py-3 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            data-testid="button-save-loan"
          >
            {busy ? 'Saving…' : 'Save loan record'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// -------------------------------------------------------------
// Record Payment Modal
// -------------------------------------------------------------
function RecordPaymentModal({
  loan,
  busy,
  onClose,
  onSave,
}: {
  loan: LoanRow;
  busy: boolean;
  onClose: () => void;
  onSave: (
    payment: {
      loan_id: string;
      amount: number;
      payment_date: string;
      payment_type: 'principal' | 'interest' | 'both';
      notes: string | null;
    },
    syncToTransactions: boolean,
    split: { interestAmount: number; principalAmount: number; interestCategoryId: string | null },
  ) => void;
}) {
  const { symbol, formatMoney: money } = useCurrency();
  const calc = calculateLoanDetails(loan);
  const paymentsQuery = useLoanPayments(loan.id, true);
  const categoriesQuery = useCategories(undefined, true);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [interestInput, setInterestInput] = useState<string | null>(null);
  const [principalInput, setPrincipalInput] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [syncToTransactions, setSyncToTransactions] = useState(true);
  const [error, setError] = useState('');

  const isLent = loan.type === 'lent';
  const num = Number(amount) || 0;
  const auto = splitPayment(loan, paymentsQuery.data ?? [], num);
  const interest = interestInput !== null ? Number(interestInput) || 0 : auto.interestPart;
  const principal = principalInput !== null ? Number(principalInput) || 0 : auto.principalPart;
  const splitTotal = Math.round((interest + principal) * 100) / 100;
  const splitValid = num > 0 && splitTotal === Math.round(num * 100) / 100;

  const resetSplit = () => {
    setInterestInput(null);
    setPrincipalInput(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!num || num <= 0) {
      setError('Please enter a payment amount greater than zero.');
      return;
    }
    if (!splitValid) {
      setError(`Interest + principal must add up to ${money(num)}.`);
      return;
    }
    const interestCat = matchCategoryName(
      'interest',
      isLent ? 'income' : 'expense',
      categoriesQuery.data ?? [],
    );

    onSave(
      {
        loan_id: loan.id,
        amount: num,
        payment_date: date,
        payment_type: interest > 0 && principal > 0 ? 'both' : interest > 0 ? 'interest' : 'principal',
        notes: notes.trim() || null,
      },
      syncToTransactions,
      { interestAmount: interest, principalAmount: principal, interestCategoryId: interestCat?.id ?? null },
    );
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="serif text-2xl font-bold">Record Repayment</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {isLent
          ? `Money received back from ${loan.counterparty}.`
          : `Money paid back to ${loan.counterparty}.`}
      </p>

      <div className="mt-4 rounded-2xl bg-muted/40 p-3.5 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Balance Due (with interest):</span>
          <span className="mono font-bold">{money(calc.netRemainingBalance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Accrued Interest so far:</span>
          <span className="mono text-[#98583b]">+{money(calc.accruedInterest)}</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-[#f5e5df] px-4 py-2 text-sm text-[#914e40]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block text-xs font-semibold">
          Repayment Amount
          <div className="relative mt-1.5 flex items-center">
            <span className="pointer-events-none absolute left-4 text-sm font-semibold text-muted-foreground select-none">
              {symbol}
            </span>
            <input
              required
              autoFocus
              type="number"
              min="0.01"
              step="any"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); resetSplit(); }}
              placeholder={String(calc.netRemainingBalance)}
              className="field mono text-lg"
              style={{ paddingLeft: '50px' }}
              data-testid="input-payment-amount"
            />
          </div>
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold">Interest-first split</span>
            <span className="text-[10px] text-muted-foreground">Interest due: {money(auto.interestDue)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold">
              Interest {isLent ? '(→ income)' : '(→ expense)'}
              <input
                type="number"
                min="0"
                step="any"
                value={interestInput ?? auto.interestPart}
                onChange={(e) => setInterestInput(e.target.value)}
                className="field mono mt-1.5"
                data-testid="input-payment-interest"
              />
            </label>
            <label className="block text-xs font-semibold">
              Principal (→ loan only)
              <input
                type="number"
                min="0"
                step="any"
                value={principalInput ?? auto.principalPart}
                onChange={(e) => setPrincipalInput(e.target.value)}
                className="field mono mt-1.5"
                data-testid="input-payment-principal"
              />
            </label>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            Interest settles first automatically — adjust if needed. Only the interest part can go to
            income/expenses; principal only shrinks the loan.
          </p>
          {num > 0 && !splitValid && (
            <p className="mt-1 text-[11px] font-semibold text-[#8a6a2f]" role="alert">
              Split is {money(splitTotal)} — must equal {money(num)}.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold">
            Date
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field mt-1.5"
            />
          </label>

          <label className="block text-xs font-semibold">
            Notes
            <input
              value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Installment via mobile banking, cash, cheque..."
            className="field mt-1.5"
          />
        </label>
        </div>

        <label className="flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-xs text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={syncToTransactions}
            onChange={(e) => setSyncToTransactions(e.target.checked)}
            className="rounded border-border text-primary"
          />
          <span>
            Also record the interest part ({money(interest)}) as an{' '}
            <strong>{isLent ? 'Income' : 'Expense'}</strong> note in Transactions
            {principal > 0 && (
              <> — principal ({money(principal)}) stays loan-only</>
            )}
          </span>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-border py-3 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !splitValid || paymentsQuery.isLoading}
            className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            data-testid="button-confirm-payment"
          >
            {busy ? 'Recording…' : 'Record repayment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// -------------------------------------------------------------
// Generic Modal Wrappers
// -------------------------------------------------------------
function ConfirmDeleteModal({
  title,
  message,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <h2 className="serif text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-6 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-full border border-border py-3 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 rounded-full bg-destructive py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
          data-testid="button-confirm-delete-loan"
        >
          {busy ? 'Deleting…' : 'Delete loan'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#17251f]/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92dvh] w-full max-w-[540px] overflow-y-auto rounded-t-[28px] border border-border bg-background p-6 shadow-2xl sm:rounded-[28px]">
        <div className="mb-3 flex justify-end">
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
