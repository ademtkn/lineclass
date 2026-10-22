"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { NoteForm } from "@/components/NoteForm";
import type { Student } from "@/lib/types";

type Props = {
  students: Student[];
  /** Bugün bu öğretmenin not yazdığı öğrenciler */
  notedTodayIds: string[];
};

/** Öğretmenin sınıf ekranı: arama, bugünkü ilerleme ve sayfadan çıkmadan hızlı not. */
export function ClassRoster({ students, notedTodayIds }: Props) {
  const [query, setQuery] = useState("");
  const [noted, setNoted] = useState(() => new Set(notedTodayIds));
  const [active, setActive] = useState<Student | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const q = query.trim().toLocaleLowerCase("tr");
  const visible = q
    ? students.filter((s) => `${s.first_name} ${s.last_name}`.toLocaleLowerCase("tr").includes(q))
    : students;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function onSaved(s: Student) {
    setNoted((prev) => new Set(prev).add(s.id));
    setActive(null);
    setToast(`${s.first_name} için not kaydedildi ✓`);
  }

  if (students.length === 0) {
    return <p className="card text-center text-slate-500">Bu sınıfta henüz öğrenci yok.</p>;
  }

  return (
    <>
      <div className="sticky top-[68px] z-10 -mx-4 mb-3 bg-slate-50/95 px-4 pb-2 pt-1 backdrop-blur">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍  Öğrenci ara…"
          className="input"
          aria-label="Öğrenci ara"
        />
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(noted.size / students.length) * 100}%` }}
            />
          </div>
          Bugün {noted.size}/{students.length} öğrenciye not
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="card text-center text-slate-500">“{query}” ile eşleşen öğrenci yok.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((s) => {
            const done = noted.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setActive(s)}
                  className={`card relative flex h-full w-full flex-col items-center gap-2 py-5 text-center transition active:scale-[0.98] ${
                    done ? "ring-2 ring-emerald-300" : ""
                  }`}
                >
                  {done && (
                    <span
                      className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white"
                      aria-label="Bugün not yazıldı"
                    >
                      ✓
                    </span>
                  )}
                  <Avatar firstName={s.first_name} lastName={s.last_name} photoUrl={s.photo_url} />
                  <span className="font-semibold leading-tight">
                    {s.first_name}
                    <br />
                    {s.last_name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {active && <QuickNoteSheet student={active} onClose={() => setActive(null)} onSaved={() => onSaved(active)} />}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-sm rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  );
}

function QuickNoteSheet({ student, onClose, onSaved }: { student: Student; onClose: () => void; onSaved: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`${student.first_name} ${student.last_name} için not`}>
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
        <div className="mb-4 flex items-center gap-3">
          <Avatar firstName={student.first_name} lastName={student.last_name} photoUrl={student.photo_url} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">
              {student.first_name} {student.last_name}
            </p>
            {student.short_info && <p className="truncate text-sm text-slate-500">{student.short_info}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="grid size-11 place-items-center rounded-2xl text-xl text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <NoteForm studentId={student.id} onSaved={onSaved} compact />

        <Link href={`/teacher/students/${student.id}`} className="mt-4 block text-center text-sm text-brand-700 underline">
          Bu öğrenciye yazdığım tüm notlar →
        </Link>
      </div>
    </div>
  );
}
