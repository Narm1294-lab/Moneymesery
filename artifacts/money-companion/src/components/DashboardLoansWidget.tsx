import { useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, HandCoins, Plus, Sparkles, Wallet } from 'lucide-react';
import { useLoans } from '@/hooks/useFinance';
import { calculateLoanDetails } from '@/lib/loanUtils';
import { useCurrency } from '@/hooks/useCurrency';

export function DashboardLoansWidget() {
  const { formatMoney: money } = useCurrency();
  const loansQuery = useLoans();
  const loans = loansQuery.data ?? [];

  const metrics = useMemo(() => {
    let lentTotal = 0;
    let borrowedTotal = 0;
    let lentInterest = 0;
    let borrowedInterest = 0;
    let activeCount = 0;

    for (const l of loans) {
      if (l.status !== 'active') continue;
      activeCount++;
      const calc = calculateLoanDetails(l);
      if (l.type === 'lent') {
        lentTotal += calc.netRemainingBalance;
        lentInterest += calc.accruedInterest;
      } else {
        borrowedTotal += calc.netRemainingBalance;
        borrowedInterest += calc.accruedInterest;
      }
    }

    return {
      lentTotal,
      borrowedTotal,
      lentInterest,
      borrowedInterest,
      activeCount,
      netPosition: lentTotal - borrowedTotal,
    };
  }, [loans]);

  if (loansQuery.isLoading) {
    return <div className="mb-7 h-28 animate-pulse rounded-[24px] bg-muted/60" />;
  }

  return (
    <section className="mb-7 overflow-hidden rounded-[26px] border border-border bg-card p-5 soft-shadow sm:p-6" data-testid="widget-loans-overview">
      <div className="flex items-center justify-between border-b border-border/70 pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#29473d]/10 text-[#29473d]">
            <HandCoins size={16} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
              Credit &amp; Lending
            </p>
            <h3 className="serif text-xl tracking-tight text-foreground font-semibold">
              Loans &amp; Debt Status
            </h3>
          </div>
        </div>

        <Link
          href="/loans"
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:gap-2 transition-all"
          data-testid="link-view-all-loans"
        >
          Manage loans <ArrowRight size={14} />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {/* Money Given (Lent) */}
        <div className="rounded-[18px] border border-[#d9c5ab]/70 bg-[#fdfbf7] p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#44634f]">
              <ArrowDownLeft size={15} />
              Given (To Receive)
            </span>
            <span className="text-[10px] text-muted-foreground">Incl. interest</span>
          </div>
          <p className="mono mt-2 text-xl font-bold text-[#2d4d40]">
            {money(metrics.lentTotal)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Accrued interest: +{money(metrics.lentInterest)}
          </p>
        </div>

        {/* Money Received (Borrowed) */}
        <div className="rounded-[18px] border border-[#e4cbbf]/70 bg-[#fffaf8] p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#98583b]">
              <ArrowUpRight size={15} />
              Received (To Pay)
            </span>
            <span className="text-[10px] text-muted-foreground">Incl. interest</span>
          </div>
          <p className="mono mt-2 text-xl font-bold text-[#84452a]">
            {money(metrics.borrowedTotal)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Accrued interest: +{money(metrics.borrowedInterest)}
          </p>
        </div>

        {/* Net Status */}
        <div className="rounded-[18px] border border-border bg-[#213e36] p-3.5 text-[#f7f2e8]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
              <Wallet size={14} />
              Net Balance
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
              {metrics.activeCount} active
            </span>
          </div>
          <p
            className={`mono mt-2 text-xl font-bold ${
              metrics.netPosition >= 0 ? 'text-[#c6e4c3]' : 'text-[#f5beaa]'
            }`}
          >
            {metrics.netPosition >= 0 ? '+' : '−'}
            {money(Math.abs(metrics.netPosition))}
          </p>
          <p className="mt-0.5 text-[10px] text-white/60">
            {metrics.netPosition >= 0
              ? 'You have a positive lending balance.'
              : 'You have a net borrowing balance.'}
          </p>
        </div>
      </div>
    </section>
  );
}
