import { updateNote } from "@/app/admin/actions";
import { deleteNote } from "@/app/teacher/actions";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TranslateBox } from "@/components/TranslateBox";
import { formatDateTime } from "@/lib/format";
import { branchLabel, subjectLabel, type SubjectNames } from "@/lib/i18n/branches";
import { getT } from "@/lib/i18n/server";
import { STATUS_META, type Note, type NoteStatus } from "@/lib/types";

export type NoteWithTeacher = Note & {
  teacher: { full_name: string; branch: string | null } | null;
  subject?: { subject: string; names: SubjectNames | null } | null;
};

type Props = {
  notes: NoteWithTeacher[];
  currentUserId?: string;
  /** Sınıf öğretmeni: notları düzeltebilir ve silebilir. Yazan öğretmen kendi notunu değiştiremez. */
  canManage?: boolean;
  emptyText?: string;
};

/** Kronolojik not listesi: kim, ne zaman, hangi notu yazmış + çeviri. */
export async function NoteList({ notes, canManage = false, emptyText }: Props) {
  const { t, locale } = await getT();
  if (notes.length === 0) {
    return <p className="card text-center text-slate-500">{emptyText ?? t("notes.empty")}</p>;
  }

  return (
    <ol className="space-y-3">
      {notes.map((n) => {
        const meta = STATUS_META[n.status];
        return (
          <li key={n.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{n.teacher?.full_name || t("notes.teacherFallback")}</p>
                <p className="text-xs text-slate-500">
                  {n.subject ? (
                    <>{subjectLabel(n.subject.subject, n.subject.names, locale)} · </>
                  ) : (
                    n.teacher?.branch && <>{branchLabel(n.teacher.branch, locale)} · </>
                  )}
                  <time dateTime={n.created_at}>{formatDateTime(n.created_at, locale)}</time>
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.className}`}>
                {meta.emoji} {t(`status.${n.status}`)}
              </span>
            </div>

            <p className="mt-3 whitespace-pre-wrap leading-relaxed">{n.note_text}</p>

            <TranslateBox noteId={n.id} />

            {canManage && (
              <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                <details>
                  <summary className="inline-flex min-h-9 cursor-pointer list-none items-center text-xs text-brand-700 underline">
                    ✎ {t("noteEdit.edit")}
                  </summary>
                  <div className="mt-2">
                    <ActionForm action={updateNote} submitLabel={t("common.save")} resetOnSuccess={false}>
                      <input type="hidden" name="note_id" value={n.id} />
                      <input type="hidden" name="student_id" value={n.student_id} />
                      <textarea name="note_text" rows={3} maxLength={4000} required defaultValue={n.note_text} className="input py-3" />
                      <select name="status" defaultValue={n.status} className="input">
                        {(Object.keys(STATUS_META) as NoteStatus[]).map((st) => (
                          <option key={st} value={st}>{STATUS_META[st].emoji} {t(`status.${st}`)}</option>
                        ))}
                      </select>
                    </ActionForm>
                  </div>
                </details>
                <form action={deleteNote} className="text-right">
                  <input type="hidden" name="note_id" value={n.id} />
                  <input type="hidden" name="student_id" value={n.student_id} />
                  <ConfirmButton message={t("noteEdit.deleteConfirm")} className="min-h-9 px-2 text-xs text-slate-400 hover:text-red-600">
                    {t("common.delete")}
                  </ConfirmButton>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
