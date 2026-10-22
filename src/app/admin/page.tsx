import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { StudentGrid } from "@/components/StudentGrid";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types";

export default async function AdminDashboard(props: PageProps<"/admin">) {
  const profile = await requireRole("super_admin", "class_teacher");
  const { class: classParam } = await props.searchParams;
  const supabase = await createClient();

  // Super admin: tüm sınıflar. Sınıf öğretmeni: sadece sorumlu olduğu sınıf(lar).
  let classQuery = supabase.from("classes").select("id, name").order("name");
  if (profile.role === "class_teacher") classQuery = classQuery.eq("class_teacher_id", profile.id);
  const { data: classes } = await classQuery;

  const selected =
    classes?.find((c) => c.id === classParam) ?? classes?.[0] ?? null;

  let students: Student[] = [];
  const noteCounts = new Map<string, number>();

  if (selected) {
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, class_id, photo_url, short_info")
      .eq("class_id", selected.id)
      .order("first_name");
    students = data ?? [];

    if (students.length) {
      const { data: notes } = await supabase
        .from("notes")
        .select("student_id")
        .in("student_id", students.map((s) => s.id));
      notes?.forEach((n) => noteCounts.set(n.student_id, (noteCounts.get(n.student_id) ?? 0) + 1));
    }
  }

  return (
    <>
      <AppHeader profile={profile} title={profile.role === "super_admin" ? "Tüm Notlar" : "Sınıfım"} />
      <main className="mx-auto max-w-5xl px-4 py-5">
        {!classes?.length ? (
          <div className="card text-center text-slate-500">
            {profile.role === "super_admin" ? (
              <>
                Henüz sınıf yok.{" "}
                <Link href="/admin/manage" className="text-brand-700 underline">Yönetim</Link> ekranından ekleyin.
              </>
            ) : (
              "Size atanmış bir sınıf yok."
            )}
          </div>
        ) : (
          <>
            {/* Sınıf filtresi: yatay kaydırılabilir çipler */}
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {classes.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin?class=${c.id}`}
                  className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ${
                    c.id === selected?.id
                      ? "bg-brand-600 text-white ring-brand-600"
                      : "bg-white text-slate-700 ring-slate-200"
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>

            {selected && (
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {students.length} öğrenci · notları görmek için dokunun
                </p>
                <Link href={`/admin/classes/${selected.id}`} className="btn-ghost min-h-10 px-4 text-sm">
                  Sınıfı yönet
                </Link>
              </div>
            )}

            <StudentGrid
              students={students}
              hrefFor={(s) => `/admin/students/${s.id}`}
              badgeFor={(s) => {
                const n = noteCounts.get(s.id) ?? 0;
                return n ? `${n} not` : null;
              }}
            />
          </>
        )}
      </main>
    </>
  );
}
