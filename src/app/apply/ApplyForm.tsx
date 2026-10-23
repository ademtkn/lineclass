"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { submitApplication, type ApplyState } from "./actions";

/** Sınıf öğretmeni başvuru formu: okul, sınıf, adres ve iletişim bilgileri. */
export function ApplyForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<ApplyState, FormData>(submitApplication, {});

  if (state.ok) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-2xl text-emerald-600">✓</div>
        <h2 className="text-lg font-bold">{t("apply.doneTitle")}</h2>
        <p className="text-sm text-slate-600">{t("apply.doneBody")}</p>
        <Link href="/login" className="btn-ghost w-full">{t("apply.backToLogin")}</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <Field name="full_name" label={t("apply.fullName")} autoComplete="name" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="email" type="email" label={t("users.email")} autoComplete="email" inputMode="email" />
        <Field name="phone" type="tel" label={t("apply.phone")} autoComplete="tel" inputMode="tel" placeholder="+996 …" />
      </div>
      <Field name="school" label={t("apply.school")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="class_name" label={t("apply.className")} placeholder={t("classAdmin.classNamePlaceholder")} maxLength={40} />
        <Field name="city" label={t("apply.city")} required={false} autoComplete="address-level2" />
      </div>
      <div>
        <label htmlFor="address" className="label">{t("apply.address")}</label>
        <textarea id="address" name="address" rows={2} required maxLength={400} autoComplete="street-address" className="input py-3" />
      </div>
      <div>
        <label htmlFor="message" className="label">{t("apply.message")}</label>
        <textarea id="message" name="message" rows={2} maxLength={1000} className="input py-3" />
      </div>

      {/* Bal küpü: insanlara görünmez, botlar doldurur */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p className="text-xs text-slate-500">{t("apply.note")}</p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? t("common.saving") : t("apply.submit")}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = true,
  maxLength = 160,
  ...rest
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: "email" | "tel";
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} type={type} required={required} maxLength={maxLength} className="input" {...rest} />
    </div>
  );
}
