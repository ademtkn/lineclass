import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { requireRole } from "@/lib/auth";
import { subjectLabel, type SubjectNames } from "@/lib/i18n/branches";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { saveSubjects } from "../../../actions";

/** Öğretmenin bu sınıfta hangi derslere girdiğini seçtiği ekran (linkle ilk girişte ve sonradan). */
export default async function PickSubjectsPage(props: PageProps<"/teacher/classes/[classId]/subjects">) {
  const { classId } = await props.params;
  const { err } = await props.searchParams;
  const profile = await requireRole("branch_teacher", "class_teacher");
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: cls } = await supabase.from("classes").select("id, name").eq("id", classId).maybeSingle();
  if (!cls) notFound();
  const { data } = await supabase
    .from("class_subjects")
    .select("id, subject, names, teacher_id, teacher:profiles!class_subjects_teacher_id_fkey(full_name)")
    .eq("class_id", classId)
    .order("created_at");
  const subjects = data ?? [];

  return (
    <>
      <AppHeader profile={profile} title={t("class.title", { name: cls.name })} backHref={`/teacher/classes/${classId}`} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <div>
          <h2 className="text-xl font-bold">{t("pickSubjects.title")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("pickSubjects.hint")}</p>
        </div>

        {subjects.length === 0 ? (
          <p className="card text-sm text-slate-500">{t("pickSubjects.none")}</p>
        ) : (
          <form action={saveSubjects.bind(null, classId)} className="space-y-3">
            <ul className="grid gap-2">
              {subjects.map((s) => {
                const mine = s.teacher_id === profile.id;
                const taken = !!s.teacher_id && !mine;
                const owner = (s.teacher as unknown as { full_name: string } | null)?.full_name;
                return (
                  <li key={s.id}>
                    <label
                      className={`card flex min-h-16 items-center gap-3 ${taken ? "bg-slate-50 text-slate-400" : "cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-brand-500"}`}
                    >
                      <input
                        type="checkbox"
                        name="subject_id"
                        value={s.id}
                        defaultChecked={mine}
                        disabled={taken || mine}
                        className="size-5 accent-brand-600"
                      />
                      <span className="flex-1 text-lg font-semibold">{subjectLabel(s.subject, s.names as SubjectNames, locale)}</span>
                      {mine && <span className="text-xs font-medium text-emerald-700">✓ {t("pickSubjects.mine")}</span>}
                      {taken && <span className="max-w-[40%] truncate text-xs">{t("pickSubjects.taken", { name: owner ?? "—" })}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
            {err === "pick" && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t("pickSubjects.errPick")}</p>}
            <button className="btn-primary w-full">{t("pickSubjects.save")}</button>
          </form>
        )}
      </main>
    </>
  );
}
