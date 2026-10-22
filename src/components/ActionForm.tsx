"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/client";

type State = { error?: string; ok?: string };

type Props = {
  action: (prev: State, fd: FormData) => Promise<State>;
  submitLabel: string;
  children: ReactNode;
  className?: string;
  /** Başarıda formu boşalt (ekleme formları için); düzenleme formlarında false */
  resetOnSuccess?: boolean;
};

/** Hata/başarı mesajı gösteren ve başarıda kendini sıfırlayan genel form sarmalayıcı. */
export function ActionForm({ action, submitLabel, children, className = "", resetOnSuccess = true }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={`space-y-3 ${className}`}>
      {children}
      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? t("common.saving") : submitLabel}
      </button>
    </form>
  );
}
