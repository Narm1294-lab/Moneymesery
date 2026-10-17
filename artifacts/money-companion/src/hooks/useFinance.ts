import { useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabase, supabaseConfigured } from "@/lib/supabase";
import type {
  AccountKind,
  AccountOpeningInput,
  AccountOpeningRow,
  CategoryType,
  DashboardSummary,
  IdeaInput,
  IdeaRow,
  IdeaUpdate,
  LoanInput,
  LoanPaymentInput,
  LoanPaymentRow,
  LoanRow,
  LoanUpdate,
  TransactionInput,
  TransactionRow,
  TransactionType,
  TransactionUpdate,
} from "@/lib/database.types";

// The current Supabase client release is stricter than the schema's generated
// helper inference for RPCs and nullable category relations. Keep the service
// hooks as the sole data layer while retaining the domain-facing return types.
const db = () => requireSupabase() as SupabaseClient<any>;

export interface TransactionFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: TransactionType | "all";
}

export interface TransactionPage {
  items: TransactionRow[];
  count: number;
  page: number;
  pageSize: number;
}

export interface AuthSessionState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

const financeKeys = {
  all: ["finance"] as const,
  summary: ["finance", "summary"] as const,
  categories: (type?: CategoryType) => ["finance", "categories", type] as const,
  transactions: (filters: Required<TransactionFilters>) =>
    ["finance", "transactions", filters] as const,
  loans: ["finance", "loans"] as const,
  loanPayments: (loanId: string) => ["finance", "loan-payments", loanId] as const,
  allLoanPayments: ["finance", "all-loan-payments"] as const,
  openings: ["finance", "openings"] as const,
  ideas: ["finance", "ideas"] as const,
};

export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!supabaseConfigured) {
      setIsLoading(false);
      return;
    }
    const auth = requireSupabase().auth;
    let alive = true;
    auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        setSession(null);
      } else {
        setSession(data.session);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (
        previousUserId.current !== undefined &&
        previousUserId.current !== nextUserId
      ) {
        queryClient.clear();
      }
      previousUserId.current = nextUserId;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return useMemo(
    () => ({ session, user: session?.user ?? null, isLoading }),
    [session, isLoading],
  );
}

export async function signInWithPassword(email: string, password: string) {
  return requireSupabase().auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
) {
  return requireSupabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
}

export async function signOut() {
  return requireSupabase().auth.signOut();
}

export function useDashboardSummary(enabled = true) {
  return useQuery({
    queryKey: financeKeys.summary,
    enabled,
    queryFn: async (): Promise<DashboardSummary> => {
      const { data, error } = await db().rpc("get_dashboard_summary");
      if (error) throw error;
      const summary = data?.[0];
      if (!summary) throw new Error("The dashboard summary is unavailable.");
      return {
        lifetime_income: Number(summary.lifetime_income),
        lifetime_expenses: Number(summary.lifetime_expenses),
        recorded_balance: Number(summary.recorded_balance),
        month_income: Number(summary.month_income),
        month_expenses: Number(summary.month_expenses),
        month_transaction_count: Number(summary.month_transaction_count),
      };
    },
  });
}

export function useCategories(type?: CategoryType, enabled = true) {
  return useQuery({
    queryKey: financeKeys.categories(type),
    enabled,
    queryFn: async () => {
      let query = db()
        .from("categories")
        .select("*")
        .order("name", { ascending: true });
      if (type) query = query.eq("type", type);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTransactions(filters: TransactionFilters = {}, enabled = true) {
  const normalized: Required<TransactionFilters> = {
    page: Math.max(0, filters.page ?? 0),
    pageSize: Math.min(100, Math.max(1, filters.pageSize ?? 25)),
    search: filters.search?.trim() ?? "",
    type: filters.type ?? "all",
  };

  return useQuery({
    queryKey: financeKeys.transactions(normalized),
    enabled,
    queryFn: async (): Promise<TransactionPage> => {
      const from = normalized.page * normalized.pageSize;
      const to = from + normalized.pageSize - 1;
      let query = db()
        .from("transactions")
        .select("*", { count: "exact" })
        .order("transaction_date", { ascending: false })
        .range(from, to);

      if (normalized.type !== "all") {
        query = query.eq("type", normalized.type);
      }
      if (normalized.search) {
        const term = normalized.search.replace(/[,%()\\]/g, " ").trim();
        if (term) {
          query = query.or(
            `description.ilike.%${term}%,merchant.ilike.%${term}%`,
          );
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        items: data ?? [],
        count: count ?? 0,
        page: normalized.page,
        pageSize: normalized.pageSize,
      };
    },
  });
}

export function useAllTransactions(startDate?: string, enabled = true) {
  return useQuery({
    queryKey: [...financeKeys.all, "all-transactions", startDate],
    enabled,
    queryFn: async (): Promise<TransactionRow[]> => {
      let query = db()
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (startDate) {
        query = query.gte("transaction_date", startDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { data, error } = await db()
        .from("transactions")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financeKeys.summary }),
        queryClient.invalidateQueries({
          queryKey: [...financeKeys.all, "transactions"],
        }),
      ]);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: TransactionUpdate;
    }) => {
      const { data, error } = await db()
        .from("transactions")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financeKeys.summary }),
        queryClient.invalidateQueries({
          queryKey: [...financeKeys.all, "transactions"],
        }),
      ]);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db()
        .from("transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financeKeys.summary }),
        queryClient.invalidateQueries({
          queryKey: [...financeKeys.all, "transactions"],
        }),
      ]);
    },
  });
}

const LOCAL_LOANS_KEY = "money_companion_loans_v1";
const LOCAL_LOAN_PAYMENTS_KEY = "money_companion_loan_payments_v1";

function getLocalLoans(): LoanRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOANS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLoans(loans: LoanRow[]) {
  try {
    localStorage.setItem(LOCAL_LOANS_KEY, JSON.stringify(loans));
  } catch (e) {
    console.error("Failed to persist local loans", e);
  }
}

function getLocalPayments(loanId?: string): LoanPaymentRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOAN_PAYMENTS_KEY);
    const all: LoanPaymentRow[] = raw ? JSON.parse(raw) : [];
    return loanId ? all.filter((p) => p.loan_id === loanId) : all;
  } catch {
    return [];
  }
}

function saveLocalPayment(payment: LoanPaymentRow) {
  try {
    const current = getLocalPayments();
    localStorage.setItem(
      LOCAL_LOAN_PAYMENTS_KEY,
      JSON.stringify([payment, ...current]),
    );
  } catch (e) {
    console.error("Failed to persist local loan payment", e);
  }
}

export function useLoans(enabled = true) {
  return useQuery({
    queryKey: financeKeys.loans,
    enabled,
    queryFn: async (): Promise<LoanRow[]> => {
      try {
        const { data, error } = await db()
          .from("loans")
          .select("*")
          .order("start_date", { ascending: false });

        if (error) {
          // If table hasn't been created in Supabase yet, fallback gracefully to localStorage
          console.warn("Falling back to local storage for loans:", error.message);
          return getLocalLoans();
        }
        return data ?? [];
      } catch (err) {
        console.warn("Using local storage fallback for loans:", err);
        return getLocalLoans();
      }
    },
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoanInput): Promise<LoanRow> => {
      try {
        const { data, error } = await db()
          .from("loans")
          .insert(input)
          .select()
          .single();

        if (error) {
          console.warn("Failed Supabase insert, saving to local storage:", error.message);
          const localItem: LoanRow = {
            id: crypto.randomUUID(),
            user_id: "local_user",
            ...input,
            amount_repaid: Number(input.amount_repaid) || 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          saveLocalLoans([localItem, ...getLocalLoans()]);
          return localItem;
        }
        return data;
      } catch (err) {
        console.warn("Failed Supabase insert, saving to local storage:", err);
        const localItem: LoanRow = {
          id: crypto.randomUUID(),
          user_id: "local_user",
          ...input,
          amount_repaid: Number(input.amount_repaid) || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        saveLocalLoans([localItem, ...getLocalLoans()]);
        return localItem;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.loans });
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: LoanUpdate;
    }): Promise<LoanRow> => {
      try {
        const { data, error } = await db()
          .from("loans")
          .update(values)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          const current = getLocalLoans();
          const updated = current.map((l) =>
            l.id === id ? { ...l, ...values, updated_at: new Date().toISOString() } : l,
          );
          saveLocalLoans(updated);
          const found = updated.find((l) => l.id === id);
          if (!found) throw new Error("Loan not found");
          return found;
        }
        return data;
      } catch (err) {
        const current = getLocalLoans();
        const updated = current.map((l) =>
          l.id === id ? { ...l, ...values, updated_at: new Date().toISOString() } : l,
        );
        saveLocalLoans(updated);
        const found = updated.find((l) => l.id === id);
        if (!found) throw new Error("Loan not found");
        return found;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.loans });
    },
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await db().from("loans").delete().eq("id", id);
        if (error) {
          const current = getLocalLoans();
          saveLocalLoans(current.filter((l) => l.id !== id));
          return id;
        }
      } catch {
        const current = getLocalLoans();
        saveLocalLoans(current.filter((l) => l.id !== id));
      }
      return id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.loans });
    },
  });
}

export function useRecordLoanPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      loan,
      payment,
      syncToTransactions = false,
      interestAmount,
      principalAmount,
      interestCategoryId,
    }: {
      loan: LoanRow;
      payment: LoanPaymentInput;
      syncToTransactions?: boolean;
      /**
       * Explicit interest-first split. When omitted, the whole amount is
       * treated as principal (legacy behaviour) — callers should compute the
       * split with splitPayment() so only interest reaches income/expenses.
       */
      interestAmount?: number;
      principalAmount?: number;
      interestCategoryId?: string | null;
    }) => {
      const total = Math.max(0, Math.round((Number(payment.amount) || 0) * 100) / 100);
      let interestPart = Math.max(0, Math.round((Number(interestAmount) || 0) * 100) / 100);
      let principalPart =
        principalAmount !== undefined
          ? Math.max(0, Math.round((Number(principalAmount) || 0) * 100) / 100)
          : Math.round((total - interestPart) * 100) / 100;
      if (interestPart + principalPart > total && total > 0) {
        // Keep the total honest: principal absorbs rounding/over-entry.
        principalPart = Math.round((total - interestPart) * 100) / 100;
      }
      const hasSplit = interestAmount !== undefined || principalAmount !== undefined;
      const rows: LoanPaymentInput[] = hasSplit
        ? [
            ...(interestPart > 0
              ? [{ ...payment, amount: interestPart, payment_type: "interest" as const }]
              : []),
            ...(principalPart > 0
              ? [{ ...payment, amount: principalPart, payment_type: "principal" as const }]
              : []),
          ]
        : [payment];
      // amount_repaid tracks PRINCIPAL only — interest must never mark a loan paid.
      const principalPaid = hasSplit ? principalPart : Number(payment.amount);
      const newRepaid = (Number(loan.amount_repaid) || 0) + principalPaid;
      const newStatus =
        newRepaid >= Number(loan.principal) ? ("paid" as const) : loan.status;

      // 1. Record payment row(s) in Supabase or local
      try {
        for (const row of rows) {
          await db().from("loan_payments").insert(row);
        }
      } catch {
        for (const row of rows) {
          const localPayment: LoanPaymentRow = {
            id: crypto.randomUUID(),
            user_id: "local_user",
            ...row,
            created_at: new Date().toISOString(),
          };
          saveLocalPayment(localPayment);
        }
      }

      // 2. Update loan amount_repaid and status
      try {
        await db()
          .from("loans")
          .update({ amount_repaid: newRepaid, status: newStatus })
          .eq("id", loan.id);
      } catch {
        const current = getLocalLoans();
        const updated = current.map((l) =>
          l.id === loan.id
            ? { ...l, amount_repaid: newRepaid, status: newStatus }
            : l,
        );
        saveLocalLoans(updated);
      }

      // 3. Optional: sync ONLY the interest portion as income/expense.
      // Principal movements live solely in loan records and must never
      // touch the dashboard's income/expenses/balance.
      if (syncToTransactions && interestPart > 0) {
        try {
          const isLent = loan.type === "lent"; // Interest back to you = income; interest you pay = expense
          await db().from("transactions").insert({
            type: isLent ? "income" : "expense",
            amount: interestPart,
            currency: loan.currency || "NPR",
            category_id: interestCategoryId ?? null,
            description: `Interest ${isLent ? "received from" : "paid to"} ${loan.counterparty}`,
            merchant: loan.counterparty,
            transaction_date: payment.payment_date,
            source: "manual",
          });
        } catch (e) {
          console.warn("Could not sync interest to transactions:", e);
        }
      }

      return { loanId: loan.id, newRepaid, interestPart, principalPart };
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financeKeys.loans }),
        queryClient.invalidateQueries({ queryKey: financeKeys.loanPayments(variables.loan.id) }),
        queryClient.invalidateQueries({ queryKey: financeKeys.allLoanPayments }),
        queryClient.invalidateQueries({ queryKey: financeKeys.summary }),
        queryClient.invalidateQueries({
          queryKey: [...financeKeys.all, "transactions"],
        }),
      ]);
    },
  });
}

export function useAllLoanPayments(enabled = true) {
  return useQuery({
    queryKey: financeKeys.allLoanPayments,
    enabled,
    queryFn: async (): Promise<LoanPaymentRow[]> => {
      try {
        const { data, error } = await db()
          .from("loan_payments")
          .select("*")
          .order("payment_date", { ascending: false });
        if (error) throw error;
        return data ?? [];
      } catch {
        return getLocalPayments();
      }
    },
  });
}

export function useLoanPayments(loanId: string | null, enabled = true) {
  return useQuery({
    queryKey: financeKeys.loanPayments(loanId ?? "none"),
    enabled: enabled && !!loanId,
    queryFn: async (): Promise<LoanPaymentRow[]> => {
      if (!loanId) return [];
      try {
        const { data, error } = await db()
          .from("loan_payments")
          .select("*")
          .eq("loan_id", loanId)
          .order("payment_date", { ascending: false });
        if (error) throw error;
        return data ?? [];
      } catch {
        return getLocalPayments(loanId);
      }
    },
  });
}

const LOCAL_OPENINGS_KEY = "money_companion_openings_v1";

function getLocalOpenings(): AccountOpeningRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_OPENINGS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AccountOpeningRow[]) : [];
  } catch {
    return [];
  }
}

function saveLocalOpenings(rows: AccountOpeningRow[]) {
  try {
    localStorage.setItem(LOCAL_OPENINGS_KEY, JSON.stringify(rows));
  } catch (e) {
    console.error("Failed to persist local openings", e);
  }
}

export function useAccountOpenings(enabled = true) {
  return useQuery({
    queryKey: financeKeys.openings,
    enabled,
    queryFn: async (): Promise<AccountOpeningRow[]> => {
      try {
        const { data, error } = await db()
          .from("account_openings")
          .select("*")
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data ?? []) as AccountOpeningRow[];
      } catch {
        return getLocalOpenings();
      }
    },
  });
}

/**
 * Replace-all save for starting balances. The list is tiny and edited as a
 * whole, so callers pass the complete desired list each time.
 */
export function useSaveAccountOpenings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: AccountOpeningInput[]): Promise<AccountOpeningRow[]> => {
      const clean = rows
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim().slice(0, 60),
          kind: (["cash", "bank", "wallet"] as AccountKind[]).includes(r.kind as AccountKind)
            ? (r.kind as AccountKind)
            : ("cash" as AccountKind),
          amount: Math.max(0, Math.round((Number(r.amount) || 0) * 100) / 100),
        }));
      try {
        const existing = await db().from("account_openings").select("id");
        if (existing.data?.length) {
          const { error: delError } = await db()
            .from("account_openings")
            .delete()
            .in("id", existing.data.map((e: { id: string }) => e.id));
          if (delError) throw delError;
        }
        if (clean.length === 0) return [];
        const { data, error } = await db().from("account_openings").insert(clean).select("*");
        if (error) throw error;
        return (data ?? []) as AccountOpeningRow[];
      } catch (err) {
        // Table missing (schema not re-run) or offline: keep device-local copy.
        console.warn("Saving openings locally:", err);
        const local: AccountOpeningRow[] = clean.map((r) => ({
          id: crypto.randomUUID(),
          user_id: "local_user",
          ...r,
          created_at: new Date().toISOString(),
        }));
        saveLocalOpenings(local);
        return local;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.openings });
    },
  });
}

const LOCAL_IDEAS_KEY = "money_companion_ideas_v1";

function getLocalIdeas(): IdeaRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_IDEAS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as IdeaRow[]) : [];
  } catch {
    return [];
  }
}

function saveLocalIdeas(rows: IdeaRow[]) {
  try {
    localStorage.setItem(LOCAL_IDEAS_KEY, JSON.stringify(rows));
  } catch (e) {
    console.error("Failed to persist local ideas", e);
  }
}

export function useIdeas(enabled = true) {
  return useQuery({
    queryKey: financeKeys.ideas,
    enabled,
    queryFn: async (): Promise<IdeaRow[]> => {
      try {
        const { data, error } = await db()
          .from("ideas")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as IdeaRow[];
      } catch {
        return getLocalIdeas();
      }
    },
  });
}

export function useSaveIdea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: IdeaInput): Promise<IdeaRow> => {
      const clean: IdeaInput = {
        title: input.title.trim().slice(0, 80) || "Untitled idea",
        kind: input.kind,
        one_time_cost: Math.max(0, Math.round((Number(input.one_time_cost) || 0) * 100) / 100),
        monthly_cost: Math.max(0, Math.round((Number(input.monthly_cost) || 0) * 100) / 100),
        expected_monthly_return: Math.max(0, Math.round((Number(input.expected_monthly_return) || 0) * 100) / 100),
        return_starts_in_months: Math.max(0, Math.floor(Number(input.return_starts_in_months) || 0)),
        notes: input.notes?.trim().slice(0, 500) || null,
        status: input.status,
      };
      try {
        const { data, error } = await db().from("ideas").insert(clean).select("*").single();
        if (error) throw error;
        return data as IdeaRow;
      } catch (err) {
        console.warn("Saving idea locally:", err);
        const local: IdeaRow = {
          id: crypto.randomUUID(),
          user_id: "local_user",
          ...clean,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        saveLocalIdeas([local, ...getLocalIdeas()]);
        return local;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.ideas });
    },
  });
}

export function useUpdateIdea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: IdeaUpdate }): Promise<IdeaRow> => {
      try {
        const { data, error } = await db().from("ideas").update(values).eq("id", id).select("*").single();
        if (error) throw error;
        return data as IdeaRow;
      } catch {
        const updated = getLocalIdeas().map((r) =>
          r.id === id ? { ...r, ...values, updated_at: new Date().toISOString() } : r,
        );
        saveLocalIdeas(updated);
        const found = updated.find((r) => r.id === id);
        if (!found) throw new Error("Idea not found");
        return found;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.ideas });
    },
  });
}

export function useDeleteIdea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await db().from("ideas").delete().eq("id", id);
        if (error) throw error;
      } catch {
        saveLocalIdeas(getLocalIdeas().filter((r) => r.id !== id));
      }
      return id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.ideas });
    },
  });
}