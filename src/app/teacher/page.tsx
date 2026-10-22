import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ProfileForm } from "@/components/ProfileForm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherDashboard() {
  const profile = await requireRole("branch_teacher", "class_teacher");

  // İlk giriş: önce branş ve isim seçimi
  if (!profile.branch || !profile.full_name) {
    return (
      <>
        <AppHeader profile={profile} title="Hoş geldiniz" />
        <main className="mx-auto max-w-xl px-4 py-6">
          <p className="mb-4 text-slate-600">Başlamadan önce adınızı ve branşınızı seçin.</p>
          <ProfileForm fullName={profile.full_name} branch={profile.branch} />
        </main>
      </>
    );
  }

  const supabase = await createClient();
  // RLS sayesinde sadece öğretmenin atandığı (veya sınıf öğretmeni olduğu) sınıflar döner.
  const [{ data: classes }, { data: mySubjects }] = await Promise.all([
    supabase.from("classes").select("id, name, class_teacher_id, students(count)").order("name"),
    supabase.from("class_subjects").select("class_id, subject").eq("teacher_id", profile.id),
  ]);
  const subjectsIn = (classId: string) =>
    (mySubjects ?? []).filter((x) => x.class_id === classId).map((x) => x.subject);

  return (
    <>
      <AppHeader profile={profile} title="Sınıflarım" />
      <main className="mx-auto max-w-5xl px-4 py-5">
        {!classes?.length ? (
          <div className="card text-center text-slate-500">
            Henüz size atanmış bir sınıf yok. Yöneticinizle iletişime geçin.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {classes.map((c) => {
              const count = (c.students as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/teacher/classes/${c.id}`}
                    className="card flex aspect-[4/3] flex-col justify-between bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white ring-0 transition active:scale-[0.98]"
                  >
                    <span>
                      <span className="block text-3xl font-bold">{c.name}</span>
                      {subjectsIn(c.id).length > 0 && (
                        <span className="mt-1 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
                          {subjectsIn(c.id).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-white/80">
                      {count} öğrenci
                      {c.class_teacher_id === profile.id && " · Sınıf öğretmeni"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <Link href="/teacher/profile" className="mt-6 inline-block text-sm text-brand-700 underline">
          Branş / isim bilgimi değiştir
        </Link>
      </main>
    </>
  );
}
