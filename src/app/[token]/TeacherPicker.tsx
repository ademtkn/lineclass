"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/lib/i18n/client";
import type { JoinState } from "./actions";

type Teacher = { id: string; full_name: string; locked: boolean };

type Props = {
  teachers: Teacher[];
  /** Adı başka cihazda alınmış bir öğretmen girmeye çalışıp geri çevrildi */
  showLockedNotice?: boolean;
  joinExisting: (fd: FormData) => Promise<void>;
  joinNew: (prev: JoinState, fd: FormData) => Promise<JoinState>;
};

/** Önce ad: kayıtlı öğretmenler tek dokunuşla, yoksa ad yazılır. Dersler bir sonraki adımda seçilir. */
export function TeacherPicker({ teachers, showLockedNotice, joinExisting, joinNew }: Props) {
  const { t } = useI18n();
  const [typingNew, setTypingNew] = useState(teachers.length === 0);
  const [state, newAction] = useActionState<JoinState, FormData>(joinNew, {});

  return (
    <section className="space-y-4">
      <h2 className="text-center text-lg font-bold">{typingNew ? t("join.addName") : t("join.pickName")}</h2>

      {showLockedNotice && (
        <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("join.lockedHint")}</p>
      )}

      {!typingNew && (
        <>
          <ul className="grid gap-2">
            {teachers.map((x) => (
              <li key={x.id}>
                {x.locked ? (
                  <div className="card flex min-h-16 w-full items-center justify-between gap-3 bg-slate-50 text-slate-400">
                    <span className="text-lg font-semibold">{x.full_name}</span>
                    <span className="text-xs">🔒 {t("join.locked")}</span>
                  </div>
                ) : (
                  <form action={joinExisting}>
                    <input type="hidden" name="teacher_id" value={x.id} />
                    <TeacherButton name={x.full_name} />
                  </form>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setTypingNew(true)} className="btn-ghost w-full">
            {t("join.notListed")}
          </button>
        </>
      )}

      {typingNew && (
        <form action={newAction} className="card space-y-3 p-5">
          <label htmlFor="full_name" className="label">{t("join.fullName")}</label>
          <input
            id="full_name"
            name="full_name"
            required
            minLength={3}
            autoFocus
            autoComplete="name"
            enterKeyHint="go"
            placeholder={t("join.namePlaceholder")}
            className="input"
          />
          {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <SubmitButton />
          {teachers.length > 0 && (
            <button type="button" onClick={() => setTypingNew(false)} className="w-full text-sm text-slate-500 underline">
              {t("join.backToList")}
            </button>
          )}
        </form>
      )}
    </section>
  );
}

function TeacherButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="card flex min-h-16 w-full items-center justify-between gap-3 text-left text-lg font-semibold transition active:scale-[0.98] disabled:opacity-60"
    >
      {name}
      <span className="text-brand-600" aria-hidden>
        {pending ? "…" : "→"}
      </span>
    </button>
  );
}

function SubmitButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="btn-primary w-full">
      {pending ? t("join.entering") : t("join.next")}
    </button>
  );
}
