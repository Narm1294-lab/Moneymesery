import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowDownLeft, ArrowUpRight, HandCoins, LoaderCircle, Plus, Scale, Trash2, Wallet, X } from "lucide-react";

import type { AccountKind, AccountOpeningInput } from "@/lib/database.types";
import { useAccountOpenings, useSaveAccountOpenings } from "@/hooks/useFinance";

import type { MoneyPosition } from "@/lib/money-position";
import { useCurrency } from "@/hooks/useCurrency";

function Tile({
  icon,
  label,
  value,
  meaning,
  testId,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  meaning: string;
  testId: string;
  tone: "in" | "out" | "neutral";
}) {
  const color =
    tone === "in" ? "bg-[#e4eee2] text-[#557c60]" : tone === "out" ? "bg-[#f4e8dc] text-[#a27653]" : "bg-[#e9e1d1] text-[#4c6558]";
  return (
    <div className="rounded-[18px] border border-border bg-card p-4" data-testid={testId}>
      <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
        <span className={`grid h-7 w-7 place-items-center rounded-[10px] ${color}`}>{icon}</span>
        {label}
      </div>
      <p className="mono mt-2 text-xl font-semibold tracking-[-.03em]">{value}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{meaning}</p>
    </div>
  );
}

/**
 * Teaches the three money views side by side:
 * income/expenses (performance), cash flow + on hand (liquidity),
 * to receive / to pay (obligations).
 */
export function MoneyIntel({
  position,
  loading,
  monthLabel,
}: {
  position: MoneyPosition | null;
  loading: boolean;
  monthLabel: string;
}) {
  const { formatMoney: money } = useCurrency();
  const [editingStart, setEditingStart] = useState(false);
  if (loading) {
    return (
      <section className="mb-7 rounded-[28px] border border-border bg-card p-6 soft-shadow" data-testid="money-intel">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[18px] bg-muted" />
          ))}
        </div>
      </section>
    );
  }
  if (!position) return null;
  const p = position;
  return (
    <section className="mb-7 overflow-hidden rounded-[28px] border border-border bg-card p-6 soft-shadow sm:p-7" data-testid="money-intel">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7455]">Know your money</p>
      <h2 className="serif mt-1.5 text-[24px] tracking-[-.02em]">Income is not cash in hand</h2>
      <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
        Earning and spending measure performance. Cash flow measures what actually moved. Loans measure
        promises. All three, at a glance.
      </p>

      <div className="mt-4 rounded-[20px] bg-[#203d35] p-5 text-[#f7f1e6] sm:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] text-white/60">
              <Wallet size={13} /> Cash on hand (estimated)
            </p>
            <p className="mono mt-1 text-[34px] font-medium tracking-[-.05em] sm:text-[40px]" data-testid="text-cash-on-hand">
              {money(p.cashOnHand)}
            </p>
            <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-white/55">
              Started with {money(p.openingsTotal)} across cash, bank and wallets — plus everything in,
              minus everything out, ever.
            </p>
            <button
              onClick={() => setEditingStart(true)}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[11px] font-bold text-[#f4d3aa] transition hover:bg-white/15"
              data-testid="button-starting-money"
            >
              <Wallet size={13} /> {p.openingsTotal > 0 ? "Edit starting money" : "Set starting money"}
            </button>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] text-white/60">{monthLabel} net cash</p>
            <p className={`mono mt-1 text-2xl font-medium ${p.cashNetMonth >= 0 ? "text-[#c6e4c3]" : "text-[#f5beaa]"}`} data-testid="text-cash-net-month">
              {p.cashNetMonth >= 0 ? "+" : "−"}{money(Math.abs(p.cashNetMonth))}
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              In {money(p.cashInMonth)} · Out {money(p.cashOutMonth)}
            </p>
          </div>
        </div>
      </div>

      {editingStart && <StartingBalancesEditor onClose={() => setEditingStart(false)} />}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Tile
          icon={<ArrowDownLeft size={15} />}
          label={`Cash in · ${monthLabel}`}
          value={money(p.cashInMonth)}
          meaning="Arrived this month: income + loans taken + repayments received. More than income alone."
          testId="tile-cash-in"
          tone="in"
        />
        <Tile
          icon={<ArrowUpRight size={15} />}
          label={`Cash out · ${monthLabel}`}
          value={money(p.cashOutMonth)}
          meaning="Left this month: spending + loans given + repayments paid. Giving a loan is not spending."
          testId="tile-cash-out"
          tone="out"
        />
        <Tile
          icon={<HandCoins size={15} />}
          label="To receive"
          value={money(p.toReceive)}
          meaning={`Others owe you across ${p.activeLoanCount} open loan${p.activeLoanCount === 1 ? "" : "s"}, with interest. Not income until it arrives.`}
          testId="tile-to-receive"
          tone="neutral"
        />
        <Tile
          icon={<Scale size={15} />}
          label="To pay"
          value={money(p.toPay)}
          meaning="You owe others, with interest. Not spending until you actually pay."
          testId="tile-to-pay"
          tone="neutral"
        />
      </div>

      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Lifetime: earned {money(p.incomeLifetime)} · spent {money(p.expensesLifetime)} · surplus{" "}
        {money(p.surplusLifetime)}. Surplus says how you performed; cash on hand says what you hold.{" "}
        <Link href="/loans" className="font-bold text-primary underline-offset-2 hover:underline">
          Review loans →
        </Link>
      </p>
    </section>
  );
}

interface OpeningDraft {
  key: string;
  name: string;
  kind: AccountKind;
  amount: string;
}

const KIND_LABELS: Record<AccountKind, string> = { cash: "Cash in hand", bank: "Bank", wallet: "Wallet" };

function StartingBalancesEditor({ onClose }: { onClose: () => void }) {
  const openingsQuery = useAccountOpenings(true);
  const save = useSaveAccountOpenings();
  const [rows, setRows] = useState<OpeningDraft[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!openingsQuery.isLoading && rows === null) {
      const existing = openingsQuery.data ?? [];
      setRows(
        existing.length > 0
          ? existing.map((r) => ({ key: r.id, name: r.name, kind: r.kind, amount: String(r.amount) }))
          : [
              { key: "cash", name: "Cash in hand", kind: "cash" as AccountKind, amount: "" },
              { key: "bank", name: "Bank", kind: "bank" as AccountKind, amount: "" },
              { key: "wallet", name: "Wallet", kind: "wallet" as AccountKind, amount: "" },
            ],
      );
    }
  }, [openingsQuery.isLoading, openingsQuery.data, rows]);

  const setRow = (key: string, patch: Partial<OpeningDraft>) =>
    setRows((prev) => (prev ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [
      ...(prev ?? []),
      { key: `new-${Date.now()}`, name: "", kind: "wallet" as AccountKind, amount: "" },
    ]);

  const submit = () => {
    setError("");
    const payload: AccountOpeningInput[] = (rows ?? [])
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name.trim(), kind: r.kind, amount: Math.max(0, Number(r.amount) || 0) }));
    save.mutate(payload, {
      onSuccess: onClose,
      onError: (e) => setError(e instanceof Error ? e.message : "Could not save starting balances."),
    });
  };

  return (
    <div className="mt-3 rounded-[20px] border border-border bg-muted/40 p-4 sm:p-5" data-testid="starting-money-editor">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="serif text-xl">Starting money</h3>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted-foreground hover:bg-muted" data-testid="button-close-openings">
          <X size={18} />
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        What did you hold when you started? Cash in hand, bank, wallets — everything begins here.
        </p>

        {openingsQuery.isLoading || rows === null ? (
          <div className="mt-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-2" data-testid="row-opening">
                <select
                  value={r.kind}
                  onChange={(e) => setRow(r.key, { kind: e.target.value as AccountKind, name: r.name || KIND_LABELS[e.target.value as AccountKind] })}
                  className="field max-w-[128px] shrink-0"
                  aria-label="Account type"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="wallet">Wallet</option>
                </select>
                <input
                  value={r.name}
                  onChange={(e) => setRow(r.key, { name: e.target.value })}
                  placeholder="e.g. eSewa wallet"
                  className="field min-w-0 flex-1"
                  aria-label="Account name"
                  data-testid="input-opening-name"
                />
                <div className="relative w-[130px] shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">
                    Rs
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={r.amount}
                    onChange={(e) => setRow(r.key, { amount: e.target.value })}
                    placeholder="0"
                    className="field mono text-sm"
                    style={{ paddingLeft: "34px" }}
                    aria-label="Starting amount"
                    data-testid="input-opening-amount"
                  />
                </div>
                <button
                  onClick={() => setRows((prev) => (prev ?? []).filter((x) => x.key !== r.key))}
                  aria-label={`Remove ${r.name || "row"}`}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-[#f5e1dc] hover:text-destructive"
                  data-testid="button-remove-opening"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"
              data-testid="button-add-opening"
            >
              <Plus size={14} /> Add bank / wallet
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-[#f5e5df] px-4 py-2.5 text-[12px] text-[#914e40]" role="alert">
            {error}
          </p>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          Starting money is the foundation of “cash on hand” — it is not income and never appears in
          earnings or spending.
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold" data-testid="button-cancel-openings">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={save.isPending || openingsQuery.isLoading}
            className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            data-testid="button-save-openings"
          >
            {save.isPending ? "Saving…" : "Save starting money"}
          </button>
        </div>
    </div>
  );
}
