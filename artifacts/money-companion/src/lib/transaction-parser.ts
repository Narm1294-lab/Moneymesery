import type {
  CategoryRow,
  LoanType,
  TransactionType,
} from "@/lib/database.types";
import { getStoredCurrency } from "@/lib/currency";

export interface ParsedTransactionDraft {
  type: TransactionType;
  amount: number;
  category_id: string | null;
  description: string;
  merchant: null;
  transaction_date: string;
  source: "text" | "voice";
  currency: string;
}

const incomeWords = /\b(received|receive|salary|earned|income|freelance|refund|got|recibí|recibido|salario|ingreso|कमाए|पाया|तलब|आम्दानी)\b/i;
const expenseWords = /\b(spent|spend|paid|pay|bought|purchase|expense|cost|gasté|gasto|pagué|खर्च|तिरे|दिए)\b/i;

// Matches worldwide currency symbols, ISO codes, or plain numbers
export const amountPattern = /(?:[\$€£¥₹रू₩₽₺฿₫]|rs\.?|npr|inr|usd|eur|gbp|cad|aud|chf|aed|jpy)?\s*(\d[\d,]*(?:\.\d{1,2})?)/i;

// Loan principal is NEVER income/expense — it belongs to loan records.
// Only interest is income/expense.
const loanWords = /\b(borrow|borrowed|borrowing|loan|loans|lend|lent|lending|owe|owed|owing|debt|prestamo|prestar|presté|deuda|udharo|sapati|diyeko|dieko|liyeko|lieko|ऋण|उधार|सापटी)\b/i;
const interestWords = /\b(interest|interests|interés|intereses|byaj|ब्याज)\b/i;
const repayInWords = /\b(paid\s*back|pay\s*back|repaid|repay|returned|return|got\s*back|received\s*back|devolvió|devolver|फिर्ता|वापस)\b/i;
const newLoanWords = /\b(lent|lend|borrowed|borrow|presté|pedí|took\b.{0,12}\bloan|gave\b.{0,20}\bloan|loan\s*(given|taken|gareko|diyeko))\b/i;

/** Devanagari digits & common spoken number words → ASCII numbers so amounts like 500, five hundred, or २४० parse reliably. */
export function normalizeDigits(text: string): string {
  let res = text.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
  const wordCombos: [RegExp, string][] = [
    [/\b(one\s+thousand|a\s+thousand|one\s+k|1\s*k)\b/gi, "1000"],
    [/\b(two\s+thousand|2\s*k)\b/gi, "2000"],
    [/\b(three\s+thousand|3\s*k)\b/gi, "3000"],
    [/\b(four\s+thousand|4\s*k)\b/gi, "4000"],
    [/\b(five\s+thousand|5\s*k)\b/gi, "5000"],
    [/\b(ten\s+thousand|10\s*k)\b/gi, "10000"],
    [/\b(one\s+hundred|a\s+hundred)\b/gi, "100"],
    [/\b(two\s+hundred)\b/gi, "200"],
    [/\b(three\s+hundred)\b/gi, "300"],
    [/\b(four\s+hundred)\b/gi, "400"],
    [/\b(five\s+hundred)\b/gi, "500"],
    [/\b(six\s+hundred)\b/gi, "600"],
    [/\b(seven\s+hundred)\b/gi, "700"],
    [/\b(eight\s+hundred)\b/gi, "800"],
    [/\b(nine\s+hundred)\b/gi, "900"],
    [/\b(twenty\s+five)\b/gi, "25"],
    [/\b(fifty)\b/gi, "50"],
    [/\b(paanch\s+saya|panch\s+sau|पाँच\s*सय|पांच\s*सौ)\b/gi, "500"],
    [/\b(ek\s+hajar|ek\s+hazar|एक\s*हजार)\b/gi, "1000"],
    [/\b(dui\s+hajar|do\s+hazar|दुई\s*हजार|दो\s*हजार)\b/gi, "2000"],
  ];
  for (const [pattern, repl] of wordCombos) {
    res = res.replace(pattern, repl);
  }
  return res;
}

export type LoanNoteKind = "loan_new" | "loan_repayment" | "loan_interest";

export interface ParsedLoanNote {
  kind: LoanNoteKind;
  /** lent = you gave (they owe you); borrowed = you took (you owe them). */
  loan_type: LoanType;
  /** For repayments/interest: money coming 'in' (they pay you) or going 'out' (you pay them). */
  direction: "in" | "out";
  amount: number;
  counterparty: string;
}

function cleanName(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\b([\$€£¥₹रू₩₽₺฿₫]|rs\.?|npr|inr|usd|eur|gbp|\d[\d,]*(\.\d+)?|loan|loans|interest|byaj|udharo|sapati|lai|bata|diyeko|dieko|liyeko|lieko|gareko|back|today|yesterday)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

/**
 * Detect loan intent in a note. Principal movements are never
 * income/expenses — callers must route these to loan records, and only
 * interest becomes an income/expense transaction.
 */
export function parseLoanNote(rawText: string): ParsedLoanNote | null {
  const normalized = normalizeDigits(rawText.trim());
  if (!normalized) return null;
  const amountMatch = normalized.match(amountPattern);
  const amount = amountMatch ? Number(amountMatch[1].replaceAll(",", "")) : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const lower = normalized.toLowerCase();
  const hasLoanWord = loanWords.test(normalized);
  const hasInterestWord = interestWords.test(normalized);
  const hasRepayWord = repayInWords.test(normalized);
  if (!hasLoanWord && !hasInterestWord && !hasRepayWord) return null;

  // --- Interest-only note: "received 500 interest from Ram" ---
  if (hasInterestWord && !repayInWords.test(normalized) && !newLoanWords.test(normalized)) {
    const party =
      cleanName(normalized.match(/(?:\bfrom\b|\bbata\b)\s+([A-Za-z][A-Za-z0-9 &'’.\-]{1,30})/i)?.[1]) ||
      cleanName(normalized.match(/(?:\bto\b|\blai\b)\s+([A-Za-z][A-Za-z0-9 &'’.\-]{1,30})/i)?.[1]);
    const incoming = /\b(received|receive|got|earned|income)\b/i.test(normalized);
    const outgoing = /\b(paid|pay|gave|give)\b/i.test(normalized);
    if (!party) return null;
    return {
      kind: "loan_interest",
      loan_type: incoming && !outgoing ? "lent" : "borrowed",
      direction: incoming && !outgoing ? "in" : "out",
      amount,
      counterparty: party,
    };
  }

  // --- Repayment: "Ram paid back 2000" (in) vs "paid back 2000 to Ram" (out) ---
  if (repayInWords.test(normalized)) {
    const outParty = cleanName(
      normalized.match(/\b(?:paid\s*back|pay\s*back|returned|return|repaid|repay|farka\s*gareko)\s+(?:(?:rs\.?)?\s*[\d,]+(?:\.\d+)?\s*)?(?:to|lai)\s+([A-Za-z][A-Za-z0-9 &'’.\-]{1,30})/i)?.[1],
    );
    if (outParty) {
      return { kind: "loan_repayment", loan_type: "borrowed", direction: "out", amount, counterparty: outParty };
    }
    const inParty =
      cleanName(normalized.match(/([A-Za-z][A-Za-z'’.\-]{1,30})\s+(?:paid\s*back|repaid|returned|gave\s*back|farka\s*gareko)/i)?.[1]) ||
      cleanName(normalized.match(/(?:\bfrom\b|\bbata\b)\s+([A-Za-z][A-Za-z0-9 &'’.\-]{1,30})/i)?.[1]);
    if (inParty) {
      return { kind: "loan_repayment", loan_type: "lent", direction: "in", amount, counterparty: inParty };
    }
    return null;
  }

  // --- New loan: "lent 5000 to Ram" / "borrowed 3000 from Sita" ---
  if (hasLoanWord || newLoanWords.test(normalized)) {
    const fromParty = cleanName(normalized.match(/(?:\bfrom\b|\bbata\b)\s+([A-Za-z][A-Za-z0-9 &'’.\-]{1,30})/i)?.[1]) ||
      cleanName(normalized.match(/([A-Za-z][A-Za-z0-9 &'’.\-]{1,30})\s+\bbata\b/i)?.[1]);
    const toParty = cleanName(normalized.match(/(?:\bto\b|\blai\b)\s+([A-Za-z][A-Za-z0-9 &'’.\-]{1,30})/i)?.[1]) ||
      cleanName(normalized.match(/([A-Za-z][A-Za-z0-9 &'’.\-]{1,30})\s+\blai\b/i)?.[1]);
    const lentSignal = /\b(lent|lend|gave|give|diyeko|dieko|udharo\s*diyeko)\b/i.test(normalized);
    const borrowedSignal = /\b(borrowed|borrow|took|liyeko|lieko|udharo\s*liyeko)\b/i.test(normalized);
    if (fromParty && (borrowedSignal || !lentSignal)) {
      return { kind: "loan_new", loan_type: "borrowed", direction: "in", amount, counterparty: fromParty };
    }
    if (toParty && (lentSignal || !borrowedSignal)) {
      return { kind: "loan_new", loan_type: "lent", direction: "out", amount, counterparty: toParty };
    }
    // Loan words but no clear person — still claim it so it never becomes income/expense.
    if (hasLoanWord || lower.includes("loan")) {
      const party = toParty || fromParty;
      if (party) {
        const loan_type: LoanType = borrowedSignal ? "borrowed" : "lent";
        return { kind: "loan_new", loan_type, direction: loan_type === "lent" ? "out" : "in", amount, counterparty: party };
      }
    }
    return null;
  }

  return null;
}

/** True when a note is loan-related and must never become an income/expense transaction. */
export function isLoanNote(text: string): boolean {
  return loanWords.test(text) || (interestWords.test(text) && parseLoanNote(text)?.kind === "loan_interest");
}
const categoriesByKeyword: Record<string, string> = {
  lunch: "Food",
  dinner: "Food",
  breakfast: "Food",
  groceries: "Food",
  grocery: "Food",
  restaurant: "Food",
  rent: "Housing",
  housing: "Housing",
  fuel: "Transport",
  taxi: "Transport",
  bus: "Transport",
  travel: "Transport",
  internet: "Bills",
  electricity: "Bills",
  water: "Bills",
  hospital: "Health",
  medicine: "Health",
  school: "Education",
  tuition: "Education",
  books: "Education",
  shopping: "Shopping",
  movie: "Entertainment",
  salary: "Salary",
  freelance: "Freelance",
  refund: "Refund",
};

export function parseTransactionText(
  text: string,
  categories: CategoryRow[],
  source: "text" | "voice" = "text",
): ParsedTransactionDraft | null {
  const cleanText = normalizeDigits(text.trim());
  if (!cleanText || /\b(borrow|borrowed|loan|lend|lent|owe|owed)\b/i.test(cleanText)) {
    return null;
  }

  const amountMatch = cleanText.match(amountPattern);
  const amount = amountMatch
    ? Number(amountMatch[1].replaceAll(",", ""))
    : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const isIncome = incomeWords.test(cleanText);
  const isExpense = expenseWords.test(cleanText);
  if (isIncome === isExpense) return null;

  const type: TransactionType = isIncome ? "income" : "expense";
  const availableCategories = categories.filter((category) => category.type === type);
  const normalized = cleanText.toLowerCase();
  let category: CategoryRow | undefined;

  for (const [keyword, categoryName] of Object.entries(categoriesByKeyword)) {
    if (normalized.includes(keyword)) {
      category = availableCategories.find(
        (item) => item.name.toLowerCase() === categoryName.toLowerCase(),
      );
      if (category) break;
    }
  }

  const description = cleanText
    .replace(amountPattern, " ")
    .replace(
      /\b(i|a|an|the|on|for|to|today|yesterday|spent|spend|paid|pay|bought|purchase|expense|cost|received|receive|salary|earned|income|freelance|refund|got)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  return {
    type,
    amount,
    category_id: category?.id ?? null,
    description,
    merchant: null,
    transaction_date: new Date().toISOString(),
    source,
    currency: getStoredCurrency(),
  };
}