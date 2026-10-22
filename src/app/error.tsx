"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/client";

/** Beklenmeyen hata / bağlantı sorunu: kullanıcıyı çıkarmadan tekrar denemeyi sunar. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-5xl" aria-hidden>
        📶
      </p>
      <h1 className="mt-4 text-xl font-bold">{t("error.title")}</h1>
      <p className="mt-2 max-w-xs text-slate-600">{t("error.body")}</p>
      <button type="button" onClick={() => retry()} className="btn-primary mt-6 w-full max-w-xs">
        {t("error.retry")}
      </button>
    </main>
  );
}
