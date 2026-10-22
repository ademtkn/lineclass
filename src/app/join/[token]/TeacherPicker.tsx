"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { BRANCHES } from "@/lib/types";
import type { JoinState } from "./actions";

type Teacher = { id: string; full_name: string; branch: string | null };

type Props = {
  teachers: Teacher[];
  joinExisting: (fd: FormData) => Promise<void>;
  joinNew: (prev: JoinState, fd: FormData) => Promise<JoinState>;
};

/** Önce branş, sonra isim: o branştaki kayıtlı öğretmenler tek dokunuşla, yoksa ad yazılır. */
export function TeacherPicker({ teachers, joinExisting, joinNew }: Props) {
  const [branch, setBranch] = useState<string | null>(null);
  const [typingNew, setTypingNew] = useState(false);
  const [state, newAction] = useActionState<JoinState, FormData>(joinNew, {});

  // Bu sınıfta öğretmeni olan branşlar önce, sonra diğerleri
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    teachers.forEach((t) => t.branch && m.set(t.branch, (m.get(t.branch) ?? 0) + 1));
    return m;
  }, [teachers]);
  const branches = useMemo(
    () => [...BRANCHES].sort((a, b) => Number(counts.has(b)) - Number(counts.has(a))),
    [counts],
  );
  const inBranch = teachers.filter((t) => t.branch === branch);
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
                counts.has(b) ? "bg-white text-slate-800 ring-brand-200 shadow-sm" : "bg-slate-50 text-slate-600 ring-slate-200"
              }`}
            >
              {b}
              {counts.has(b) && (
                <span className="text-[11px] font-medium text-brand-600">{counts.get(b)} öğretmen</span>
              )}
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
