import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { addStudent, assignTeacher, deleteStudent, unassignTeacher } from "../../actions";

export default async function ManageClassPage(props: PageProps<"/admin/classes/[classId]">) {
  const { classId } = await props.params;
  const profile = await requireRole("super_admin", "class_teacher");
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, class_teacher_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || (profile.role !== "super_admin" && cls.class_teacher_id !== profile.id)) notFound();

  const [{ data: students }, { data: access }, { data: teachers }] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, photo_url")
      .eq("class_id", classId)
      .order("first_name"),
    supabase.from("teacher_class_access").select("teacher_id").eq("class_id", classId),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, branch")
      .in("role", ["branch_teacher", "class_teacher"])
      .order("full_name"),
  ]);

  const assignedIds = new Set(access?.map((a) => a.teacher_id));
  const allTeachers = (teachers ?? []) as Profile[];
  const assigned = allTeachers.filter((t) => assignedIds.has(t.id));
  const available = allTeachers.filter((t) => !assignedIds.has(t.id));

  return (
    <>
      <AppHeader profile={profile} title={`${cls.name} · Yönetim`} backHref={`/admin?class=${classId}`} />
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5 lg:grid-cols-2">
        {/* ------------------------------------------------ Branş öğretmenleri */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Derse giren öğretmenler</h2>
          <form action={assignTeacher} className="card flex gap-2">
            <input type="hidden" name="class_id" value={classId} />
            <select name="teacher_id" required className="input flex-1" defaultValue="">
              <option value="" disabled>Öğretmen seçin…</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.email} {t.branch ? `(${t.branch})` : ""}
                </option>
              ))}
            </select>
            <button className="btn-primary shrink-0">Ata</button>
          </form>

          <ul className="card divide-y divide-slate-100 p-0">
            {assigned.length === 0 && <li className="p-4 text-sm text-slate-500">Henüz atama yok.</li>}
            {assigned.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.full_name || t.email}</p>
                  <p className="text-xs text-slate-500">{t.branch ?? "Branş seçilmemiş"}</p>
                </div>
                <form action={unassignTeacher}>
                  <input type="hidden" name="class_id" value={classId} />
                  <input type="hidden" name="teacher_id" value={t.id} />
                  <button className="rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50">Kaldır</button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ Öğrenciler */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Öğrenciler ({students?.length ?? 0})</h2>

          <div className="card">
            <ActionForm action={addStudent} submitLabel="Öğrenci Ekle">
              <input type="hidden" name="class_id" value={classId} />
              <div className="grid grid-cols-2 gap-2">
                <input name="first_name" placeholder="Ad" required className="input" />
                <input name="last_name" placeholder="Soyad" required className="input" />
              </div>
              <textarea name="short_info" rows={2} placeholder="Kısa bilgi (isteğe bağlı)" className="input py-3" />
              <label className="block">
                <span className="label">Fotoğraf</span>
                <input
                  type="file"
                  name="photo"
                  accept="image/*"
                  capture="environment"
                  className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-700"
                />
              </label>
            </ActionForm>
          </div>

          <ul className="card divide-y divide-slate-100 p-0">
            {students?.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar firstName={s.first_name} lastName={s.last_name} photoUrl={s.photo_url} size="md" />
                <span className="flex-1 truncate font-medium">
                  {s.first_name} {s.last_name}
                </span>
                <form action={deleteStudent}>
                  <input type="hidden" name="class_id" value={classId} />
                  <input type="hidden" name="student_id" value={s.id} />
                  <button className="rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600">
                    Sil
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
