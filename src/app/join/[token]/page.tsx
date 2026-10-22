import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { type Profile } from "@/lib/types";
import { findClassByToken } from "@/lib/join";
import { joinAsCurrent, joinAsExisting, joinAsNew, switchUser } from "./actions";
import { TeacherPicker } from "./TeacherPicker";

export const metadata = { title: "Sınıfa katıl · LineClass" };

export default async function JoinPage(props: PageProps<"/join/[token]">) {
  const { token } = await props.params;
  const { adim } = await props.searchParams;
  const cls = await findClassByToken(token);

  if (!cls) {
    return (
      <Shell>
        <div className="card p-6 text-center">
          <p className="text-4xl">🔗</p>
          <h1 className="mt-3 text-xl font-bold">Link geçersiz</h1>
          <p className="mt-2 text-slate-500">
            Bu link yenilenmiş veya hatalı olabilir. Sınıf öğretmeninizden güncel linki isteyin.
          </p>
        </div>
      </Shell>
    );
  }

  const profile = await getProfile();

  // 1. adım: sınıf adı + sınıf öğretmeni kartı.
  // Bu telefonda daha önce giriş yapılmışsa kart üzerinden tek dokunuşla öğrencilere geçilir.
  if (adim !== "ogretmen") {
    const known = profile && profile.role !== "super_admin" ? profile : null;
    return (
      <Shell>
        <p className="mb-3 text-center text-slate-600">Bu sınıfa not girişi için davet edildiniz.</p>
        <div className="card bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white ring-0 shadow-lg shadow-brand-600/20">
          <span className="block text-sm text-white/80">Sınıf</span>
          <span className="block text-5xl font-bold tracking-tight">{cls.name}</span>
          <span className="mt-5 block border-t border-white/20 pt-4">
            <span className="block text-sm text-white/80">Sınıf öğretmeni</span>
            <span className="block text-lg font-semibold">{cls.classTeacherName ?? "Atanmamış"}</span>
          </span>

          {known ? (
            <form action={joinAsCurrent.bind(null, token)} className="mt-5">
              <button className="flex min-h-14 w-full flex-col items-center justify-center rounded-2xl bg-white font-semibold text-brand-700 transition active:scale-[0.98]">
                <span>{known.full_name} olarak devam et →</span>
                {known.branch && <span className="text-xs font-normal text-slate-500">{known.branch}</span>}
              </button>
            </form>
          ) : (
            <Link
              href={`/join/${token}?adim=ogretmen`}
              className="mt-5 flex min-h-14 items-center justify-center rounded-2xl bg-white font-semibold text-brand-700 transition active:scale-[0.98]"
            >
              Devam et →
            </Link>
          )}
        </div>

        {known && (
          <form action={switchUser.bind(null, token)} className="mt-4 text-center">
            <button className="min-h-11 px-3 text-sm text-slate-500 underline">
              {known.full_name} değil misiniz? Başka öğretmen seçin
            </button>
          </form>
        )}
      </Shell>
    );
  }

  // 2. adım bir oturum varken açılırsa karşılama kartındaki kısayola dön
  if (profile) redirect(`/join/${token}`);

  // Bu sınıfa daha önce katılmış branş öğretmenleri
  const admin = createAdminClient();
  const { data: access } = await admin
    .from("teacher_class_access")
    .select("teacher:profiles(id, full_name, branch, role)")
    .eq("class_id", cls.id);
  const teachers = (access ?? [])
    .map((a) => a.teacher as unknown as Pick<Profile, "id" | "full_name" | "branch" | "role"> | null)
    .filter((t): t is NonNullable<typeof t> => !!t && t.role === "branch_teacher")
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"))
    .map(({ id, full_name, branch }) => ({ id, full_name, branch }));
  const { data: subjects } = await admin
    .from("class_subjects")
    .select("subject, teacher_id, teacher:profiles!class_subjects_teacher_id_fkey(full_name)")
    .eq("class_id", cls.id);
  const classSubjects = (subjects ?? []).map((x) => ({
    subject: x.subject,
    teacherId: x.teacher_id,
    teacherName: (x.teacher as unknown as { full_name: string } | null)?.full_name ?? null,
  }));

  return (
    <Shell className={cls.name} subtitle={cls.classTeacherName} backHref={`/join/${token}`}>
      <TeacherPicker
        teachers={teachers}
        classSubjects={classSubjects}
        joinExisting={joinAsExisting.bind(null, token)}
        joinNew={joinAsNew.bind(null, token)}
      />
    </Shell>
  );
}

function Shell({
  children,
  className,
  subtitle,
  backHref,
}: {
  children: React.ReactNode;
  className?: string;
  subtitle?: string | null;
  backHref?: string;
}) {
  return (
    <main className="flex-1 px-4 py-8">
      <div className="mx-auto max-w-md">
        {backHref && (
          <Link href={backHref} className="mb-2 inline-block text-sm text-slate-500">
            ← Geri
          </Link>
        )}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-3xl bg-brand-600 text-xl font-bold text-white">
            LC
          </div>
          {className ? (
            <>
              <p className="text-sm text-slate-500">LineClass · Sınıf daveti</p>
              <h1 className="text-3xl font-bold">{className}</h1>
              {subtitle && <p className="text-sm text-slate-500">Sınıf öğretmeni: {subtitle}</p>}
            </>
          ) : (
            <h1 className="text-2xl font-bold">LineClass</h1>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}
