import { deleteNote } from "@/app/teacher/actions";
import { TranslateBox } from "@/components/TranslateBox";
import { formatDateTime } from "@/lib/format";
import { STATUS_META, type Note } from "@/lib/types";

export type NoteWithTeacher = Note & {
  teacher: { full_name: string; branch: string | null } | null;
};

type Props = {
  notes: NoteWithTeacher[];
  currentUserId: string;
  canDeleteAll?: boolean;
  emptyText?: string;
};

/** Kronolojik not listesi: kim, ne zaman, hangi notu yazmış + çeviri. */
export function NoteList({ notes, currentUserId, canDeleteAll = false, emptyText = "Henüz not yok." }: Props) {
  if (notes.length === 0) {
    return <p className="card text-center text-slate-500">{emptyText}</p>;
  }

  return (
    <ol className="space-y-3">
      {notes.map((n) => {
        const meta = STATUS_META[n.status];
        const canDelete = canDeleteAll || n.teacher_id === currentUserId;
        return (
          <li key={n.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{n.teacher?.full_name || "Öğretmen"}</p>
                <p className="text-xs text-slate-500">
                  {n.teacher?.branch && <>{n.teacher.branch} · </>}
                  <time dateTime={n.created_at}>{formatDateTime(n.created_at)}</time>
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.className}`}>
                {meta.emoji} {meta.label}
              </span>
            </div>

            <p className="mt-3 whitespace-pre-wrap leading-relaxed">{n.note_text}</p>

            <TranslateBox noteId={n.id} />

            {canDelete && (
              <form action={deleteNote} className="mt-2 text-right">
                <input type="hidden" name="note_id" value={n.id} />
                <input type="hidden" name="student_id" value={n.student_id} />
                <button className="text-xs text-slate-400 hover:text-red-600">Sil</button>
              </form>
            )}
          </li>
        );
      })}
    </ol>
  );
}
