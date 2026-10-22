"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { BRANCHES } from "@/lib/types";
import type { JoinState } from "./actions";

type Teacher = { id: string; full_name: string; branch: string | null };
type ClassSubject = { subject: string; teacherId: string | null; teacherName: string | null };

type Props = {
  teachers: Teacher[];
  /** Sınıf öğretmeninin bu sınıfa eklediği dersler ve atanan öğretmenleri */
  classSubjects: ClassSubject[];
  joinExisting: (fd: FormData) => Promise<void>;
  joinNew: (prev: JoinState, fd: FormData) => Promise<JoinState>;
};

/** Önce branş, sonra isim: o branştaki kayıtlı öğretmenler tek dokunuşla, yoksa ad yazılır. */
export function TeacherPicker({ teachers, classSubjects, joinExisting, joinNew }: Props) {
  const [branch, setBranch] = useState<string | null>(null);
  const [typingNew, setTypingNew] = useState(false);
  const [state, newAction] = useActionState<JoinState, FormData>(joinNew, {});

  // Bir branşa basınca listelenecekler: o branştaki öğretmenler + o derse atanmış öğretmen
  const subjectOf = useMemo(() => new Map(classSubjects.map((x) => [x.subject, x])), [classSubjects]);
  const teachersFor = useMemo(
    () => (b: string) =>
      teachers.filter((t) => t.branch === b || (subjectOf.get(b)?.teacherId ?? null) === t.id),
    [teachers, subjectOf],
  );

  // Sıra: öğretmeni olan branşlar → sınıfın diğer dersleri → kalan branşlar
  const branches = useMemo(() => {
    const rank = (b: string) => (teachersFor(b).length ? 0 : subjectOf.has(b) ? 1 : 2);
    const extra = classSubjects.map((x) => x.subject).filter((x) => !BRANCHES.includes(x));
    return [...BRANCHES, ...extra].sort((a, b) => rank(a) - rank(b));
  }, [teachersFor, subjectOf, classSubjects]);
  const inBranch = branch ? teachersFor(branch) : [];
  const showNewForm = branch !== null && (typingNew || inBranch.length === 0);

  if (!branch) {
    return (
      <section>
        <h2 className="mb-3 text-center text-lg font-bold">Branşınız hangisi?</h2>
        <div className="grid grid-cols-2 gap-2">
          {branches.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBranch(b)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-3 text-center font-semibold ring-1 transition active:scale-[0.97] ${
                teachersFor(b).length || subjectOf.has(b)
                  ? "bg-white text-slate-800 ring-brand-200 shadow-sm"
                  : "bg-slate-50 text-slate-600 ring-slate-200"
              }`}
            >
              {b}
              <BranchHint count={teachersFor(b).length} subject={subjectOf.get(b)} />
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{branch}</h2>
        <button
          type="button"
          onClick={() => {
            setBranch(null);
            setTypingNew(false);
          }}
          className="rounded-xl px-3 py-2 text-sm text-brand-700 hover:bg-brand-50"
        >
          Branşı değiştir
        </button>
      </div>

      {!showNewForm && (
        <>
          <p className="text-sm text-slate-600">Adınıza dokunun:</p>
          <ul className="grid gap-2">
            {inBranch.map((t) => (
              <li key={t.id}>
                <form action={joinExisting}>
                  <input type="hidden" name="teacher_id" value={t.id} />
                  <TeacherButton name={t.full_name} />
                </form>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setTypingNew(true)} className="btn-ghost w-full">
            Listede yokum
          </button>
        </>
      )}

      {showNewForm && (
        <form action={newAction} className="card space-y-3 p-5">
          <input type="hidden" name="branch" value={branch} />
          <label htmlFor="full_name" className="label">Adınız Soyadınız</label>
          <input
            id="full_name"
            name="full_name"
            required
            minLength={3}
            autoFocus
            autoComplete="name"
            enterKeyHint="go"
            placeholder="Örn: Mehmet Yılmaz"
            className="input"
          />
          {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <SubmitButton />
          {inBranch.length > 0 && (
            <button type="button" onClick={() => setTypingNew(false)} className="w-full text-sm text-slate-500 underline">
              Listeye geri dön
            </button>
          )}
        </form>
      )}
    </section>
  );
}

function BranchHint({ count, subject }: { count: number; subject?: ClassSubject }) {
  if (count) return <span className="text-[11px] font-medium text-brand-600">{count} öğretmen</span>;
  if (subject?.teacherName)
    return <span className="max-w-full truncate text-[11px] font-medium text-slate-500">{subject.teacherName}</span>;
  if (subject) return <span className="text-[11px] font-medium text-amber-600">öğretmen bekleniyor</span>;
  return null;
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
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="btn-primary w-full">
      {pending ? "Giriliyor…" : "Sınıfa Gir"}
    </button>
  );
}
