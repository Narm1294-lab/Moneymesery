export type TransactionType = "income" | "expense";
export type TransactionSource = "manual" | "text" | "voice";
export type CategoryType = "income" | "expense";
export type LoanType = "lent" | "borrowed";
export type LoanStatus = "active" | "paid" | "defaulted";
export type InterestType = "none" | "simple" | "compound";
export type InterestPeriod = "yearly" | "monthly";

export interface LoanRow {
  id: string;
  user_id: string;
  type: LoanType;
  counterparty: string;
  principal: number;
  currency: string;
  interest_rate: number;
  interest_type: InterestType;
  interest_period: InterestPeriod;
  start_date: string;
  due_date: string | null;
  amount_repaid: number;
  status: LoanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanPaymentRow {
  id: string;
  loan_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  payment_type: "principal" | "interest" | "both";
  notes: string | null;
  created_at: string;
}

export type LoanInput = Omit<
  LoanRow,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export type LoanUpdate = Partial<LoanInput>;

export type LoanPaymentInput = Omit<
  LoanPaymentRow,
  "id" | "user_id" | "created_at"
>;


export interface CategoryRow {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  is_default: boolean;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  merchant: string | null;
  transaction_date: string;
  source: TransactionSource;
  created_at: string;
  updated_at: string;
}

type CategoryInsert = {
  id?: string;
  user_id?: string | null;
  name: string;
  type: CategoryType;
  icon?: string | null;
  is_default?: boolean;
  created_at?: string;
};

type TransactionInsert = {
  id?: string;
  user_id?: string;
  category_id?: string | null;
  type: TransactionType;
  amount: number;
  currency?: string;
  description?: string | null;
  merchant?: string | null;
  transaction_date?: string;
  source?: TransactionSource;
  created_at?: string;
  updated_at?: string;
};

export interface DashboardSummary {
  lifetime_income: number;
  lifetime_expenses: number;
  recorded_balance: number;
  month_income: number;
  month_expenses: number;
  month_transaction_count: number;
}

export type AccountKind = "cash" | "bank" | "wallet";

export interface AccountOpeningRow {
  id: string;
  user_id: string;
  name: string;
  kind: AccountKind;
  amount: number;
  created_at: string;
}

export type AccountOpeningInput = Omit<AccountOpeningRow, "id" | "user_id" | "created_at">;

export type IdeaKind = "business" | "vehicle" | "equipment" | "education" | "land" | "other";
export type IdeaStatus = "open" | "started" | "dropped";

export interface IdeaRow {
  id: string;
  user_id: string;
  title: string;
  kind: IdeaKind;
  one_time_cost: number;
  monthly_cost: number;
  expected_monthly_return: number;
  return_starts_in_months: number;
  notes: string | null;
  status: IdeaStatus;
  created_at: string;
  updated_at: string;
}

export type IdeaInput = Omit<IdeaRow, "id" | "user_id" | "created_at" | "updated_at">;
export type IdeaUpdate = Partial<IdeaInput>;

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: CategoryRow;
        Insert: CategoryInsert;
        Update: Partial<CategoryInsert>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: TransactionInsert;
        Update: Partial<TransactionInsert>;
        Relationships: [];
      };
      account_openings: {
        Row: AccountOpeningRow;
        Insert: AccountOpeningInput;
        Update: Partial<AccountOpeningInput>;
        Relationships: [];
      };
      ideas: {
        Row: IdeaRow;
        Insert: IdeaInput;
        Update: Partial<IdeaInput>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          currency: string;
          language: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          currency?: string;
          language?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          full_name: string | null;
          currency: string;
          language: string;
          timezone: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_dashboard_summary: {
        Args: Record<string, never>;
        Returns: DashboardSummary[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type TransactionInput = Omit<
  TransactionInsert,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export type TransactionUpdate = Partial<TransactionInput>;