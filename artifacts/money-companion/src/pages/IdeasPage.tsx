import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Lightbulb, Plus, Trash2, X } from "lucide-react";

import type { IdeaInput, IdeaKind, IdeaRow, IdeaStatus } from "@/lib/database.types";
import {
  useAccountOpenings,
  useAllLoanPayments,
  useAllTransactions,
  useDeleteIdea,
  useIdeas,
  useLoans,
  useSaveIdea,
  useUpdateIdea,
} from "@/hooks/useFinance";
import { analyzeFeasibility, buildFinancialBase, type FeasibilityVerdict, type FinancialBase } from "@/lib/feasibility";
import { IdeaReport } from "@/components/idea-report";

const money0 = (n: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(n);

const KIND_LABELS: Record<IdeaKind, string> = {
  business: "Business",
  vehicle: "Vehicle",
  equipment: "Equipment",
  education: "Education",
  land: "Land / plot",
  other: "Other",
};

const IDEA_KINDS: IdeaKind[] = ["business", "vehicle", "equipment", "education", "land", "other"];

function useFeasibilityBase(enabled: boolean): { base: FinancialBase | null; loading: boolean } {
  const tx = useAllTransactions(undefined, enabled);
  const loans = useLoans(enabled);
  const pays = useAllLoanPayments(enabled);
  const openings = useAccountOpenings(enabled);
  const monthStart = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date()).slice(0, 7) + "-01";
  const base = useMemo(() => {
    if (!tx.data) return null;
    const openingsTotal = (openings.data ?? []).reduce((s, o) => s + (Number(o.amount) || 0), 0);
    return buildFinancialBase(tx.data, loans.data ?? [], pays.data ?? [], openingsTotal, monthStart);
  }, [tx.data, loans.data, pays.data, openings.data, monthStart]);
  return { base, loading: tx.isLoading || loans.isLoading || pays.isLoading || openings.isLoading };
}

export function IdeasPage() {
  const ideasQuery = useIdeas(true);
  const { base, loading: baseLoading } = useFeasibilityBase(true);
  const updateIdea = useUpdateIdea();
  const deleteIdea = useDeleteIdea();
  const [filter, setFilter] = useState<"open" | "started" | "dropped" | "all">("open");
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState<IdeaRow | null>(null);
  const [notice, setNotice] = useState("");

  const ideas = ideasQuery.data ?? [];
  const counts = useMemo(
    () => ({
      open: ideas.filter((i) => i.status === "open").length,
      started: ideas.filter((i) => i.status === "started").length,
      dropped: ideas.filter((i) => i.status === "dropped").length,
    }),
    [ideas],
  );
  const visible = filter === "all" ? ideas : ideas.filter((i) => i.status === filter);

  const setStatus = (idea: IdeaRow, status: IdeaStatus) => {
    updateIdea.mutate(
      { id: idea.id, values: { status } },
      {
        onSuccess: () => setNotice(`“${idea.title}” marked as ${status}.`),
        onError: (e) => setNotice(e instanceof Error ? e.message : "Could not update the idea."),
      },
    );
  };

  return (
    <div className="page-enter mx-auto max-w-[860px]">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground" data-testid="link-back-home">
        <ArrowLeft size={15} /> Back home
      </Link>
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7455]">Can I do this?</p>
          <h1 className="serif text-[38px] leading-[1.06] tracking-[-.035em] text-foreground sm:text-[46px]">Ideas, honestly tested</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Describe a big idea once. The app checks it against your real income, cash, and loans —
            and tells you Ready, Wait, Needs a loan, or Not advisable, with the reason.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5"
          data-testid="button-new-idea"
        >
          <Plus size={17} /> New idea
        </button>
      </div>

      <div className="mb-5 flex rounded-full border border-border bg-card p-1" aria-label="Filter ideas">
        {(["open", "started", "dropped", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold capitalize transition ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid={`filter-ideas-${f}`}
          >
            {f === "all" ? `All (${ideas.length})` : `${f} (${counts[f]})`}
          </button>
        ))}
      </div>

      {notice && (
        <div role="status" className="mb-4 flex items-center justify-between rounded-xl bg-[#e6eee3] px-4 py-3 text-sm text-[#466548]" data-testid="status-idea-notice">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss" data-testid="dismiss-idea-notice"><X size={16} /></button>
        </div>
      )}

      {ideasQuery.isLoading || baseLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-[22px] bg-muted" />
          ))}
        </div>
      ) : ideasQuery.isError ? (
        <div className="rounded-[22px] border border-border bg-card p-8 text-center">
          <p className="font-semibold">Ideas could not load</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and refresh.</p>
          <button onClick={() => void ideasQuery.refetch()} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" data-testid="button-retry-ideas">
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[23px] border border-border bg-card px-5 py-14 text-center soft-shadow">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#e9e1d1] text-[#4c6558]">
            <Lightbulb size={21} />
          </div>
          <h2 className="serif text-xl">{filter === "open" ? "No open ideas yet" : `Nothing ${filter}`}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "open"
              ? "Dream a little — a shop, a bike, a course — then let your numbers judge it kindly."
              : "Ideas with this status will appear here."}
          </p>
          {filter === "open" && (
            <button onClick={() => setShowNew(true)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground" data-testid="empty-ideas-add">
              <Plus size={15} /> Test your first idea
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {visible.map((idea) => (
            <article key={idea.id} className="overflow-hidden rounded-[26px] border border-border bg-card soft-shadow" data-testid={`idea-${idea.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#e6eee3] text-[#4b684d]">
                    <Lightbulb size={17} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-bold">{idea.title}</h2>
                    <p className="text-[11px] text-muted-foreground">
                      {KIND_LABELS[idea.kind] ?? "Other"} · upfront {money0(Number(idea.one_time_cost))}
                      {Number(idea.monthly_cost) > 0 && ` · ${money0(Number(idea.monthly_cost))}/mo running`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {idea.status === "open" && (
                    <>
                      <button onClick={() => setStatus(idea, "started")} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-bold hover:text-primary" data-testid={`button-idea-start-${idea.id}`}>
                        Mark started
                      </button>
                      <button onClick={() => setStatus(idea, "dropped")} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground" data-testid={`button-idea-drop-${idea.id}`}>
                        Drop
                      </button>
                    </>
                  )}
                  {idea.status !== "open" && (
                    <button onClick={() => setStatus(idea, "open")} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-bold hover:text-primary" data-testid={`button-idea-reopen-${idea.id}`}>
                      Reopen
                    </button>
                  )}
                  <button onClick={() => setDeleting(idea)} aria-label={`Delete ${idea.title}`} className="rounded-lg p-2 text-muted-foreground hover:bg-[#f5e1dc] hover:text-destructive" data-testid={`button-idea-delete-${idea.id}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                {base ? (
                  <IdeaReport
                    title={idea.title}
                    idea={{
                      one_time_cost: Number(idea.one_time_cost),
                      monthly_cost: Number(idea.monthly_cost),
                      expected_monthly_return: Number(idea.expected_monthly_return),
                      return_starts_in_months: Number(idea.return_starts_in_months),
                    }}
                    base={base}
                  />
                ) : (
                  <p className="rounded-xl bg-muted/60 px-4 py-3 text-[12px] text-muted-foreground">
                    Needs your transaction history to judge — record some income and expenses first.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showNew && (
        <IdeaFormModal
          onClose={() => setShowNew(false)}
          onSaved={(title) => {
            setShowNew(false);
            setFilter("open");
            setNotice(`“${title}” saved — verdict ready below.`);
          }}
        />
      )}
      {deleting && (
        <ConfirmBox
          title="Drop this idea?"
          message={`“${deleting.title}” and its analysis will be removed.`}
          busy={deleteIdea.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            deleteIdea.mutate(deleting.id, {
              onSuccess: () => {
                setDeleting(null);
                setNotice("Idea removed.");
              },
            })
          }
        />
      )}
    </div>
  );
}

function IdeaFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (title: string) => void }) {
  const saveIdea = useSaveIdea();
  const [error, setError] = useState("");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") || "").trim();
    if (!title) {
      setError("Give the idea a short name.");
      return;
    }
    saveIdea.mutate(
      {
        title,
        kind: (String(f.get("kind")) as IdeaKind) || "other",
        one_time_cost: Number(f.get("one_time_cost")) || 0,
        monthly_cost: Number(f.get("monthly_cost")) || 0,
        expected_monthly_return: Number(f.get("expected_monthly_return")) || 0,
        return_starts_in_months: Math.max(0, Math.floor(Number(f.get("return_starts_in_months")) || 0)),
        notes: String(f.get("notes") || "").trim() || null,
        status: "open",
      },
      {
        onSuccess: () => onSaved(title),
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save the idea."),
      },
    );
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="serif text-2xl">Test an idea</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Numbers only — costs, returns, timing. Leave unknown returns at zero; the verdict will say so honestly.
      </p>
      {error && (
        <p className="mt-3 rounded-xl bg-[#f5e5df] px-4 py-2.5 text-[13px] text-[#914e40]" role="alert" data-testid="status-idea-error">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-xs font-bold">
          Idea name
          <input name="title" required placeholder="Tea shop near the bus park" className="field mt-1.5" data-testid="input-idea-title" />
        </label>
        <label className="block text-xs font-bold">
          Type
          <select name="kind" className="field mt-1.5" data-testid="input-idea-kind">
            {IDEA_KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold">
            Upfront cost (Rs)
            <input name="one_time_cost" type="number" min="0" step="any" placeholder="300000" className="field mono mt-1.5" data-testid="input-idea-onetime" />
          </label>
          <label className="block text-xs font-bold">
            Monthly running (Rs)
            <input name="monthly_cost" type="number" min="0" step="any" placeholder="20000" className="field mono mt-1.5" data-testid="input-idea-monthly" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold">
            Expected return /mo (Rs)
            <input name="expected_monthly_return" type="number" min="0" step="any" placeholder="15000" className="field mono mt-1.5" data-testid="input-idea-return" />
          </label>
          <label className="block text-xs font-bold">
            Returns begin after (months)
            <input name="return_starts_in_months" type="number" min="0" step="1" placeholder="3" className="field mono mt-1.5" data-testid="input-idea-starts" />
          </label>
        </div>
        <label className="block text-xs font-bold">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
          <input name="notes" placeholder="Why this, why now…" className="field mt-1.5" data-testid="input-idea-notes" />
        </label>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold">
            Cancel
          </button>
          <button disabled={saveIdea.isPending} className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60" data-testid="button-save-idea">
            {saveIdea.isPending ? "Saving…" : "Save & analyze"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmBox({ title, message, busy, onClose, onConfirm }: { title: string; message: string; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2 className="serif text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-6 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold">Keep it</button>
        <button onClick={onConfirm} disabled={busy} className="flex-1 rounded-full bg-destructive py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-60" data-testid="button-confirm-delete-idea">
          {busy ? "Removing…" : "Remove"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#17251f]/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92dvh] w-full max-w-[500px] overflow-y-auto rounded-t-[28px] border border-border bg-background p-6 shadow-2xl sm:rounded-[28px]">
        <div className="mb-3 flex justify-end">
          <button onClick={onClose} aria-label="Close dialog" className="rounded-full p-2 text-muted-foreground hover:bg-muted" data-testid="button-close-idea-dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Compact strip for the dashboard: open ideas with live verdict chips. */
export function IdeasStrip() {
  const ideasQuery = useIdeas(true);
  const { base } = useFeasibilityBase(true);
  const open = (ideasQuery.data ?? []).filter((i) => i.status === "open").slice(0, 2);
  if (ideasQuery.isLoading) {
    return <div className="mb-7 h-24 animate-pulse rounded-[24px] bg-muted/60" />;
  }
  if (open.length === 0 || !base) return null;
  return (
    <section className="mb-7 overflow-hidden rounded-[26px] border border-border bg-card p-5 soft-shadow sm:p-6" data-testid="ideas-strip">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7455]">Ideas under test</p>
        <Link href="/ideas" className="text-xs font-semibold text-primary hover:underline" data-testid="link-all-ideas">
          All ideas
        </Link>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {open.map((idea) => (
          <VerdictChip
            key={idea.id}
            title={idea.title}
            verdict={verdictOf(idea, base)}
          />
        ))}
      </div>
    </section>
  );
}

function verdictOf(
  idea: Pick<IdeaRow, "one_time_cost" | "monthly_cost" | "expected_monthly_return" | "return_starts_in_months">,
  base: FinancialBase,
): FeasibilityVerdict {
  return analyzeFeasibility(
    base,
    {
      one_time_cost: Number(idea.one_time_cost),
      monthly_cost: Number(idea.monthly_cost),
      expected_monthly_return: Number(idea.expected_monthly_return),
      return_starts_in_months: Number(idea.return_starts_in_months),
    },
  ).verdict;
}

function VerdictChip({ title, verdict }: { title: string; verdict: FeasibilityVerdict }) {
  const cls =
    verdict === "ready"
      ? "bg-[#e6eee3] text-[#466548]"
      : verdict === "wait"
        ? "bg-[#fdf3e3] text-[#8a6a2f]"
        : verdict === "loan"
          ? "bg-[#e3ecf7] text-[#2f5a8a]"
          : "bg-[#f5e5df] text-[#914e40]";
  const label = verdict === "ready" ? "Ready" : verdict === "wait" ? "Wait" : verdict === "loan" ? "Loan?" : "Risky";
  return (
    <Link
      href="/ideas"
      className="flex items-center justify-between gap-2 rounded-2xl border border-border px-4 py-3 transition hover:-translate-y-0.5"
      data-testid="idea-strip-item"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Lightbulb size={15} className="shrink-0 text-[#9a7455]" />
        <span className="truncate text-[13px] font-bold">{title}</span>
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${cls}`}>{label}</span>
    </Link>
  );
}
