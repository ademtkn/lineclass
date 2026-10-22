"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  addSubject,
  deleteSubject,
  setSubjectTeacher,
  updateSubjectNames,
  type FormState,
} from "@/app/admin/actions";
import { BRANCHES, BRANCH_NAMES, branchLabel, subjectLabel, type SubjectNames } from "@/lib/i18n/branches";
import { useI18n } from "@/lib/i18n/client";
import { LOCALES, LOCALE_META } from "@/lib/i18n/locales";

type Subject = { id: string; subject: string; names: SubjectNames | null; teacher_id: string | null };
type Teacher = { id: string; full_name: string; branch: string | null };

type Props = {
  classId: string;
  subjects: Subject[];
  teachers: Teacher[];
};

/** Sınıfın dersleri: her derse tek dokunuşla öğretmen seçimi, eksik dersleri çiple ekleme, 4 dilde ad. */
export function SubjectAssignments({ classId, subjects, teachers }: Props) {
  const { t, locale } = useI18n();
  const existing = new Set(subjects.map((s) => s.subject));
  const missing = BRANCHES.filter((b) => !existing.has(b));
  const unassignedCount = subjects.filter((s) => !s.teacher_id).length;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{t("subjects.title")}</h2>
        {subjects.length > 0 && (
          <span className={`text-xs font-medium ${unassignedCount ? "text-amber-700" : "text-emerald-700"}`}>
            {unassignedCount ? t("subjects.unassigned", { n: unassignedCount }) : t("subjects.allAssigned")}
          </span>
        )}
      </div>

      {subjects.length === 0 && <p className="card text-sm text-slate-500">{t("subjects.empty")}</p>}

      {subjects.length > 0 && (
        <ul className="card divide-y divide-slate-100 p-0">
          {subjects.map((s) => (
            <SubjectRow key={s.id} classId={classId} subject={s} teachers={teachers} />
          ))}
        </ul>
      )}

      {/* Ders ekleme: hazır branş çipleri (4 dildeki adıyla) + 4 dilde özel ders */}
      <div className="card space-y-3">
        <p className="text-sm font-medium text-slate-600">{t("subjects.add")}</p>
        {missing.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {missing.map((b) => (
              <form key={b} action={(fd) => void addSubject({}, fd)}>
                <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="subject" value={b} />
                <ChipButton label={branchLabel(b, locale)} />
              </form>
            ))}
          </div>
        )}
        <details className="group rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <summary className="flex min-h-9 cursor-pointer list-none items-center font-medium text-brand-700">
            + {t("subjects.customTitle")}
          </summary>
          <NamesForm classId={classId} action={addSubject} submitLabel={t("common.add")} reset />
        </details>
      </div>
    </section>
  );
}

/** 4 dilde ders adı formu (yeni ders ekleme ve mevcut dersi düzenleme). */
function NamesForm({
  classId,
  subject,
  action,
  submitLabel,
  reset,
}: {
  classId: string;
  subject?: Subject;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  reset?: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && reset) ref.current?.reset();
  }, [state, reset]);

  return (
    <form ref={ref} action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="class_id" value={classId} />
      {subject && <input type="hidden" name="subject_id" value={subject.id} />}
      {LOCALES.map((l) => (
        <label key={l} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-xs font-bold text-slate-500">{LOCALE_META[l].short}</span>
          <input
            name={`name_${l}`}
            lang={l}
            maxLength={60}
            defaultValue={subject ? (subject.names?.[l] ?? BRANCH_NAMES[subject.subject]?.[l] ?? "") : ""}
            placeholder={LOCALE_META[l].native}
            className="input min-h-11 min-w-0 flex-1 py-0 text-sm"
          />
        </label>
      ))}
      <p className="text-xs text-slate-500">{t("subjects.customHint")}</p>
      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? t("common.saving") : submitLabel}
      </button>
    </form>
  );
}

function SubjectRow({ classId, subject, teachers }: { classId: string; subject: Subject; teachers: Teacher[] }) {
  const { t, locale } = useI18n();
  const name = subjectLabel(subject.subject, subject.names, locale);
  // Dersin branşındaki öğretmenler önce önerilir
  const matching = teachers.filter((x) => x.branch === subject.subject);
  const others = teachers.filter((x) => x.branch !== subject.subject);
  const label = (x: Teacher) =>
    `${x.full_name || t("common.unnamed")}${x.branch ? ` (${branchLabel(x.branch, locale)})` : ""}`;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-24 flex-1 font-semibold">{name}</span>
        <form action={setSubjectTeacher} className="flex min-w-0 flex-[2] basis-56 items-center gap-2">
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="subject_id" value={subject.id} />
          <select
            name="teacher_id"
            defaultValue={subject.teacher_id ?? ""}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            aria-label={t("subjects.teacherOf", { subject: name })}
            className={`input min-h-11 min-w-0 flex-1 py-0 text-sm ${subject.teacher_id ? "" : "text-amber-700 ring-amber-300"}`}
          >
            <option value="">{t("subjects.pickTeacher")}</option>
            {matching.length > 0 && (
              <optgroup label={t("subjects.branchGroup", { subject: name })}>
                {matching.map((x) => (
                  <option key={x.id} value={x.id}>{label(x)}</option>
                ))}
              </optgroup>
            )}
            <optgroup label={matching.length ? t("subjects.otherTeachers") : t("subjects.teachers")}>
              {others.map((x) => (
                <option key={x.id} value={x.id}>{label(x)}</option>
              ))}
            </optgroup>
          </select>
          <SavingDot />
        </form>
        <form action={deleteSubject}>
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="subject_id" value={subject.id} />
          <button
            aria-label={t("subjects.removeLabel", { subject: name })}
            className="grid size-10 place-items-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            ✕
          </button>
        </form>
      </div>
      <details className="mt-1">
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-xs text-brand-700 underline">
          {t("subjects.editNames")}
        </summary>
        <NamesForm classId={classId} subject={subject} action={updateSubjectNames} submitLabel={t("common.save")} />
      </details>
    </li>
  );
}

function ChipButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="min-h-10 rounded-full bg-slate-50 px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
    >
      + {label}
    </button>
  );
}

function SavingDot() {
  const { pending } = useFormStatus();
  return (
    <span className="w-4 text-center text-xs text-slate-400" aria-live="polite">
      {pending ? "…" : ""}
    </span>
  );
}
