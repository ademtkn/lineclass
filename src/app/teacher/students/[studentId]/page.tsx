import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NoteForm } from "@/components/NoteForm";
import { NoteList } from "@/components/NoteList";
import { StudentHeader } from "@/components/StudentHeader";
import { requireRole } from "@/lib/auth";
import { getStudentNotes, getStudentWithClass } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export default async function StudentDetailPage(props: PageProps<"/teacher/students/[studentId]">) {
  const { studentId } = await props.params;
  const profile = await requireRole("branch_teacher", "class_teacher");
  const { t } = await getT();
  const supabase = await createClient();

  const [student, notes] = await Promise.all([
    getStudentWithClass(supabase, studentId),
    getStudentNotes(supabase, studentId),
  ]);
  if (!student) notFound();

  // Branş öğretmeni burada yalnızca kendi notlarını görür (RLS); sınıf öğretmeni tümünü.
  return (
    <>
      <AppHeader
        profile={profile}
        title={`${student.first_name} ${student.last_name}`}
        backHref={`/teacher/classes/${student.class_id}`}
      />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <StudentHeader student={student} className={student.class?.name} />
        <NoteForm studentId={student.id} />
        <section>
          <h2 className="mb-3 text-lg font-bold">
            {t("notes.heading")}{" "}
            <span className="text-slate-400">({notes.length})</span>
          </h2>
          <NoteList notes={notes} currentUserId={profile.id} />
        </section>
      </main>
    </>
  );
}
