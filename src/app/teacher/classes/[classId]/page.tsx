import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ClassRoster } from "@/components/ClassRoster";
import { requireRole } from "@/lib/auth";
import { subjectLabel, type SubjectNames } from "@/lib/i18n/branches";
import { isToday, recentSinceIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export default async function ClassStudentsPage(props: PageProps<"/teacher/classes/[classId]">) {
  const { classId } = await props.params;
  const { ders } = await props.searchParams;
  const { locale } = await getT();
  const profile = await requireRole("branch_teacher", "class_teacher");
  const supabase = await createClient();
  const { t } = await getT();

  const since = recentSinceIso();
  const [{ data: cls }, { data: students }, { data: recentNotes }, { data: mySubjects }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("id", classId).maybeSingle(),
    supabase
      .from("students")
      .select("id, first_name, last_name, class_id, photo_url, short_info")
      .eq("class_id", classId)
      .eq("active", true)
      .order("first_name")
      .order("last_name"),
    // Öğretmenin son notları; "bugün" okulun saat dilimine göre aşağıda süzülür
    supabase
      .from("notes")
      .select("student_id, subject_id, created_at, students!inner(class_id)")
      .eq("teacher_id", profile.id)
      .eq("students.class_id", classId)
      .gte("created_at", since),
    // Öğretmenin bu sınıfta girdiği dersler: üstteki sekmeler
    supabase
      .from("class_subjects")
      .select("id, subject, names")
      .eq("class_id", classId)
      .eq("teacher_id", profile.id)
      .order("created_at"),
  ]);
  const subjects = mySubjects ?? [];
  const current = subjects.find((x) => x.id === ders) ?? subjects[0] ?? null;

  // RLS erişim vermiyorsa sınıf hiç dönmez
  if (!cls) notFound();

  const notedTodayIds = [
    ...new Set((recentNotes ?? []).filter((n) => isToday(n.created_at) && (!current || n.subject_id === current.id)).map((n) => n.student_id)),
  ];

  return (
    <>
      <AppHeader profile={profile} title={t("class.title", { name: cls.name })} backHref="/teacher" />
      <main className="mx-auto max-w-5xl px-4 py-3">
        {/* Ders sekmeleri: çıkış yapmadan dersler arasında geçiş; öğrenci listesi ve notlar seçili derse göre */}
        <div className="-mx-4 mb-2 flex items-center gap-2 overflow-x-auto px-4 pb-1">
          {subjects.map((x) => (
            <Link
              key={x.id}
              href={`/teacher/classes/${classId}?ders=${x.id}`}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ${
                x.id === current?.id ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-200"
              }`}
            >
              {subjectLabel(x.subject, x.names as SubjectNames, locale)}
            </Link>
          ))}
          {profile.role === "branch_teacher" && (
            <Link
              href={`/teacher/classes/${classId}/subjects`}
              className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-200"
            >
              {subjects.length ? t("class.addSubject") : t("class.pickSubject")}
            </Link>
          )}
        </div>
        <ClassRoster key={current?.id ?? "none"} students={students ?? []} notedTodayIds={notedTodayIds} subjectId={current?.id ?? null} />
      </main>
    </>
  );
}
