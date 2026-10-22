"use client";

import { useState } from "react";
import { LANGS, type Lang } from "@/lib/types";

/** Notun altındaki "Yapay Zeka ile Çevir (EN / KG / RU / TR)" butonları ve sonuç kutusu. */
export function TranslateBox({ noteId }: { noteId: string }) {
  const [active, setActive] = useState<Lang | null>(null);
  const [results, setResults] = useState<Partial<Record<Lang, string>>>({});
  const [loading, setLoading] = useState<Lang | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function translate(lang: Lang) {
    setActive(lang);
    setError(null);
    if (results[lang]) return;

    setLoading(lang);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Çeviri başarısız");
      setResults((r) => ({ ...r, [lang]: data.text }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Çeviri başarısız");
    } finally {
      setLoading(null);
    }
  }

  const shown = active ? results[active] : undefined;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="basis-full text-xs font-medium text-slate-500 sm:basis-auto">✨ Yapay Zeka ile Çevir</span>
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => translate(l.code)}
            disabled={loading !== null}
            className={`min-h-9 min-w-11 rounded-xl px-3 text-xs font-bold ring-1 transition ${
              active === l.code
                ? "bg-brand-600 text-white ring-brand-600"
                : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {loading === l.code ? "…" : l.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {shown && (
        <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-brand-50 p-3 text-sm leading-relaxed text-slate-800">
          {shown}
        </p>
      )}
    </div>
  );
}
