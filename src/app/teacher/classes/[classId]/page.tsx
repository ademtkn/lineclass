import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ClassRoster } from "@/components/ClassRoster";
import { requireRole } from "@/lib/auth";
import { isToday, recentSinceIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function ClassStudentsPage(props: PageProps<"/teacher/classes/[classId]">) {
  const { classId } = await props.params;
  const profile = await requireRole("branch_teacher", "class_teacher");
  const supabase = await createClient();

  const since = recentSinceIso();
  const [{ data: cls }, { data: students }, { data: recentNotes }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("id", classId).maybeSingle(),
    supabase
      .from("students")
      .select("id, first_name, last_name, class_id, photo_url, short_info")
      .eq("class_id", classId)
      .order("first_name"),
    // Öğretmenin son notları; "bugün" okulun saat dilimine göre aşağıda süzülür
    supabase
      .from("notes")
      .select("student_id, created_at, students!inner(class_id)")
      .eq("teacher_id", profile.id)
      .eq("students.class_id", classId)
      .gte("created_at", since),
  ]);

  // RLS erişim vermiyorsa sınıf hiç dönmez
  if (!cls) notFound();

  const notedTodayIds = [
    ...new Set((recentNotes ?? []).filter((n) => isToday(n.created_at)).map((n) => n.student_id)),
  ];

  return (
    <>
      <AppHeader profile={profile} title={`${cls.name} Sınıfı`} backHref="/teacher" />
      <main className="mx-auto max-w-5xl px-4 py-3">
        <ClassRoster students={students ?? []} notedTodayIds={notedTodayIds} />
      </main>
    </>
  );
}
