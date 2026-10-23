import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PhotoInput } from "@/components/PhotoInput";
import { NoteList } from "@/components/NoteList";
import { StudentHeader } from "@/components/StudentHeader";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getStudentNotes, getStudentWithClass } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { STATUS_META, type NoteStatus } from "@/lib/types";
import { deleteStudent, setStudentActive, updateStudent } from "../../actions";

/** Sınıf öğretmeni: öğrencinin tüm notları + bilgilerini/fotoğrafını düzenleme. */
export default async function AdminStudentPage(props: PageProps<"/admin/students/[studentId]">) {
  const { studentId } = await props.params;
  const { edit } = await props.searchParams;
  const profile = await requireRole("class_teacher");
  const { t } = await getT();
  const supabase = await createClient();

  const [student, notes] = await Promise.all([
    getStudentWithClass(supabase, studentId),
    getStudentNotes(supabase, studentId),
  ]);
  if (!student) notFound();

  const summary = (Object.keys(STATUS_META) as NoteStatus[]).map((s) => ({
    status: s,
    ...STATUS_META[s],
    count: notes.filter((n) => n.status === s).length,
  }));
  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <>
      <AppHeader profile={profile} title={fullName} backHref={`/admin?class=${student.class_id}`} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {!student.active && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
            {t("student.passiveBanner")}
          </p>
        )}
        <StudentHeader student={student} className={student.class?.name} />

        <details open={edit === "1"} className="card">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold text-brand-700">
            ✎ {t("common.edit")}
            <span className="text-slate-400">▾</span>
          </summary>
          <div className="mt-3 space-y-4">
            <ActionForm action={updateStudent} submitLabel={t("manage.saveStudent")} resetOnSuccess={false}>
              <input type="hidden" name="student_id" value={student.id} />
              <input type="hidden" name="class_id" value={student.class_id} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="first_name">{t("manage.firstName")}</label>
                  <input id="first_name" name="first_name" defaultValue={student.first_name} required className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="last_name">{t("manage.lastName")}</label>
                  <input id="last_name" name="last_name" defaultValue={student.last_name} required className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="short_info">{t("manage.shortInfo")}</label>
                <textarea
                  id="short_info"
                  name="short_info"
                  rows={3}
                  maxLength={500}
                  defaultValue={student.short_info ?? ""}
                  className="input py-3"
                />
              </div>
              <label className="block">
                <span className="label">{t("manage.changePhoto")}</span>
                <PhotoInput />
              </label>
            </ActionForm>
            <form action={setStudentActive} className="border-t border-slate-100 pt-3">
              <input type="hidden" name="student_id" value={student.id} />
              <input type="hidden" name="class_id" value={student.class_id} />
              <input type="hidden" name="active" value={student.active ? "0" : "1"} />
              <input type="hidden" name="redirect" value="1" />
              <button className="btn-ghost w-full">
                {student.active ? t("student.makePassive") : t("student.makeActive")}
              </button>
              <p className="mt-1 text-center text-xs text-slate-500">{t("student.passiveHint")}</p>
            </form>
            <form action={deleteStudent} className="pt-1 text-center">
              <input type="hidden" name="student_id" value={student.id} />
              <input type="hidden" name="class_id" value={student.class_id} />
              <input type="hidden" name="redirect" value="1" />
              <ConfirmButton
                message={t("manage.deleteStudentConfirm", { name: fullName })}
                className="min-h-11 rounded-xl px-4 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                {t("common.delete")}
              </ConfirmButton>
            </form>
          </div>
        </details>

        <div className="grid grid-cols-3 gap-2">
          {summary.map((s) => (
            <div key={s.status} className={`rounded-2xl p-3 text-center ring-1 ${s.className}`}>
              <div className="text-2xl font-bold">{s.count}</div>
              <div className="text-xs font-medium">
                {s.emoji} {t(`status.${s.status}`)}
              </div>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-3 text-lg font-bold">
            {t("studentAdmin.comments")} <span className="text-slate-400">({notes.length})</span>
          </h2>
          <NoteList notes={notes} currentUserId={profile.id} emptyText={t("studentAdmin.noComments")} />
        </section>
      </main>
    </>
  );
}
