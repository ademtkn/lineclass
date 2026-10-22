import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NoteList } from "@/components/NoteList";
import { StudentHeader } from "@/components/StudentHeader";
import { requireRole } from "@/lib/auth";
import { getStudentNotes, getStudentWithClass } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { STATUS_META, type NoteStatus } from "@/lib/types";

export default async function AdminStudentPage(props: PageProps<"/admin/students/[studentId]">) {
  const { studentId } = await props.params;
  const profile = await requireRole("super_admin", "class_teacher");
  const supabase = await createClient();

  const [student, notes] = await Promise.all([
    getStudentWithClass(supabase, studentId),
    getStudentNotes(supabase, studentId),
  ]);
  if (!student) notFound();

  const summary = (Object.keys(STATUS_META) as NoteStatus[]).map((s) => ({
    ...STATUS_META[s],
    count: notes.filter((n) => n.status === s).length,
  }));

  return (
    <>
      <AppHeader
        profile={profile}
        title={`${student.first_name} ${student.last_name}`}
        backHref={`/admin?class=${student.class_id}`}
      />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <StudentHeader student={student} className={student.class?.name} />

        <div className="grid grid-cols-3 gap-2">
          {summary.map((s) => (
            <div key={s.label} className={`rounded-2xl p-3 text-center ring-1 ${s.className}`}>
              <div className="text-2xl font-bold">{s.count}</div>
              <div className="text-xs font-medium">
                {s.emoji} {s.label}
              </div>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-3 text-lg font-bold">
            Öğretmen yorumları <span className="text-slate-400">({notes.length})</span>
          </h2>
          <NoteList
            notes={notes}
            currentUserId={profile.id}
            canDeleteAll={profile.role === "super_admin"}
            emptyText="Bu öğrenci hakkında henüz yorum yazılmamış."
          />
        </section>
      </main>
    </>
  );
}
