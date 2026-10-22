import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { InviteLinkCard } from "@/components/InviteLinkCard";
import { SubjectAssignments } from "@/components/SubjectAssignments";
import { requireRole } from "@/lib/auth";
import { branchLabel, subjectLabel, type SubjectNames } from "@/lib/i18n/branches";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import {
  addStudent,
  assignTeacher,
  deleteClass,
  regenerateJoinToken,
  renameClass,
  unassignTeacher,
} from "../../actions";

/** Sınıf öğretmeninin sınıf yönetimi: davet linki, dersler, öğretmenler, öğrenciler, sınıf ayarları. */
export default async function ManageClassPage(props: PageProps<"/admin/classes/[classId]">) {
  const { classId } = await props.params;
  const profile = await requireRole("class_teacher");
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, class_teacher_id, join_token")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || cls.class_teacher_id !== profile.id) notFound();

  const [{ data: students }, { data: access }, { data: teachers }, { data: subjects }] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, photo_url")
      .eq("class_id", classId)
      .order("first_name"),
    supabase.from("teacher_class_access").select("teacher_id").eq("class_id", classId),
    supabase
      .from("profiles")
      .select("id, full_name, role, branch, via_link")
      .in("role", ["branch_teacher", "class_teacher"])
      .order("full_name"),
    supabase
      .from("class_subjects")
      .select("id, subject, names, teacher_id")
      .eq("class_id", classId)
      .order("created_at"),
  ]);

  const assignedIds = new Set(access?.map((a) => a.teacher_id));
  const allTeachers = (teachers ?? []) as (Omit<Profile, "email"> & { via_link: boolean })[];
  const subjectRows = (subjects ?? []).map((s) => ({ ...s, names: s.names as SubjectNames | null }));

  // Davet linki, uygulamanın açıldığı adresle üretilir (yerelde localhost, yayında alan adı)
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const inviteUrl = `${origin}/${cls.join_token}`;
  const assigned = allTeachers.filter((x) => assignedIds.has(x.id));
  const available = allTeachers.filter((x) => !assignedIds.has(x.id));
  const subjectsOf = (teacherId: string) =>
    subjectRows.filter((x) => x.teacher_id === teacherId).map((x) => subjectLabel(x.subject, x.names, locale));
  const teacherName = (x: { full_name: string }) => x.full_name || t("common.unnamed");

  return (
    <>
      <AppHeader profile={profile} title={t("manage.title", { name: cls.name })} backHref={`/admin?class=${classId}`} />
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5 lg:grid-cols-2">
        {/* ------------------------------------------------ Öğretmenler ve dersler */}
        <section className="min-w-0 space-y-3">
          <InviteLinkCard className={cls.name} url={inviteUrl} regenerate={regenerateJoinToken.bind(null, classId)} />
          <SubjectAssignments
            classId={classId}
            subjects={subjectRows}
            teachers={allTeachers.map(({ id, full_name, branch }) => ({ id, full_name, branch }))}
          />

          <h2 className="pt-2 text-lg font-bold">{t("manage.teachers")}</h2>
          <p className="-mt-2 text-xs text-slate-500">{t("manage.teachersHint")}</p>
          <form action={assignTeacher} className="card flex gap-2">
            <input type="hidden" name="class_id" value={classId} />
            <select name="teacher_id" required className="input min-w-0 flex-1" defaultValue="">
              <option value="" disabled>{t("manage.assignPlaceholder")}</option>
              {available.map((x) => (
                <option key={x.id} value={x.id}>
                  {teacherName(x)} {x.branch ? `(${branchLabel(x.branch, locale)})` : ""}
                </option>
              ))}
            </select>
            <button className="btn-primary shrink-0">{t("manage.assign")}</button>
          </form>

          <ul className="card divide-y divide-slate-100 p-0">
            {assigned.length === 0 && <li className="p-4 text-sm text-slate-500">{t("manage.noAssign")}</li>}
            {assigned.map((x) => {
              const lessons = subjectsOf(x.id);
              return (
                <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{teacherName(x)}</p>
                    <p className="text-xs text-slate-500">
                      {lessons.length
                        ? t("manage.lessons", { list: lessons.join(", ") })
                        : `${x.branch ? branchLabel(x.branch, locale) : t("manage.noBranch")} · ${t("manage.noLesson")}`}
                      {x.via_link && ` · ${t("manage.viaLink")}`}
                    </p>
                  </div>
                  <form action={unassignTeacher}>
                    <input type="hidden" name="class_id" value={classId} />
                    <input type="hidden" name="teacher_id" value={x.id} />
                    <button className="min-h-10 rounded-xl px-3 text-sm text-red-600 hover:bg-red-50">
                      {t("common.remove")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ------------------------------------------------ Öğrenciler + sınıf ayarları */}
        <section className="min-w-0 space-y-3">
          <h2 className="text-lg font-bold">{t("manage.students", { n: students?.length ?? 0 })}</h2>

          <div className="card">
            <ActionForm action={addStudent} submitLabel={t("manage.addStudent")}>
              <input type="hidden" name="class_id" value={classId} />
              <div className="grid grid-cols-2 gap-2">
                <input name="first_name" placeholder={t("manage.firstName")} aria-label={t("manage.firstName")} required className="input" />
                <input name="last_name" placeholder={t("manage.lastName")} aria-label={t("manage.lastName")} required className="input" />
              </div>
              <textarea
                name="short_info"
                rows={2}
                maxLength={500}
                placeholder={t("manage.shortInfo")}
                aria-label={t("manage.shortInfo")}
                className="input py-3"
              />
              <label className="block">
                <span className="label">{t("manage.photo")}</span>
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
              <li key={s.id}>
                <Link
                  href={`/admin/students/${s.id}?edit=1`}
                  className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
                >
                  <Avatar firstName={s.first_name} lastName={s.last_name} photoUrl={s.photo_url} size="md" />
                  <span className="flex-1 truncate font-medium">
                    {s.first_name} {s.last_name}
                  </span>
                  <span className="text-sm text-brand-700">{t("common.edit")} ›</span>
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="pt-2 text-lg font-bold">{t("manage.classSettings")}</h2>
          <div className="card space-y-4">
            <ActionForm action={renameClass} submitLabel={t("manage.rename")} resetOnSuccess={false}>
              <input type="hidden" name="class_id" value={classId} />
              <label className="label" htmlFor="class_name">{t("classAdmin.className")}</label>
              <input
                id="class_name"
                name="name"
                defaultValue={cls.name}
                required
                maxLength={40}
                autoCapitalize="characters"
                className="input"
              />
            </ActionForm>
            <form action={deleteClass} className="border-t border-slate-100 pt-3 text-center">
              <input type="hidden" name="class_id" value={classId} />
              <ConfirmButton
                message={t("manage.deleteClassConfirm", { name: cls.name })}
                className="min-h-11 rounded-xl px-4 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                {t("manage.deleteClass")}
              </ConfirmButton>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
