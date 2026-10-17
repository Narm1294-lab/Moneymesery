import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  Clapperboard,
  Flame,
  Gift,
  HeartPulse,
  Home,
  Laptop,
  Layers,
  MapPin,
  Receipt,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  TrendingDown,
  TrendingUp,
  User,
  Utensils,
} from 'lucide-react';
import { useAllTransactions } from '@/hooks/useFinance';
import { useCurrency } from '@/hooks/useCurrency';
import type { CategoryRow, TransactionRow, TransactionType } from '@/lib/database.types';

export type TimeframeOption = 'this_month' | 'last_30_days' | 'this_year' | 'all_time';
type AnalysisView = 'categories' | 'merchants' | 'big_amounts';

const dateLabel = (date: string) => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: tz,
  }).format(new Date(date));
};

function getTimeframeStartDate(tf: TimeframeOption): string | undefined {
  const now = new Date();
  if (tf === 'this_month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  if (tf === 'last_30_days') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (tf === 'this_year') {
    return new Date(now.getFullYear(), 0, 1).toISOString();
  }
  return undefined;
}

const timeframeLabels: Record<TimeframeOption, string> = {
  this_month: 'This Month',
  last_30_days: 'Last 30 Days',
  this_year: 'This Year',
  all_time: 'All Time',
};

function getCategoryIcon(name: string) {
  const n = (name || '').toLowerCase();
  if (n.includes('food') || n.includes('lunch') || n.includes('tea') || n.includes('dinner')) return <Utensils size={15}/>;
  if (n.includes('transport') || n.includes('bus') || n.includes('taxi')) return <Bus size={15}/>;
  if (n.includes('house') || n.includes('rent') || n.includes('housing')) return <Home size={15}/>;
  if (n.includes('bill') || n.includes('receipt') || n.includes('utility')) return <Receipt size={15}/>;
  if (n.includes('salary') || n.includes('pay') || n.includes('job')) return <Briefcase size={15}/>;
  if (n.includes('shop') || n.includes('store')) return <ShoppingBag size={15}/>;
  if (n.includes('health') || n.includes('med')) return <HeartPulse size={15}/>;
  if (n.includes('freelance') || n.includes('client')) return <Laptop size={15}/>;
  if (n.includes('entertain') || n.includes('movie')) return <Clapperboard size={15}/>;
  if (n.includes('gift')) return <Gift size={15}/>;
  return <Tag size={15}/>;
}

const colorPalette = [
  'bg-[#2d4d42]',
  'bg-[#c87e53]',
  'bg-[#4c7062]',
  'bg-[#df9f72]',
  'bg-[#698a7a]',
  'bg-[#b26943]',
  'bg-[#8aa799]',
  'bg-[#e2b58d]',
];

export function FinanceAnalysis({ categories }: { categories: CategoryRow[] }) {
  const { formatMoney: money, symbol } = useCurrency();
  const [timeframe, setTimeframe] = useState<TimeframeOption>('this_month');
  const [type, setType] = useState<TransactionType>('expense');
  const [activeView, setActiveView] = useState<AnalysisView>('categories');

  const startDate = useMemo(() => getTimeframeStartDate(timeframe), [timeframe]);
  const transactionsQuery = useAllTransactions(startDate);
  const rawTransactions = transactionsQuery.data ?? [];

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  // Filter transactions by selected type (income vs expense)
  const currentTransactions = useMemo(
    () => rawTransactions.filter((t) => t.type === type),
    [rawTransactions, type],
  );

  const totalAmount = useMemo(
    () => currentTransactions.reduce((acc, t) => acc + Number(t.amount), 0),
    [currentTransactions],
  );

  // 1. Categories Breakdown
  const categoryStats = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; count: number }>();
    for (const t of currentTransactions) {
      const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
      const catId = cat?.id || 'uncategorized';
      const catName = cat?.name || 'Uncategorised';
      const existing = map.get(catId) || { id: catId, name: catName, total: 0, count: 0 };
      existing.total += Number(t.amount);
      existing.count += 1;
      map.set(catId, existing);
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: totalAmount > 0 ? (item.total / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [currentTransactions, categoryMap, totalAmount]);

  // 2. Where / Who (Merchant / Payee Breakdown)
  const merchantStats = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const t of currentTransactions) {
      const name = t.merchant?.trim() || 'Direct / Unspecified';
      const existing = map.get(name) || { name, total: 0, count: 0 };
      existing.total += Number(t.amount);
      existing.count += 1;
      map.set(name, existing);
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        avg: item.count > 0 ? item.total / item.count : item.total,
        percentage: totalAmount > 0 ? (item.total / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [currentTransactions, totalAmount]);

  // 3. Big Amounts (Largest single transactions)
  const bigTransactions = useMemo(() => {
    return [...currentTransactions]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 8)
      .map((t, idx) => ({
        ...t,
        rank: idx + 1,
        percentage: totalAmount > 0 ? (Number(t.amount) / totalAmount) * 100 : 0,
        categoryName: t.category_id ? categoryMap.get(t.category_id)?.name : undefined,
      }));
  }, [currentTransactions, categoryMap, totalAmount]);

  const topCategory = categoryStats[0];
  const topMerchant = merchantStats[0];
  const largestTransaction = bigTransactions[0];

  return (
    <section className="mb-9 overflow-hidden rounded-[26px] border border-border bg-card p-5 soft-shadow sm:p-7" data-testid="section-finance-analysis">
      {/* Header and Controls */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#29473d]/10 text-[#29473d]">
              <Sparkles size={14} />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7455]">
              Insights & Breakdown
            </p>
          </div>
          <h2 className="serif mt-1 text-[26px] tracking-[-.025em]">
            Where your money travels
          </h2>
        </div>

        {/* Timeframe & Type Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex rounded-full border border-border bg-muted/60 p-1" aria-label="Select timeframe">
            {(['this_month', 'last_30_days', 'this_year', 'all_time'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  timeframe === tf
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`timeframe-${tf}`}
              >
                {timeframeLabels[tf]}
              </button>
            ))}
          </div>

          {/* Type Switcher */}
          <div className="flex rounded-full border border-border bg-muted/60 p-1">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                  type === t
                    ? t === 'income'
                      ? 'bg-[#e4eee2] text-[#446b4e] shadow-sm'
                      : 'bg-[#f4e8dc] text-[#925f38] shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`analysis-type-${t}`}
              >
                {t === 'income' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                {t === 'expense' ? 'Expenses' : 'Income'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Summary Highlights Strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[16px] border border-border/80 bg-muted/30 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Total {type === 'expense' ? 'Spent' : 'Received'}
          </p>
          <p className="mono mt-1 text-xl font-semibold text-foreground">
            {money(totalAmount)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {currentTransactions.length} {currentTransactions.length === 1 ? 'note' : 'notes'} in {timeframeLabels[timeframe].toLowerCase()}
          </p>
        </div>

        <div className="rounded-[16px] border border-border/80 bg-muted/30 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Top Category
          </p>
          <p className="truncate text-base font-semibold text-foreground">
            {topCategory ? topCategory.name : '—'}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {topCategory ? `${money(topCategory.total)} (${topCategory.percentage.toFixed(0)}%)` : 'No data'}
          </p>
        </div>

        <div className="rounded-[16px] border border-border/80 bg-muted/30 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Top Where / Who
          </p>
          <p className="truncate text-base font-semibold text-foreground">
            {topMerchant ? topMerchant.name : '—'}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {topMerchant ? `${money(topMerchant.total)} (${topMerchant.count} visits)` : 'No data'}
          </p>
        </div>

        <div className="rounded-[16px] border border-border/80 bg-muted/30 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Biggest Note
          </p>
          <p className="mono mt-1 text-base font-semibold text-[#a06842]">
            {largestTransaction ? money(Number(largestTransaction.amount)) : '—'}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {largestTransaction ? largestTransaction.description || largestTransaction.merchant || 'Single largest note' : 'No notes'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs for Views */}
      <div className="mt-6 flex border-b border-border/80 gap-2">
        <button
          onClick={() => setActiveView('categories')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeView === 'categories'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-analysis-categories"
        >
          <Layers size={14} />
          Categories Wise
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {categoryStats.length}
          </span>
        </button>

        <button
          onClick={() => setActiveView('merchants')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeView === 'merchants'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-analysis-merchants"
        >
          <Store size={14} />
          Where / Who Wise
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {merchantStats.length}
          </span>
        </button>

        <button
          onClick={() => setActiveView('big_amounts')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
            activeView === 'big_amounts'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-analysis-big-amounts"
        >
          <Flame size={14} />
          Big Amounts
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {bigTransactions.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="mt-5">
        {transactionsQuery.isLoading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : currentTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Calendar size={20} />
            </div>
            <p className="serif text-lg">No {type === 'expense' ? 'expenses' : 'income'} recorded</p>
            <p className="mt-1 text-xs text-muted-foreground">
              There are no {type} transactions for {timeframeLabels[timeframe].toLowerCase()}.
            </p>
          </div>
        ) : (
          <>
            {/* 1. Categories Wise View */}
            {activeView === 'categories' && (
              <div className="space-y-3.5">
                {categoryStats.map((cat, idx) => {
                  const color = colorPalette[idx % colorPalette.length];
                  return (
                    <div
                      key={cat.id}
                      className="group rounded-2xl border border-border/70 bg-card p-3.5 transition hover:border-border hover:shadow-xs"
                      data-testid={`row-cat-analysis-${cat.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${color} text-white`}
                          >
                            {getCategoryIcon(cat.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {cat.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {cat.count} {cat.count === 1 ? 'note' : 'notes'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="mono text-sm font-bold text-foreground">
                            {money(cat.total)}
                          </p>
                          <span className="inline-block rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {cat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Percentage Bar */}
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/80">
                        <div
                          className={`h-full rounded-full ${color} transition-all duration-500`}
                          style={{ width: `${Math.max(cat.percentage, 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Where / Who Wise View */}
            {activeView === 'merchants' && (
              <div className="space-y-3">
                {merchantStats.map((m, idx) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-3.5 transition hover:border-border hover:shadow-xs"
                    data-testid={`row-merchant-analysis-${idx}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eee5d6] text-[#4f6758]">
                        {m.name === 'Direct / Unspecified' ? (
                          <User size={16} />
                        ) : (
                          <Building2 size={16} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {m.name}
                          </p>
                          {idx === 0 && (
                            <span className="rounded-full bg-[#ebd3b9] px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider text-[#794f2d]">
                              Top place
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {m.count} {m.count === 1 ? 'note' : 'visits'} · Avg: {money(m.avg)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="mono text-sm font-bold text-foreground">
                        {money(m.total)}
                      </p>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {m.percentage.toFixed(1)}% of total
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Big Amounts View */}
            {activeView === 'big_amounts' && (
              <div className="space-y-3">
                <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Top largest transactions in {timeframeLabels[timeframe].toLowerCase()}</span>
                  <span>Ranked by amount</span>
                </div>
                {bigTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-3.5 transition hover:border-border hover:shadow-xs"
                    data-testid={`row-big-transaction-${t.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                          t.rank === 1
                            ? 'bg-[#c87e53] text-white shadow-xs'
                            : t.rank === 2
                            ? 'bg-[#29473d] text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        #{t.rank}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {t.description || t.categoryName || (t.type === 'income' ? 'Income' : 'Expense')}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {t.merchant || 'Direct'} <span className="mx-1 text-border">·</span>
                          {t.categoryName || 'Uncategorised'} <span className="mx-1 text-border">·</span>
                          {dateLabel(t.transaction_date)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`mono text-base font-bold ${type === 'income' ? 'text-[#4e7958]' : 'text-[#a26842]'}`}>
                        {type === 'income' ? '+' : '−'}{money(Number(t.amount), t.currency)}
                      </p>
                      <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                        {t.percentage.toFixed(1)}% of {type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
