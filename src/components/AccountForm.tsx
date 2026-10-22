"use client";

import { useActionState } from "react";
import { updateAccount, type AccountState } from "@/app/profile/actions";
import { BRANCHES, branchLabel } from "@/lib/i18n/branches";
import { useI18n } from "@/lib/i18n/client";

type Props = { fullName: string; branch: string | null; email: string };

/** Sınıf öğretmeni / yönetici profil ayarları: bilgiler + e-posta ve şifre. */
export function AccountForm({ fullName, branch, email }: Props) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<AccountState, FormData>(updateAccount, {});

  return (
    <form action={action} className="space-y-5">
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">{t("account.info")}</h2>
        <div>
          <label htmlFor="full_name" className="label">{t("profile.fullName")}</label>
          <input id="full_name" name="full_name" defaultValue={fullName} required autoComplete="name" className="input" />
        </div>
        <div>
          <label htmlFor="branch" className="label">{t("users.branch")}</label>
          <select id="branch" name="branch" defaultValue={branch ?? ""} className="input">
            <option value="">—</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>{branchLabel(b, locale)}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">{t("account.security")}</h2>
        <div>
          <label htmlFor="email" className="label">{t("account.email")}</label>
          <input id="email" name="email" type="email" defaultValue={email} required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">{t("account.newPassword")}</label>
          <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" className="input" />
        </div>
        <div>
          <label htmlFor="password2" className="label">{t("account.newPassword2")}</label>
          <input id="password2" name="password2" type="password" minLength={8} autoComplete="new-password" className="input" />
        </div>
        <div>
          <label htmlFor="current_password" className="label">{t("account.currentPassword")}</label>
          <input id="current_password" name="current_password" type="password" autoComplete="current-password" className="input" />
          <p className="mt-1 text-xs text-slate-500">{t("account.currentHint")}</p>
        </div>
      </section>

      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}

      <button disabled={pending} className="btn-primary w-full">
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}
