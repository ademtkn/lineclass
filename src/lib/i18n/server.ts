import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DICTS, makeT } from "./dict";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALES, type Locale } from "./locales";

/** Kullanıcının dili: önce seçtiği dil (çerez), yoksa tarayıcı dili, yoksa Türkçe. */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (code === "kg") return "ky";
    if ((LOCALES as readonly string[]).includes(code)) return code as Locale;
  }
  return DEFAULT_LOCALE;
});

export async function getT() {
  const locale = await getLocale();
  return { t: makeT(locale), locale, dict: DICTS[locale] };
}
