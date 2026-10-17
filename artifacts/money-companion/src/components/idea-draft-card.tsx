import { useState } from "react";
import { Link } from "wouter";
import { Check, Lightbulb, LoaderCircle, Pencil, X } from "lucide-react";

import type { IdeaDraft } from "@/lib/ai-agent";
import { useSaveIdea } from "@/hooks/useFinance";

const money0 = (n: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(n);

/** Confirm-before-save card for an idea captured in chat. Full feasibility runs on the Ideas page. */
export function IdeaDraftCard({ ideaDraft, onDone }: { ideaDraft: IdeaDraft; onDone: () => void }) {
  const saveIdea = useSaveIdea();
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(ideaDraft.title);
  const [oneTimeCost, setOneTimeCost] = useState(ideaDraft.one_time_cost);
  const [monthlyCost, setMonthlyCost] = useState(ideaDraft.monthly_cost);
  const [expectedMonthlyReturn, setExpectedMonthlyReturn] = useState(ideaDraft.expected_monthly_return);
  const [returnStartsInMonths, setReturnStartsInMonths] = useState(ideaDraft.return_starts_in_months);

  const save = () => {
    setError("");
    if (!title.trim()) {
      setError("Please give your idea a title.");
      return;
    }
    saveIdea.mutate(
      {
        title: title.trim(),
        kind: ideaDraft.ideaKind,
        one_time_cost: oneTimeCost,
        monthly_cost: monthlyCost,
        expected_monthly_return: expectedMonthlyReturn,
        return_starts_in_months: returnStartsInMonths,
        notes: null,
        status: "open",
      },
      {
        onSuccess: onDone,
        onError: (e) => setError(e instanceof Error ? e.message : "Could not save the idea."),
      },
    );
  };

  return (
    <div className="mt-3 rounded-xl bg-card p-3.5 text-foreground shadow-sm border border-border/80" data-testid="assistant-idea-draft">
      {isEditing ? (
        <div className="space-y-3" data-testid="idea-draft-edit-panel">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Pencil size={13} />
              <span>Edit idea details</span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              title="Close edit panel"
              data-testid="button-close-idea-edit"
            >
              <X size={15} />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground">Idea title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Coffee kiosk, Online tutoring"
              className="field mt-1 w-full text-xs"
              data-testid="input-edit-idea-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground">Upfront cost</label>
              <input
                type="number"
                min="0"
                step="any"
                value={oneTimeCost === 0 ? "" : oneTimeCost}
                onChange={(e) => setOneTimeCost(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="field mt-1 w-full text-xs"
                data-testid="input-edit-idea-cost"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground">Monthly running cost</label>
              <input
                type="number"
                min="0"
                step="any"
                value={monthlyCost === 0 ? "" : monthlyCost}
                onChange={(e) => setMonthlyCost(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="field mt-1 w-full text-xs"
                data-testid="input-edit-idea-monthly-cost"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground">Expected return / mo</label>
              <input
                type="number"
                min="0"
                step="any"
                value={expectedMonthlyReturn === 0 ? "" : expectedMonthlyReturn}
                onChange={(e) => setExpectedMonthlyReturn(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="field mt-1 w-full text-xs"
                data-testid="input-edit-idea-return"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground">Return starts in (mos)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={returnStartsInMonths}
                onChange={(e) => setReturnStartsInMonths(parseInt(e.target.value, 10) || 0)}
                placeholder="0"
                className="field mt-1 w-full text-xs"
                data-testid="input-edit-idea-months"
              />
            </div>
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
              disabled={saveIdea.isPending || !title.trim()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
              data-testid="button-idea-draft-save-edited"
            >
              {saveIdea.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
              {saveIdea.isPending ? "Saving…" : "Save idea"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Lightbulb size={12} /> Idea draft — feasibility runs on save
            </p>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary underline-offset-2 hover:underline"
              data-testid="button-idea-draft-edit-open"
            >
              <Pencil size={12} /> Edit
            </button>
          </div>
          <p className="mt-1 text-[14px] font-bold leading-snug">{title}</p>
          <p className="mono mt-1 text-lg font-semibold">Upfront {money0(oneTimeCost)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {monthlyCost > 0 ? `Running ${money0(monthlyCost)}/mo · ` : ""}
            {expectedMonthlyReturn > 0
              ? `Expects ${money0(expectedMonthlyReturn)}/mo${returnStartsInMonths > 0 ? ` from month ${returnStartsInMonths + 1}` : ""}`
              : "No returns stated"}
          </p>
          {error && <p className="mt-1.5 text-[11px] text-destructive" role="alert">{error}</p>}
          <div className="mt-2.5 flex gap-2">
            <button onClick={onDone} className="rounded-full border border-border px-3 py-2 text-[12px] font-bold" data-testid="button-idea-draft-cancel">
              Discard
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-background px-3 py-2 text-[12px] font-bold text-foreground transition hover:border-primary hover:text-primary active:scale-95"
              data-testid="button-idea-draft-edit"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={save}
              disabled={saveIdea.isPending}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
              data-testid="button-idea-draft-save"
            >
              {saveIdea.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
              {saveIdea.isPending ? "Saving…" : "Save idea"}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            After saving, open{" "}
            <Link href="/ideas" className="font-bold text-primary underline-offset-2 hover:underline">
              Ideas
            </Link>{" "}
            for the full Ready / Wait / Loan verdict against your numbers.
          </p>
        </>
      )}
    </div>
  );
}
