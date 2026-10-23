"use client";

import { useActionState } from "react";
import {
  approveApplication,
  deleteApplication,
  rejectApplication,
  type ApprovalState,
} from "@/app/admin/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useI18n } from "@/lib/i18n/client";

export type Application = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  school: string;
  class_name: string;
  city: string | null;
  address: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

/** Tek başvuru: bilgiler + onay/red. Onayda üretilen geçici şifre yalnızca burada, bir kez gösterilir. */
export function ApplicationCard({ app }: { app: Application }) {
  const { t, locale } = useI18n();
  const [state, approve, pending] = useActionState<ApprovalState, FormData>(approveApplication, {});
  const phoneDigits = app.phone.replace(/[^\d]/g, "");
  const when = new Date(app.created_at).toLocaleDateString(locale === "ky" ? "ky-KG" : locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const rows: [string, string][] = [
    [t("apply.school"), app.school],
    [t("apply.className"), app.class_name],
    [t("apply.address"), [app.address, app.city].filter(Boolean).join(", ")],
    [t("users.email"), app.email],
    [t("apply.phone"), app.phone],
  ];

  return (
    <li className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{app.full_name}</p>
          <p className="text-xs text-slate-500">{when}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
            app.status === "approved"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : app.status === "rejected"
                ? "bg-red-50 text-red-700 ring-red-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          {t(`applications.status.${app.status}`)}
        </span>
      </div>

      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="break-words font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {app.message && <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{app.message}</p>}

      <div className="flex flex-wrap gap-2 text-sm">
        <a className="btn-ghost min-h-10 px-4 text-sm" href={`tel:${app.phone}`}>📞 {t("applications.call")}</a>
        {phoneDigits && (
          <a className="btn-ghost min-h-10 px-4 text-sm" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        )}
        <a className="btn-ghost min-h-10 px-4 text-sm" href={`mailto:${app.email}`}>✉️ {t("applications.mail")}</a>
      </div>

      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      {state.password && (
        <div className="space-y-1 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <p className="font-semibold">{state.ok}</p>
          <p>{t("users.email")}: <strong className="select-all">{state.email}</strong></p>
          <p>{t("applications.tempPassword")}: <strong className="select-all font-mono text-base">{state.password}</strong></p>
          {state.className && <p>{t("applications.classCreated", { name: state.className })}</p>}
          <p className="text-xs">{t("applications.shareHint")}</p>
        </div>
      )}

      {app.status === "pending" && (
        <div className="flex gap-2">
          <form action={approve} className="flex-1">
            <input type="hidden" name="application_id" value={app.id} />
            <button disabled={pending} className="btn-primary w-full">
              {pending ? t("common.saving") : t("applications.approve")}
            </button>
          </form>
          <form action={rejectApplication}>
            <input type="hidden" name="application_id" value={app.id} />
            <ConfirmButton
              message={t("applications.rejectConfirm", { name: app.full_name })}
              className="btn-ghost text-red-600"
            >
              {t("applications.reject")}
            </ConfirmButton>
          </form>
        </div>
      )}

      {app.status !== "pending" && !state.password && (
        <form action={deleteApplication} className="text-right">
          <input type="hidden" name="application_id" value={app.id} />
          <ConfirmButton
            message={t("applications.deleteConfirm")}
            className="min-h-10 rounded-xl px-3 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            {t("common.delete")}
          </ConfirmButton>
        </form>
      )}
    </li>
  );
}
