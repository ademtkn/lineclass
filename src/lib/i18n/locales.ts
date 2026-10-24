// İstemci ve sunucuda ortak: desteklenen diller ve dil adları.
// Dil seçicide görünme sırası: EN · KG · RU · TR
export const LOCALES = ["en", "ky", "ru", "tr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";
export const LOCALE_COOKIE = "lc_lang";

/** Dil seçicide görünen kısa etiket ve kendi dilindeki adı */
export const LOCALE_META: Record<Locale, { short: string; native: string; intl: string }> = {
  tr: { short: "TR", native: "Türkçe", intl: "tr-TR" },
  en: { short: "EN", native: "English", intl: "en-GB" },
  ky: { short: "KG", native: "Кыргызча", intl: "ky-KG" },
  ru: { short: "RU", native: "Русский", intl: "ru-RU" },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
