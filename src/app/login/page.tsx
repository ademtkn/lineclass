"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/client";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <main className="flex flex-1 flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-brand-600 text-2xl font-bold text-white shadow-lg shadow-brand-600/30">
            LC
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LineClass</h1>
          <p className="mt-1 text-slate-500">{t("app.tagline")}</p>
        </div>

        <form action={formAction} className="card space-y-4 p-6">
          <div>
            <label htmlFor="email" className="label">{t("login.email")}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              className="input"
              placeholder={t("login.emailPlaceholder")}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">{t("login.password")}</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>

          {state.error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <Link
          href="/apply"
          className="mt-4 flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
        >
          {t("login.apply")}
        </Link>

        <p className="mt-4 rounded-2xl bg-white/60 px-4 py-3 text-center text-sm text-slate-500 ring-1 ring-slate-100">
          <strong className="text-slate-700">{t("login.branchHintStrong")}</strong> {t("login.branchHintRest")}
        </p>
      </div>
    </main>
  );
}
