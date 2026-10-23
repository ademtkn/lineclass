import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NoteForm } from "@/components/NoteForm";
import { NoteList } from "@/components/NoteList";
import { StudentHeader } from "@/components/StudentHeader";
import { requireRole } from "@/lib/auth";
import { subjectLabel, type SubjectNames } from "@/lib/i18n/branches";
import { getStudentNotes, getStudentWithClass } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export default async function StudentDetailPage(props: PageProps<"/teacher/students/[studentId]">) {
  const { studentId } = await props.params;
  const { ders } = await props.searchParams;
  const profile = await requireRole("branch_teacher", "class_teacher");
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [student, notes] = await Promise.all([
    getStudentWithClass(supabase, studentId),
    getStudentNotes(supabase, studentId),
  ]);
  if (!student) notFound();

  // Öğretmenin bu sınıftaki dersleri; not seçili derse bağlanır, liste o derse göre süzülür
  const { data: mySubjects } = await supabase
    .from("class_subjects")
    .select("id, subject, names")
    .eq("class_id", student.class_id)
    .eq("teacher_id", profile.id)
    .order("created_at");
  const subjects = mySubjects ?? [];
  const current = subjects.find((x) => x.id === ders) ?? subjects[0] ?? null;
  const shown = current && subjects.length > 1 ? notes.filter((n) => !n.subject_id || n.subject_id === current.id) : notes;

  // Branş öğretmeni burada yalnızca kendi notlarını görür (RLS); sınıf öğretmeni tümünü.
  return (
    <>
      <AppHeader
        profile={profile}
        title={`${student.first_name} ${student.last_name}`}
        backHref={`/teacher/classes/${student.class_id}${current ? `?ders=${current.id}` : ""}`}
      />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <StudentHeader student={student} className={student.class?.name} />
        {subjects.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {subjects.map((x) => (
              <Link
                key={x.id}
                href={`/teacher/students/${studentId}?ders=${x.id}`}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ${
                  x.id === current?.id ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200"
                }`}
              >
                {subjectLabel(x.subject, x.names as SubjectNames, locale)}
              </Link>
            ))}
          </div>
        )}
        <NoteForm studentId={student.id} subjectId={current?.id ?? null} />
        <section>
          <h2 className="mb-3 text-lg font-bold">
            {t("notes.heading")}{" "}
            <span className="text-slate-400">({shown.length})</span>
          </h2>
          <NoteList notes={shown} canManage={student.class?.class_teacher_id === profile.id} />
        </section>
      </main>
    </>
  );
}
