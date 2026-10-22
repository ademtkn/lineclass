"use client";

import { useState, useTransition } from "react";

type Props = {
  className: string;
  url: string;
  regenerate: () => Promise<void>;
};

/** Sınıfa özel davet linki: kopyala, WhatsApp/paylaş, yenile. */
export function InviteLinkCard({ className, url, regenerate }: Props) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  // Ekranda protokolsüz, sade gösterim: class.line.kg/5a-k7m2qxp
  const { host, pathname } = new URL(url);
  const code = pathname.slice(1);
  const message = `${className} sınıfı · LineClass not girişi (şifre gerekmez):\n${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Linki kopyalayın:", url);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `LineClass · ${className}`, text: message });
        return;
      } catch {
        // kullanıcı paylaşımı iptal etti
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  function onRegenerate() {
    if (!confirm("Yeni link oluşturulsun mu? Eski link çalışmayı durdurur (giriş yapmış öğretmenler etkilenmez).")) return;
    startTransition(() => regenerate());
  }

  return (
    <section className="card space-y-3 bg-gradient-to-br from-brand-50 to-white p-5 ring-brand-100">
      <div>
        <h2 className="text-lg font-bold">🔗 Öğretmen davet linki</h2>
        <p className="text-sm text-slate-600">
          Bu linki branş öğretmenlerine gönderin. Şifre girmeden adını ve branşını seçip {className} sınıfına not
          yazabilirler.
        </p>
      </div>

      <button
        type="button"
        onClick={copy}
        title="Kopyalamak için dokunun"
        className="block w-full truncate rounded-2xl bg-white px-4 py-3 text-center text-lg tracking-wide ring-1 ring-slate-200 transition active:scale-[0.99]"
      >
        <span className="text-slate-400">{host}/</span>
        <span className="font-bold text-slate-900">{code}</span>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className="btn-ghost">
          {copied ? "Kopyalandı ✓" : "Kopyala"}
        </button>
        <button type="button" onClick={share} className="btn-primary">
          Paylaş
        </button>
      </div>

      <button
        type="button"
        onClick={onRegenerate}
        disabled={pending}
        className="w-full text-center text-xs text-slate-500 underline disabled:opacity-50"
      >
        {pending ? "Yenileniyor…" : "Link yanlış kişiye gittiyse: yeni link oluştur"}
      </button>
    </section>
  );
}
