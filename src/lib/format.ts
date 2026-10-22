import { LOCALE_META, type Locale } from "@/lib/i18n/locales";

const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE ?? "Asia/Bishkek";

const formatters = new Map<Locale, Intl.DateTimeFormat>();

export function formatDateTime(iso: string, locale: Locale = "tr") {
  let f = formatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE_META[locale].intl, { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
    formatters.set(locale, f);
  }
  return f.format(new Date(iso));
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

/** Okulun saat diliminde bugün mü? */
export function isToday(iso: string) {
  return dayKey.format(new Date(iso)) === dayKey.format(new Date());
}

/** "Bugün" sorguları için güvenli alt sınır (saat dilimi farklarını karşılar). */
export function recentSinceIso(hours = 36) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}
