"use client";

import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import { addNote, type FormState } from "@/app/teacher/actions";
import { STATUS_META, type NoteStatus } from "@/lib/types";

const VOICE_LANGS = [
  { code: "tr-TR", label: "TR" },
  { code: "ky-KG", label: "KG" },
  { code: "ru-RU", label: "RU" },
  { code: "en-US", label: "EN" },
];

// Web Speech API tarayıcı tipleri (Chrome/Safari'de webkit önekli)
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> ; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

export function NoteForm({ studentId }: { studentId: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<NoteStatus>("neutral");
  const [voiceLang, setVoiceLang] = useState("tr-TR");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceSupported = useSyncExternalStore(noopSubscribe, () => getRecognitionCtor() !== null, () => false);

  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await addNote(prev, fd);
    // Başarılı kayıttan sonra formu temizle
    if (result.ok) {
      setText("");
      setStatus("neutral");
    }
    return result;
  }, {});

  function toggleVoice() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = voiceLang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
      }
      if (chunk) setText((t) => (t ? `${t.trimEnd()} ${chunk.trim()}` : chunk.trim()));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="status" value={status} />

      <h2 className="text-lg font-bold">Yeni not / gözlem</h2>

      <div className="flex gap-2" role="radiogroup" aria-label="Durum">
        {(Object.keys(STATUS_META) as NoteStatus[]).map((s) => {
          const meta = STATUS_META[s];
          const active = s === status;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setStatus(s)}
              className={`flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold ring-1 transition ${
                active ? `${meta.className} ring-2` : "bg-white text-slate-500 ring-slate-200"
              }`}
            >
              <span aria-hidden>{meta.emoji}</span>
              {meta.label}
            </button>
          );
        })}
      </div>

      <textarea
        name="note_text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        maxLength={4000}
        required
        placeholder="Ders içi gözleminizi yazın…"
        className="input min-h-36 resize-y py-3 leading-relaxed"
      />

      {voiceSupported && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleVoice}
            className={`btn flex-1 ${listening ? "animate-pulse bg-red-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            <span aria-hidden>🎤</span>
            {listening ? "Dinleniyor… durdur" : "Sesle yaz"}
          </button>
          <select
            value={voiceLang}
            onChange={(e) => setVoiceLang(e.target.value)}
            disabled={listening}
            aria-label="Konuşma dili"
            className="input w-20 px-3"
          >
            {VOICE_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && !pending && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Not kaydedildi ✓</p>}

      <button disabled={pending || !text.trim()} className="btn-primary w-full">
        {pending ? "Kaydediliyor…" : "Notu Kaydet"}
      </button>
    </form>
  );
}
