"use client";

import { useEffect } from "react";

/** Beklenmeyen hata / bağlantı sorunu: kullanıcıyı çıkarmadan tekrar denemeyi sunar. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-5xl" aria-hidden>
        📶
      </p>
      <h1 className="mt-4 text-xl font-bold">Bağlantı sorunu</h1>
      <p className="mt-2 max-w-xs text-slate-600">
        Sunucuya şu an ulaşılamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.
      </p>
      <button type="button" onClick={() => retry()} className="btn-primary mt-6 w-full max-w-xs">
        Tekrar dene
      </button>
    </main>
  );
}
