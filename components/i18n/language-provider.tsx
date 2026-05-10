"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/types";
import { translations } from "@/lib/i18n/translations";

const storageKey = "safetrack:locale";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: typeof translations.nl;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("nl");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "nl" || stored === "en" || stored === "fr") {
      setLocaleState(stored);
      document.documentElement.lang = stored;
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale(nextLocale) {
      setLocaleState(nextLocale);
      window.localStorage.setItem(storageKey, nextLocale);
      document.documentElement.lang = nextLocale;
    },
    t: translations[locale],
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
