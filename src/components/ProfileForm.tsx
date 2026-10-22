"use client";

import { useActionState } from "react";
import { updateProfile, type FormState } from "@/app/teacher/actions";
import { BRANCHES, branchLabel } from "@/lib/i18n/branches";
import { useI18n } from "@/lib/i18n/client";

type Props = { fullName: string; branch: string | null };

/** "Branşını ve adını seç" adımı. */
export function ProfileForm({ fullName, branch }: Props) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {});

  return (
    <form action={action} className="card space-y-5 p-5">
      <div>
        <label htmlFor="full_name" className="label">{t("profile.fullName")}</label>
        <input id="full_name" name="full_name" defaultValue={fullName} required className="input" />
      </div>

      <fieldset>
        <legend className="label">{t("profile.branch")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BRANCHES.map((b) => (
            <label key={b} className="cursor-pointer">
              <input
                type="radio"
                name="branch"
                value={b}
                defaultChecked={b === branch}
                required
                className="peer sr-only"
              />
              <span className="flex min-h-12 items-center justify-center rounded-2xl bg-slate-50 px-3 text-center text-sm font-medium ring-1 ring-slate-200 peer-checked:bg-brand-600 peer-checked:text-white peer-checked:ring-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
                {branchLabel(b, locale)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <button disabled={pending} className="btn-primary w-full">
        {pending ? t("common.saving") : t("profile.continue")}
      </button>
    </form>
  );
}
