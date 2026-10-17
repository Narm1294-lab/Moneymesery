import { useEffect, useState, useCallback } from "react";
import {
  CURRENCY_STORAGE_KEY,
  AI_LANGUAGE_STORAGE_KEY,
  getStoredCurrency,
  setStoredCurrency,
  getStoredAiLanguage,
  setStoredAiLanguage,
  getCurrencyInfo,
  formatMoney,
  WORLD_CURRENCIES,
  SUPPORTED_AI_LANGUAGES,
  type CurrencyInfo,
} from "@/lib/currency";

export function useCurrency() {
  const [currency, setCurrencyState] = useState<string>(getStoredCurrency());
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo>(getCurrencyInfo());
  const [aiLanguage, setAiLanguageState] = useState<string>(getStoredAiLanguage());

  useEffect(() => {
    const handleUpdate = () => {
      const active = getStoredCurrency();
      setCurrencyState(active);
      setCurrencyInfo(getCurrencyInfo(active));
    };

    const handleLangUpdate = () => {
      setAiLanguageState(getStoredAiLanguage());
    };

    window.addEventListener("mc:currency-changed", handleUpdate);
    window.addEventListener("mc:ai-lang-changed", handleLangUpdate);
    window.addEventListener("storage", (e) => {
      if (e.key === CURRENCY_STORAGE_KEY) handleUpdate();
      if (e.key === AI_LANGUAGE_STORAGE_KEY) handleLangUpdate();
    });

    return () => {
      window.removeEventListener("mc:currency-changed", handleUpdate);
      window.removeEventListener("mc:ai-lang-changed", handleLangUpdate);
    };
  }, []);

  const changeCurrency = useCallback((code: string) => {
    setStoredCurrency(code);
    setCurrencyState(code.toUpperCase());
    setCurrencyInfo(getCurrencyInfo(code.toUpperCase()));
  }, []);

  const changeAiLanguage = useCallback((lang: string) => {
    setStoredAiLanguage(lang);
    setAiLanguageState(lang);
  }, []);

  const format = useCallback(
    (
      amount: number | null | undefined,
      currencyCodeOrOptions?: string | Intl.NumberFormatOptions,
      maybeOptions?: Intl.NumberFormatOptions
    ) => {
      if (typeof currencyCodeOrOptions === "string") {
        return formatMoney(amount, currencyCodeOrOptions || currency, maybeOptions);
      }
      return formatMoney(amount, currency, currencyCodeOrOptions);
    },
    [currency]
  );

  return {
    currency,
    currencyInfo,
    setCurrency: changeCurrency,
    aiLanguage,
    setAiLanguage: changeAiLanguage,
    formatMoney: format,
    symbol: currencyInfo.symbol,
    availableCurrencies: WORLD_CURRENCIES,
    availableLanguages: SUPPORTED_AI_LANGUAGES,
  };
}
