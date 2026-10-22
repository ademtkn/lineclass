import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { AppHeader } from "@/components/AppHeader";
import { StudentGrid } from "@/components/StudentGrid";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types";
import { createClass } from "./actions";

/** Sınıf öğretmeninin paneli: kendi sınıf(lar)ı, öğrenciler ve not sayıları. */
export default async function ClassTeacherDashboard(props: PageProps<"/admin">) {
  const profile = await requireRole("super_admin", "class_teacher");
  // Yöneticinin tek görevi kullanıcı yönetimi
  if (profile.role === "super_admin") redirect("/admin/users");

  const { class: classParam, new: newParam } = await props.searchParams;
  const { t } = await getT();
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("class_teacher_id", profile.id)
    .order("name");

  const selected = classes?.find((c) => c.id === classParam) ?? classes?.[0] ?? null;
  const showCreate = !classes?.length || newParam === "1";

  let students: Student[] = [];
  const noteCounts = new Map<string, number>();

  if (selected && !showCreate) {
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
      <AppHeader profile={profile} title={t("nav.myClass")} />
      <main className="mx-auto max-w-5xl px-4 py-5">
        {/* Sınıf seçici: yatay kaydırılabilir çipler + yeni sınıf */}
        {!!classes?.length && (
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/admin?class=${c.id}`}
                className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ${
                  c.id === selected?.id && !showCreate
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-white text-slate-700 ring-slate-200"
                }`}
              >
                {c.name}
              </Link>
            ))}
            <Link
              href="/admin?new=1"
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ${
                showCreate ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-brand-700 ring-brand-200"
              }`}
            >
              {t("classAdmin.newClass")}
            </Link>
          </div>
        )}

        {showCreate ? (
          <section className="mx-auto max-w-md">
            {!classes?.length && <p className="mb-4 text-slate-600">{t("classAdmin.noClass")}</p>}
            <div className="card">
              <h2 className="mb-3 text-lg font-bold">{t("classAdmin.createTitle")}</h2>
              <ActionForm action={createClass} submitLabel={t("classAdmin.create")}>
                <label className="label" htmlFor="name">{t("classAdmin.className")}</label>
                <input
                  id="name"
                  name="name"
                  required
                  maxLength={40}
                  autoCapitalize="characters"
                  placeholder={t("classAdmin.classNamePlaceholder")}
                  className="input"
                />
              </ActionForm>
            </div>
          </section>
        ) : (
          selected && (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">{t("classAdmin.studentsHint", { n: students.length })}</p>
                <Link
                  href={`/admin/classes/${selected.id}`}
                  className="btn-ghost min-h-10 shrink-0 whitespace-nowrap px-4 text-sm"
                >
                  {t("classAdmin.manage")}
                </Link>
              </div>

              <StudentGrid
                students={students}
                hrefFor={(s) => `/admin/students/${s.id}`}
                badgeFor={(s) => {
                  const n = noteCounts.get(s.id) ?? 0;
                  return n ? t("common.notes", { n }) : null;
                }}
              />
            </>
          )
        )}
      </main>
    </>
  );
}
