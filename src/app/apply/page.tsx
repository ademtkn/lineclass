import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getT } from "@/lib/i18n/server";
import { ApplyForm } from "./ApplyForm";

/** Herkese açık sayfa: yeni sınıf öğretmenleri buradan başvurur, yönetici onaylar. */
export default async function ApplyPage() {
  const { t } = await getT();
  return (
    <main className="flex flex-1 flex-col px-5 py-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/login" className="text-sm text-brand-700 underline">← {t("common.back")}</Link>
          <LanguageSwitcher />
        </div>
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="LineClass" className="mx-auto mb-3 h-14 w-auto" />
          <h1 className="text-2xl font-bold tracking-tight">{t("apply.title")}</h1>
          <p className="mt-1 text-slate-500">{t("apply.subtitle")}</p>
        </div>
        <ApplyForm />
      </div>
    </main>
  );
}
