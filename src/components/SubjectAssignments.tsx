"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { addSubject, deleteSubject, setSubjectTeacher } from "@/app/admin/actions";
import { BRANCHES } from "@/lib/types";

type Subject = { id: string; subject: string; teacher_id: string | null };
type Teacher = { id: string; full_name: string; email: string; branch: string | null };

type Props = {
  classId: string;
  subjects: Subject[];
  teachers: Teacher[];
};

/** Sınıfın dersleri: her derse tek dokunuşla öğretmen seçimi, eksik dersleri çiple ekleme. */
export function SubjectAssignments({ classId, subjects, teachers }: Props) {
  const [custom, setCustom] = useState("");
  const existing = new Set(subjects.map((s) => s.subject));
  const missing = BRANCHES.filter((b) => !existing.has(b));
  const unassignedCount = subjects.filter((s) => !s.teacher_id).length;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Dersler ve öğretmenleri</h2>
        {subjects.length > 0 && (
          <span className={`text-xs font-medium ${unassignedCount ? "text-amber-700" : "text-emerald-700"}`}>
            {unassignedCount ? `${unassignedCount} ders öğretmensiz` : "Tüm dersler atandı ✓"}
          </span>
        )}
      </div>

      {subjects.length === 0 && (
        <p className="card text-sm text-slate-500">
          Henüz ders eklenmedi. Aşağıdan bu sınıfta okutulan dersleri seçin, sonra her derse öğretmen atayın.
        </p>
      )}

      {subjects.length > 0 && (
        <ul className="card divide-y divide-slate-100 p-0">
          {subjects.map((s) => (
            <SubjectRow key={s.id} classId={classId} subject={s} teachers={teachers} />
          ))}
        </ul>
      )}

      {/* Ders ekleme: hazır branş çipleri + özel ders adı */}
      <div className="card space-y-3">
        <p className="text-sm font-medium text-slate-600">Ders ekle</p>
        {missing.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {missing.map((b) => (
              <form key={b} action={addSubject}>
                <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="subject" value={b} />
                <ChipButton label={b} />
              </form>
            ))}
          </div>
        )}
        <form
          action={async (fd) => {
            await addSubject(fd);
            setCustom("");
          }}
          className="flex gap-2"
        >
          <input type="hidden" name="class_id" value={classId} />
          <input
            name="subject"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={60}
            placeholder="Başka ders adı (örn: Robotik)"
            className="input min-w-0 flex-1"
          />
          <button disabled={!custom.trim()} className="btn-ghost shrink-0">
            Ekle
          </button>
        </form>
      </div>
    </section>
  );
}

function SubjectRow({ classId, subject, teachers }: { classId: string; subject: Subject; teachers: Teacher[] }) {
  // Dersin branşındaki öğretmenler önce önerilir
  const matching = teachers.filter((t) => t.branch === subject.subject);
  const others = teachers.filter((t) => t.branch !== subject.subject);
  const label = (t: Teacher) => `${t.full_name || t.email}${t.branch ? ` (${t.branch})` : ""}`;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span className="min-w-24 flex-1 font-semibold">{subject.subject}</span>
      <form action={setSubjectTeacher} className="flex min-w-0 flex-[2] basis-56 items-center gap-2">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="subject_id" value={subject.id} />
        <select
          name="teacher_id"
          defaultValue={subject.teacher_id ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          aria-label={`${subject.subject} öğretmeni`}
          className={`input min-h-11 min-w-0 flex-1 py-0 text-sm ${subject.teacher_id ? "" : "text-amber-700 ring-amber-300"}`}
        >
          <option value="">— Öğretmen seçin —</option>
          {matching.length > 0 && (
            <optgroup label={`${subject.subject} branşı`}>
              {matching.map((t) => (
                <option key={t.id} value={t.id}>{label(t)}</option>
              ))}
            </optgroup>
          )}
          <optgroup label={matching.length ? "Diğer öğretmenler" : "Öğretmenler"}>
            {others.map((t) => (
              <option key={t.id} value={t.id}>{label(t)}</option>
            ))}
          </optgroup>
        </select>
        <SavingDot />
      </form>
      <form action={deleteSubject}>
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="subject_id" value={subject.id} />
        <button
          aria-label={`${subject.subject} dersini kaldır`}
          className="grid size-10 place-items-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
        >
          ✕
        </button>
      </form>
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
