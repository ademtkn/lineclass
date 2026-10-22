import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { StudentGrid } from "@/components/StudentGrid";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ClassStudentsPage(props: PageProps<"/teacher/classes/[classId]">) {
  const { classId } = await props.params;
  const profile = await requireRole("branch_teacher", "class_teacher");
  const supabase = await createClient();

  const [{ data: cls }, { data: students }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("id", classId).maybeSingle(),
    supabase
      .from("students")
      .select("id, first_name, last_name, class_id, photo_url, short_info")
      .eq("class_id", classId)
      .order("first_name"),
  ]);

  // RLS erişim vermiyorsa sınıf hiç dönmez
  if (!cls) notFound();

  return (
    <>
      <AppHeader profile={profile} title={`${cls.name} Sınıfı`} backHref="/teacher" />
      <main className="mx-auto max-w-5xl px-4 py-5">
        <p className="mb-3 text-sm text-slate-500">Not eklemek için öğrenciye dokunun.</p>
        <StudentGrid students={students ?? []} hrefFor={(s) => `/teacher/students/${s.id}`} />
      </main>
    </>
  );
}
