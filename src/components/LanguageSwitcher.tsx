"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import { useI18n } from "@/lib/i18n/client";
import { isLocale, LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/locales";

/** TR · EN · KG · RU — seçim çerezde saklanır, sayfa yeni dille yeniden çizilir. */
export function LanguageSwitcher({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const change = (l: Locale) =>
    start(async () => {
      await setLocale(l);
      router.refresh();
    });

  // Dar üst bar için: tek düğme genişliğinde açılır liste
  if (compact) {
    return (
      <label className={`relative inline-flex ${className}`}>
        <span className="sr-only">{t("common.language")}</span>
        <select
          value={locale}
          disabled={pending}
          onChange={(e) => isLocale(e.target.value) && change(e.target.value)}
          className="min-h-11 appearance-none rounded-2xl bg-slate-100 py-0 pl-3 pr-7 text-sm font-bold text-slate-700"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={l} title={LOCALE_META[l].native}>
              {LOCALE_META[l].short}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">▾</span>
      </label>
    );
  }

  return (
    <div role="group" aria-label={t("common.language")} className={`inline-flex rounded-xl bg-slate-100 p-0.5 ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          title={LOCALE_META[l].native}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => change(l)}
          className={`min-h-9 min-w-10 rounded-lg px-2 text-xs font-bold transition ${
            l === locale ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {LOCALE_META[l].short}
        </button>
      ))}
    </div>
  );
}
