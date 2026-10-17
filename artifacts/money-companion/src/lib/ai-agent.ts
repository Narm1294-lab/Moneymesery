import { chatComplete, streamChat, type AiChatMessage, type AiSettings } from "@/lib/ai-providers";
import type {
  CategoryRow,
  DashboardSummary,
  IdeaKind,
  LoanPaymentRow,
  LoanRow,
  LoanType,
  TransactionRow,
  TransactionType,
} from "@/lib/database.types";
import { calculateLoanDetails, loanInterestDue } from "@/lib/loanUtils";
import { getStoredCurrency, getCurrencyInfo, getStoredAiLanguage } from "@/lib/currency";

export interface AiParsedDraft {
  type: TransactionType;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  description: string;
  merchant: string;
  confidence: "high" | "medium" | "low";
}

export type AgentStep = string;

function categoriesContext(categories: CategoryRow[]): string {
  const income = categories.filter((c) => c.type === "income").map((c) => `${c.name} (${c.id})`);
  const expense = categories.filter((c) => c.type === "expense").map((c) => `${c.name} (${c.id})`);
  return `EXPENSE categories:\n${income.length ? "" : ""}${expense.join("\n") || "(none)"}\n\nINCOME categories:\n${income.join("\n") || "(none)"}`;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1] || "", text];
  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) continue;
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

function toDraft(obj: Record<string, unknown>, categories: CategoryRow[]): AiParsedDraft | null {
  const rawAmount = obj.amount;
  const amount = typeof rawAmount === "string" ? Number(rawAmount.replace(/,/g, "")) : Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const type: TransactionType = obj.type === "income" ? "income" : "expense";
  const desc = typeof obj.description === "string" ? obj.description.slice(0, 120) : "";
  const merchant = typeof obj.merchant === "string" ? obj.merchant.slice(0, 60) : "";
  let category_id: string | null = null;
  let category_name: string | null = null;
  if (typeof obj.category_id === "string") {
    const match = categories.find((c) => c.id === obj.category_id && c.type === type);
    if (match) {
      category_id = match.id;
      category_name = match.name;
    }
  }
  if (!category_id && typeof obj.category_name === "string" && obj.category_name) {
    const exact = obj.category_name.toLowerCase();
    const match = categories.find(
      (c) => c.type === type && c.name.toLowerCase() === exact,
    );
    if (match) {
      category_id = match.id;
      category_name = match.name;
    }
  }
  // Keyword fallback when the model names a category loosely.
  if (!category_id && typeof obj.category_name === "string" && obj.category_name) {
    const loose = (obj.category_name as string).toLowerCase();
    const match = categories.find((c) => c.type === type && loose.includes(c.name.toLowerCase()));
    if (match) {
      category_id = match.id;
      category_name = match.name;
    }
  }
  return {
    type,
    amount: Math.round(amount * 100) / 100,
    category_id,
    category_name,
    description: desc,
    merchant,
    confidence: category_id ? "high" : "medium",
  };
}

export async function parseTransactionWithAi(
  settings: AiSettings,
  text: string,
  categories: CategoryRow[],
  source: "text" | "voice" = "text",
  currencyCode?: string,
): Promise<AiParsedDraft | null> {
  const curCode = currencyCode || getStoredCurrency();
  const curInfo = getCurrencyInfo(curCode);
  const messages: AiChatMessage[] = [
    {
      role: "system",
      content: `You parse personal finance notes for a worldwide expense tracker. Active currency is ${curInfo.code} (${curInfo.symbol}). Today is ${new Date().toISOString().slice(0, 10)}.
The note can be entered in ANY language in the world (English, Nepali, Hindi, Spanish, French, German, Japanese, Chinese, Arabic, etc.).
${categoriesContext(categories)}
Reply with ONLY a JSON object, no other text:
{"type":"expense"|"income","amount":number,"category_id":string|null,"category_name":string|null,"description":string,"merchant":string}
Rules: amount must be a positive number parsed from the note (respect any world currency symbols like $, €, £, ₹, ¥, Rs, etc. or plain numbers; convert to pure number). type is income only for salary/received/earned/got-paid; otherwise expense. Prefer an exact category_id from the lists above; if unsure set category_id null but still give category_name best guess. description is a short cleaned label in the user's language (no amounts). merchant is shop/person or "".`,
    },
    { role: "user", content: `Note (${source}): ${text}` },
  ];
  const reply = await chatComplete(settings, messages, { maxTokens: 600, temperature: 0 });
  const obj = extractJsonObject(reply);
  if (!obj) return null;
  return toDraft(obj, categories);
}

export async function parseLoanWithAi(
  settings: AiSettings,
  text: string,
  loans: LoanRow[],
  currencyCode?: string,
): Promise<LoanDraft | null> {
  const curCode = currencyCode || getStoredCurrency();
  const curInfo = getCurrencyInfo(curCode);
  const active = loans.filter((l) => l.status === "active");
  const loanList =
    active
      .map((l) => `- id:${l.id} | ${l.type} | ${l.counterparty} | principal ${curInfo.code} ${l.principal} | repaid ${curInfo.code} ${l.amount_repaid}`)
      .join("\n") || "(no active loans)";
  const messages: AiChatMessage[] = [
    {
      role: "system",
      content: `You parse loan-related notes worldwide. Active currency is ${curInfo.code} (${curInfo.symbol}). Today is ${new Date().toISOString().slice(0, 10)}.
The note can be in ANY language in the world (English, Nepali, Hindi, Spanish, French, etc.).
Active loans:\n${loanList}
Reply with ONLY one JSON object, no other text.
- New loan ("lent 5000 to Ram", "borrowed 3000 from Sita", "presté 200 a Juan"): {"kind":"loan_new","loan_type":"lent"|"borrowed","amount":N,"counterparty":"Name","interest_rate":0} — lent = you gave (they owe you); borrowed = you took (you owe them). interest_rate from the note if stated, else 0. No rate mentioned means 0%.
- Repayment ("Ram paid back 2000", "paid 1000 to Sita", "Juan me devolvió 100"): {"kind":"loan_payment","loan_id":"<matching id>","amount":N} — they-pay-you matches a LENT loan, you-pay-them matches a BORROWED loan. No match → {"kind":"none"}.
- Anything not loan-related → {"kind":"none"}.`,
    },
    { role: "user", content: `Note: ${text}` },
  ];
  const reply = await chatComplete(settings, messages, { maxTokens: 400, temperature: 0 });
  const obj = extractJsonObject(reply);
  if (!obj) return null;
  return toLoanDraft(obj, loans);
}

export async function generateInsights(
  settings: AiSettings,
  summary: DashboardSummary,
  recent: TransactionRow[],
  categories: CategoryRow[],
  onToken: (t: string) => void,
  signal?: AbortSignal,
  currencyCode?: string,
): Promise<string> {
  const curCode = currencyCode || getStoredCurrency();
  const curInfo = getCurrencyInfo(curCode);
  const aiLang = getStoredAiLanguage();
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const lines = recent.slice(0, 40).map((t) => {
    const date = t.transaction_date.slice(0, 10);
    return `- ${date} ${t.type} ${curInfo.code} ${t.amount} ${names.get(t.category_id || "") || "Uncategorised"} ${t.description || ""} ${t.merchant || ""}`.trim();
  });
  const langRule = aiLang && aiLang !== "auto" 
    ? `Write the response in ${aiLang} language.` 
    : "Respond warmly in the user's primary language.";

  const messages: AiChatMessage[] = [
    {
      role: "system",
      content: `You are a supportive, warm personal-finance companion for users worldwide. Use ONLY the numbers given. Never invent transactions. Keep it short: 3-5 short lines with an engaging, interactive tone. Mention top spending area, month income vs expenses, and one practical tip. Active currency is ${curInfo.code} (${curInfo.symbol}). ${langRule}`,
    },
    {
      role: "user",
      content: `Month income ${curInfo.code} ${summary.month_income}, month expenses ${curInfo.code} ${summary.month_expenses}, notes this month ${summary.month_transaction_count}, recorded balance ${curInfo.code} ${summary.recorded_balance}.\nRecent notes:\n${lines.join("\n") || "(no recent notes)"}\n\nGive an insightful, motivating summary.`,
    },
  ];
  return streamChat(settings, messages, onToken, { signal, maxTokens: 600, temperature: 0.5 });
}

export interface AgentDraft extends AiParsedDraft {
  transaction_date: string;
}

export interface AgentResult {
  reply: string;
  draft: AgentDraft | null;
  loanDraft: LoanDraft | null;
  ideaDraft: IdeaDraft | null;
}

export interface IdeaDraft {
  kind: "idea";
  title: string;
  ideaKind: IdeaKind;
  one_time_cost: number;
  monthly_cost: number;
  expected_monthly_return: number;
  return_starts_in_months: number;
}

const IDEA_KINDS: IdeaKind[] = ["business", "vehicle", "equipment", "education", "land", "other"];

function extractIdeaObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```idea\s*([\s\S]*?)```/i);
  if (!fenced) return null;
  const candidate = fenced[1];
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    return null;
  }
  return null;
}

function toIdeaDraft(obj: Record<string, unknown>): IdeaDraft | null {
  const title = typeof obj.title === "string" ? obj.title.trim().slice(0, 80) : "";
  if (!title) return null;
  const num = (v: unknown) => {
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
  };
  const ideaKind: IdeaKind = IDEA_KINDS.includes(obj.ideaKind as IdeaKind)
    ? (obj.ideaKind as IdeaKind)
    : IDEA_KINDS.includes(obj.kind as IdeaKind) && obj.kind !== "idea"
      ? (obj.kind as IdeaKind)
      : "other";
  return {
    kind: "idea",
    title,
    ideaKind,
    one_time_cost: num(obj.one_time_cost ?? obj.amount),
    monthly_cost: num(obj.monthly_cost),
    expected_monthly_return: num(obj.expected_monthly_return ?? obj.expected_return),
    return_starts_in_months: Math.max(0, Math.floor(Number(obj.return_starts_in_months) || 0)),
  };
}

export interface LoanNewDraft {
  kind: "loan_new";
  loan_type: LoanType;
  amount: number;
  counterparty: string;
  interest_rate: number;
}

export interface LoanPaymentDraft {
  kind: "loan_payment";
  loan_id: string;
  amount: number;
  /** Explicit interest ("received 500 interest") — all to interest, principal untouched. */
  interestOnly?: boolean;
}

export type LoanDraft = LoanNewDraft | LoanPaymentDraft;

function extractLoanObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```loan\s*([\s\S]*?)```/i);
  if (!fenced) return null;
  const candidate = fenced[1];
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    return null;
  }
  return null;
}

function toLoanDraft(obj: Record<string, unknown>, loans: LoanRow[]): LoanDraft | null {
  const rawAmount = obj.amount;
  const amount = typeof rawAmount === "string" ? Number(rawAmount.replace(/,/g, "")) : Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (obj.kind === "loan_new") {
    const counterparty = typeof obj.counterparty === "string" ? obj.counterparty.trim().slice(0, 60) : "";
    if (!counterparty) return null;
    const loan_type: LoanType = obj.loan_type === "borrowed" ? "borrowed" : "lent";
    const rateRaw = Number(obj.interest_rate);
    return {
      kind: "loan_new",
      loan_type,
      amount: Math.round(amount * 100) / 100,
      counterparty,
      interest_rate: Number.isFinite(rateRaw) && rateRaw >= 0 ? rateRaw : 0,
    };
  }
  if (obj.kind === "loan_payment") {
    const loan = typeof obj.loan_id === "string" ? loans.find((l) => l.id === obj.loan_id) : undefined;
    if (!loan) return null;
    return {
      kind: "loan_payment",
      loan_id: loan.id,
      amount: Math.round(amount * 100) / 100,
      interestOnly: obj.interest_only === true || obj.interestOnly === true ? true : undefined,
    };
  }
  return null;
}

function loansContext(loans: LoanRow[], paymentsByLoan: Record<string, LoanPaymentRow[]>, curCode: string = getStoredCurrency()): string {
  const curInfo = getCurrencyInfo(curCode);
  const active = loans.filter((l) => l.status === "active");
  if (active.length === 0) return "Active loans: (none)";
  return (
    "Active loans (principal is NEVER income/expense — only interest is):\n" +
    active
      .map((l) => {
        const payments = paymentsByLoan[l.id] || [];
        const calc = calculateLoanDetails(l);
        const due = loanInterestDue(l, payments);
        const who = l.type === "lent" ? `you lent to ${l.counterparty} (they owe you)` : `you borrowed from ${l.counterparty} (you owe them)`;
        return `- id:${l.id} | ${who} | principal ${curInfo.code} ${l.principal} | rate ${l.interest_rate}% ${l.interest_type}/${l.interest_period} | principal repaid ${curInfo.code} ${l.amount_repaid} | accrued interest ${curInfo.code} ${calc.accruedInterest} | interest still due ${curInfo.code} ${due} | balance ${curInfo.code} ${calc.netRemainingBalance}`;
      })
      .join("\n")
  );
}

/**
 * Match free text ("food", "put it under lunch") to a category of the given
 * type. Used so the agent accepts a spoken/typed category answer directly.
 */
export function matchCategoryName(
  text: string,
  type: TransactionType,
  categories: CategoryRow[],
): CategoryRow | null {
  const needle = text.toLowerCase().trim();
  if (!needle) return null;
  const pool = categories.filter((c) => c.type === type);
  const exact = pool.find((c) => c.name.toLowerCase() === needle);
  if (exact) return exact;
  // "lunch" should match "Food & Lunch", "bus" should match "Transport – Bus".
  const hits = pool.filter(
    (c) => c.name.length > 2 && (needle.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(needle)),
  );
  if (hits.length === 1) return hits[0];
  // Prefer an exact word hit when several contain the text.
  const words = needle.split(/[^a-z]+/);
  return (
    hits.find((c) => words.includes(c.name.toLowerCase())) ||
    pool.find((c) => words.includes(c.name.toLowerCase())) ||
    null
  );
}

export async function runChatAgent(
  settings: AiSettings,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  context: {
    summary: DashboardSummary | null;
    recent: TransactionRow[];
    categories: CategoryRow[];
    pendingDraft?: AgentDraft | null;
    loans?: LoanRow[];
    loanPayments?: Record<string, LoanPaymentRow[]>;
    pendingLoan?: LoanDraft | null;
    /** Precomputed money snapshot (avg income/expenses, cash, obligations) for idea checks. */
    moneyContext?: string | null;
    currencyCode?: string;
    preferredLanguage?: string;
  },
  hooks: { onStep: (s: AgentStep) => void; onToken: (t: string) => void; signal?: AbortSignal },
): Promise<AgentResult> {
  const curCode = context.currencyCode || getStoredCurrency();
  const curInfo = getCurrencyInfo(curCode);
  const activeLang = context.preferredLanguage || getStoredAiLanguage();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  hooks.onStep("Reading your recent notes…");
  const names = new Map(context.categories.map((c) => [c.id, c.name]));
  const recentLines = context.recent.slice(0, 25).map((t) => {
    const date = t.transaction_date.slice(0, 10);
    return `- ${date} ${t.type} ${curInfo.code} ${t.amount} ${names.get(t.category_id || "") || "?"} ${t.description || ""}`.trim();
  });
  const pending = context.pendingDraft;
  const pendingNames = pending
    ? context.categories
        .filter((c) => c.type === pending.type)
        .map((c) => c.name)
        .join(", ")
    : "";
  const loans = context.loans ?? [];
  const loanLines = loansContext(loans, context.loanPayments ?? {}, curCode);
  const pendingLoanLine = context.pendingLoan
    ? `There is an UNSAVED loan draft: ${JSON.stringify(context.pendingLoan)}. If the user's message answers the missing piece (person, side, or which loan), re-emit the complete loan block.`
    : "There is no unsaved loan draft.";
  hooks.onStep("Thinking…");

  const langInstruction =
    activeLang && activeLang !== "auto"
      ? `CRITICAL LANGUAGE REQUIREMENT: You MUST reply fluently in "${activeLang}" language.`
      : `CRITICAL MULTILINGUAL & INTERACTIVE REQUIREMENT:
- The user can communicate in ANY language in the world (English, Nepali, Hindi, Spanish, French, German, Japanese, Chinese, Arabic, Russian, Portuguese, etc.).
- ALWAYS detect the user's language and respond naturally, fluently, and engagingly in that EXACT SAME LANGUAGE!
- Be truly interactive, conversational, warm, and helpful. Answer financial queries, offer proactive advice, celebrate good saving habits, and guide them clearly.`;

  const messages: AiChatMessage[] = [
    {
      role: "system",
      content: `You are Money Companion, an interactive, intelligent personal finance assistant for users worldwide.
Active currency: ${curInfo.code} (${curInfo.symbol}). Timezone: ${timeZone}. Today: ${new Date().toISOString().slice(0, 10)}.

${langInstruction}

FINANCIAL DATA:
${categoriesContext(context.categories)}
Summary: ${context.summary ? `month income ${curInfo.code} ${context.summary.month_income}, month expenses ${curInfo.code} ${context.summary.month_expenses}, notes ${context.summary.month_transaction_count}` : "unavailable"}.
Recent notes:\n${recentLines.join("\n") || "(none)"}
${pending ? `There is an UNSAVED draft still waiting for a category: ${JSON.stringify(pending)}. Category is mandatory — never save or confirm without one. If the user's message names a category (even loosely, e.g. "food", "lunch", "groceries"), confirm briefly in their language and re-emit the complete transaction block with the closest matching category_id from the lists above. If it matches nothing, ask them to choose from exactly these ${pending.type} categories: ${pendingNames}.` : "There is no unsaved draft."}
${loanLines}
${pendingLoanLine}

LOAN RULES (principal is NEVER income/expense — only interest is):
- New loan ("lent 5000 to Ram", "borrowed 3000 from Sita", "presté 200 a Carlos", etc.) → append a fenced block:
\`\`\`loan
{"kind":"loan_new","loan_type":"lent"|"borrowed","amount":5000,"counterparty":"Ram","interest_rate":0}
\`\`\`
lent = you gave money (they owe you). borrowed = you took money (you owe them). interest_rate from the note if stated, else 0 — no rate mentioned means 0% interest, do NOT ask, just record.
- Repayment ("Ram paid back 2000", "paid 1000 to Sita", "Carlos me pagó 100") → match the person to an active loan above: they-pay-you means your LENT loan, you-pay-them means your BORROWED loan. Emit only:
\`\`\`loan
{"kind":"loan_payment","loan_id":"<id from the list>","amount":2000}
\`\`\`
The app computes the interest-first split itself — never compute or promise split numbers.
- No matching active loan → say so in 1 sentence and ask whether to create the loan first (never invent a loan_id).
- Same person on both sides → ask which loan (given or taken).
- Pure interest notes ("received 500 interest from Ram") are NOT plain transactions when they match an active loan — emit {"kind":"loan_payment","loan_id":"...","amount":500,"interest_only":true} so it is tracked on the loan AND counted as income/expense. Only when no loan matches, emit the normal transaction block (income for received, expense for paid); interest is the one loan-related thing that belongs in income/expenses.

CRITICAL ACTION CONFIRMATION:
You never save anything to the database yourself — drafts are saved only when the user reviews and clicks Confirm in the UI card. Never write "I have recorded it" or "saved in database". Say "Here is the draft — please review and press Confirm to save" (in the user's language). Keep the fenced machine block complete and properly closed.

TRANSACTION CREATION:
If the user describes a new expense or income in any language (e.g. "spent 25 on lunch", "paid $40 for petrol", "recibí 1500 de salario", "got salary 5000"), reply conversationally in their language and ALSO append a fenced json block like:
\`\`\`transaction
{"type":"expense","amount":25,"category_id":null,"category_name":"Food","description":"Lunch","merchant":"","transaction_date":"${new Date().toISOString().slice(0, 10)}"}
\`\`\`
Prefer exact category_id from the lists. Otherwise null + best-guess category_name. Keep chat replies conversational and natural (1-3 sentences) before any json block.

IDEA INTAKE (any big-money idea — shop, vehicle, equipment, course, land):
${context.moneyContext ? `User's money snapshot: ${context.moneyContext}` : "Money snapshot unavailable."}
- When the user describes wanting to start/buy something big ("open a tea shop", "buy a bike for 2 lakh", "join a computer course"), ask ONLY for missing numbers, one short question at a time: upfront cost, monthly running cost, expected monthly return + from when. Never invent costs — unknown stays unknown until they answer.
- Once title + upfront cost are known (monthly/returns may be 0), append a fenced block:
\`\`\`idea
{"kind":"idea","title":"Tea shop","ideaKind":"business","one_time_cost":300000,"monthly_cost":20000,"expected_monthly_return":15000,"return_starts_in_months":3}
\`\`\`
ideaKind is one of business|vehicle|equipment|education|land|other. The app runs the full feasibility math itself — never promise verdicts or EMI numbers, just say the analysis will be ready on confirm.`,
    },
    ...history.map((h) => ({ role: h.role, content: h.content }) as AiChatMessage),
  ];
  const full = await streamChat(settings, messages, hooks.onToken, {
    signal: hooks.signal,
    // Generous: reasoning models spend output budget on thinking first; too
    // small a budget truncates the reply (and its machine-read JSON block).
    maxTokens: 2000,
    temperature: 0.4,
  });
  const obj = extractJsonObject(full);
  let draft: AgentDraft | null = null;
  if (obj && (typeof obj.amount === "number" || typeof obj.amount === "string")) {
    const base = toDraft(obj, context.categories);
    if (base) {
      const dateRaw = typeof obj.transaction_date === "string" ? obj.transaction_date : "";
      const transaction_date = /^\d{4}-\d{2}-\d{2}/.test(dateRaw)
        ? dateRaw.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      draft = { ...base, transaction_date };
      hooks.onStep("Draft ready — review before saving.");
    }
  }
  const loanObj = extractLoanObject(full);
  let loanDraft: LoanDraft | null = null;
  if (loanObj) {
    const parsed = toLoanDraft(loanObj, loans);
    if (parsed) {
      loanDraft = parsed;
      hooks.onStep(
        parsed.kind === "loan_new" ? "Loan draft ready — review before saving." : "Repayment draft ready — review before saving.",
      );
    }
  }
  const reply = stripCodeBlocks(full).trim();
  const ideaObj = extractIdeaObject(full);
  let ideaDraft: IdeaDraft | null = null;
  if (ideaObj) {
    const parsed = toIdeaDraft(ideaObj);
    if (parsed) {
      ideaDraft = parsed;
      hooks.onStep("Idea draft ready — review before saving.");
    }
  }
  return {
    reply: reply || "Here is what I prepared — review the card below before confirming.",
    draft,
    loanDraft,
    ideaDraft,
  };
}

/**
 * Remove fenced code/JSON blocks from chat replies so users never see raw
 * machine text. Handles truncated streams too (fence opened but never
 * closed because the reply was cut off).
 */
export function stripCodeBlocks(text: string): string {
  let out = text
    .replace(/```transaction[\s\S]*?```/gi, "")
    .replace(/```loan[\s\S]*?```/gi, "")
    .replace(/```idea[\s\S]*?```/gi, "")
    .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, "");
  // Trailing unclosed fence (truncated reply): drop from the opening fence on.
  out = out.replace(/```\w*[\s\S]*$/g, (m) => (m.includes("\n") || m.length > 12 ? "" : m));
  // Stray unclosed JSON object at the very end (also from truncation).
  out = out.replace(/\{\s*"kind"\s*:\s*"[^"]*"(?:[^}]*)?$/g, "");
  return out;
}
