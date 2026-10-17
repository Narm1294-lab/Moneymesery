/**
 * Worldwide Currency Configuration & Formatting for Money Companion.
 * Supports any ISO 4217 world currency with native formatting, symbols, and locales.
 */

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  decimals: number;
}

export const WORLD_CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB", decimals: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN", decimals: 2 },
  { code: "NPR", symbol: "रू", name: "Nepalese Rupee", locale: "en-NP", decimals: 2 },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", locale: "en-CA", decimals: 2 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP", decimals: 0 },
  { code: "CNY", symbol: "CN¥", name: "Chinese Yuan", locale: "zh-CN", decimals: 2 },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", locale: "de-CH", decimals: 2 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", locale: "ar-AE", decimals: 2 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG", decimals: 2 },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", locale: "ar-SA", decimals: 2 },
  { code: "QAR", symbol: "QR", name: "Qatari Riyal", locale: "ar-QA", decimals: 2 },
  { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar", locale: "ar-KW", decimals: 3 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", locale: "pt-BR", decimals: 2 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", locale: "es-MX", decimals: 2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA", decimals: 2 },
  { code: "KRW", symbol: "₩", name: "South Korean Won", locale: "ko-KR", decimals: 0 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", locale: "en-NZ", decimals: 2 },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", locale: "sv-SE", decimals: 2 },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", locale: "nb-NO", decimals: 2 },
  { code: "DKK", symbol: "kr", name: "Danish Krone", locale: "da-DK", decimals: 2 },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", locale: "pl-PL", decimals: 2 },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", locale: "tr-TR", decimals: 2 },
  { code: "THB", symbol: "฿", name: "Thai Baht", locale: "th-TH", decimals: 2 },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", locale: "ms-MY", decimals: 2 },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", locale: "id-ID", decimals: 0 },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", locale: "en-PH", decimals: 2 },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong", locale: "vi-VN", decimals: 0 },
  { code: "EGP", symbol: "E£", name: "Egyptian Pound", locale: "ar-EG", decimals: 2 },
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee", locale: "ur-PK", decimals: 2 },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", locale: "bn-BD", decimals: 2 },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", locale: "si-LK", decimals: 2 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", locale: "en-NG", decimals: 2 },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE", decimals: 2 },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi", locale: "en-GH", decimals: 2 },
  { code: "ILS", symbol: "₪", name: "Israeli Shekel", locale: "he-IL", decimals: 2 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", locale: "zh-HK", decimals: 2 },
  { code: "TWD", symbol: "NT$", name: "New Taiwan Dollar", locale: "zh-TW", decimals: 0 },
  { code: "ARS", symbol: "$", name: "Argentine Peso", locale: "es-AR", decimals: 2 },
  { code: "CLP", symbol: "$", name: "Chilean Peso", locale: "es-CL", decimals: 0 },
  { code: "COP", symbol: "$", name: "Colombian Peso", locale: "es-CO", decimals: 0 },
];

export const CURRENCY_STORAGE_KEY = "mc.currency.v1";
export const AI_LANGUAGE_STORAGE_KEY = "mc.ai_language.v1";

export const SUPPORTED_AI_LANGUAGES = [
  { code: "auto", name: "Auto-detect (Reply in your language)", flag: "🌐" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ne", name: "नेपाली (Nepali)", flag: "🇳🇵" },
  { code: "hi", name: "हिन्दी (Hindi)", flag: "🇮🇳" },
  { code: "es", name: "Español (Spanish)", flag: "🇪🇸" },
  { code: "fr", name: "Français (French)", flag: "🇫🇷" },
  { code: "de", name: "Deutsch (German)", flag: "🇩🇪" },
  { code: "zh", name: "中文 (Chinese)", flag: "🇨🇳" },
  { code: "ja", name: "日本語 (Japanese)", flag: "🇯🇵" },
  { code: "ar", name: "العربية (Arabic)", flag: "🇸🇦" },
  { code: "pt", name: "Português (Portuguese)", flag: "🇧🇷" },
  { code: "ru", name: "Русский (Russian)", flag: "🇷🇺" },
  { code: "bn", name: "বাংলা (Bengali)", flag: "🇧🇩" },
  { code: "ur", name: "اردو (Urdu)", flag: "🇵🇰" },
  { code: "it", name: "Italiano (Italian)", flag: "🇮🇹" },
  { code: "ko", name: "한국어 (Korean)", flag: "🇰🇷" },
];

/**
 * Get active currency code from localStorage or default to USD.
 */
export function getStoredCurrency(): string {
  try {
    const val = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (val && typeof val === "string" && val.trim()) {
      return val.trim().toUpperCase();
    }
  } catch {
    // localStorage unavailable
  }
  return "USD";
}

/**
 * Set active currency in localStorage and dispatch custom event for listeners.
 */
export function setStoredCurrency(code: string): void {
  const clean = code.trim().toUpperCase() || "USD";
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, clean);
    window.dispatchEvent(new CustomEvent("mc:currency-changed", { detail: clean }));
  } catch {
    // ignore
  }
}

/**
 * Get active AI preferred language mode.
 */
export function getStoredAiLanguage(): string {
  try {
    const val = localStorage.getItem(AI_LANGUAGE_STORAGE_KEY);
    if (val && typeof val === "string" && val.trim()) {
      return val.trim();
    }
  } catch {
    // ignore
  }
  return "auto";
}

/**
 * Set active AI language in localStorage.
 */
export function setStoredAiLanguage(lang: string): void {
  try {
    localStorage.setItem(AI_LANGUAGE_STORAGE_KEY, lang.trim() || "auto");
    window.dispatchEvent(new CustomEvent("mc:ai-lang-changed", { detail: lang }));
  } catch {
    // ignore
  }
}

/**
 * Look up CurrencyInfo by ISO code, with safe fallback for any custom currency.
 */
export function getCurrencyInfo(code?: string): CurrencyInfo {
  const c = (code || getStoredCurrency()).toUpperCase();
  const found = WORLD_CURRENCIES.find((item) => item.code === c);
  if (found) return found;

  // Custom or unlisted currency code
  return {
    code: c,
    symbol: c,
    name: c,
    locale: "en-US",
    decimals: 2,
  };
}

/**
 * Format any numerical money amount using the active or specified currency.
 */
export function formatMoney(
  amount: number | null | undefined,
  currencyCode?: string,
  options?: Intl.NumberFormatOptions,
): string {
  const num = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const info = getCurrencyInfo(currencyCode);

  try {
    return new Intl.NumberFormat(info.locale, {
      style: "currency",
      currency: info.code,
      maximumFractionDigits: options?.maximumFractionDigits ?? info.decimals,
      minimumFractionDigits: options?.minimumFractionDigits ?? 0,
      ...options,
    }).format(num);
  } catch {
    // Fallback if custom currency code is not supported by standard Intl
    const formattedNum = num.toLocaleString("en-US", {
      maximumFractionDigits: info.decimals,
      minimumFractionDigits: 0,
    });
    return `${info.symbol} ${formattedNum}`;
  }
}

/**
 * Quick symbol getter for inputs and badges.
 */
export function getCurrencySymbol(currencyCode?: string): string {
  return getCurrencyInfo(currencyCode).symbol;
}
