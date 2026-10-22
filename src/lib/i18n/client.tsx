"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeTFromDict, type Dict, type TFunction } from "./dict";
import type { Locale } from "./locales";

const I18nContext = createContext<{ locale: Locale; t: TFunction } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeTFromDict(dict) }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n: I18nProvider eksik");
  return ctx;
}
