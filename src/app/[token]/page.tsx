import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getProfile } from "@/lib/auth";
import { branchLabel } from "@/lib/i18n/branches";
import { claimStatuses } from "@/lib/claims";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/server";
import { findClassByToken } from "@/lib/join";
import { JOIN_CODE_RE } from "@/lib/join-code";
import { joinAsCurrent, joinAsExisting, joinAsNew, switchUser } from "./actions";
import { TeacherPicker } from "./TeacherPicker";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("join.metaTitle") };
}

export default async function JoinPage(props: PageProps<"/[token]">) {
  const { token } = await props.params;
  const { adim, kilit } = await props.searchParams;
  // Kök adresteki her şey buraya düşer; davet kodu biçiminde olmayanlar normal 404
  if (!JOIN_CODE_RE.test(token)) notFound();
  const { t, locale } = await getT();
  const cls = await findClassByToken(token);

  if (!cls) {
    return (
      <Shell>
        <div className="card p-6 text-center">
          <p className="text-4xl">🔗</p>
          <h1 className="mt-3 text-xl font-bold">{t("join.invalidTitle")}</h1>
          <p className="mt-2 text-slate-500">{t("join.invalidBody")}</p>
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
        <p className="mb-3 text-center text-slate-600">{t("join.invited")}</p>
        <div className="card bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white ring-0 shadow-lg shadow-brand-600/20">
          <span className="block text-sm text-white/80">{t("join.class")}</span>
          <span className="block text-5xl font-bold tracking-tight">{cls.name}</span>
          <span className="mt-5 block border-t border-white/20 pt-4">
            <span className="block text-sm text-white/80">{t("join.classTeacher")}</span>
            <span className="block text-lg font-semibold">{cls.classTeacherName ?? t("join.unassigned")}</span>
          </span>

          {known ? (
            <form action={joinAsCurrent.bind(null, token)} className="mt-5">
              <button className="flex min-h-14 w-full flex-col items-center justify-center rounded-2xl bg-white font-semibold text-brand-700 transition active:scale-[0.98]">
                <span>{t("join.continueAs", { name: known.full_name })}</span>
                {known.branch && <span className="text-xs font-normal text-slate-500">{branchLabel(known.branch, locale)}</span>}
              </button>
            </form>
          ) : (
            <Link
              href={`/${token}?adim=ogretmen`}
              className="mt-5 flex min-h-14 items-center justify-center rounded-2xl bg-white font-semibold text-brand-700 transition active:scale-[0.98]"
            >
              {t("join.continue")}
            </Link>
          )}
        </div>

        {known && (
          <form action={switchUser.bind(null, token)} className="mt-4 text-center">
            <button className="min-h-11 px-3 text-sm text-slate-500 underline">
              {t("join.notYou", { name: known.full_name })}
            </button>
          </form>
        )}
      </Shell>
    );
  }

  // 2. adım bir oturum varken açılırsa karşılama kartındaki kısayola dön
  if (profile) redirect(`/${token}`);

  // Bu sınıfa daha önce katılmış (linkle oluşturulmuş) öğretmenler; adı başka cihazda alınmışsa kilitli görünür
  const admin = createAdminClient();
  const { data: access } = await admin
    .from("teacher_class_access")
    .select("teacher:profiles(id, full_name, role, via_link)")
    .eq("class_id", cls.id);
  const found = (access ?? [])
    .map((a) => a.teacher as unknown as { id: string; full_name: string; role: string; via_link: boolean } | null)
    // Şifreli hesaplar /login'den girer
    .filter((x): x is NonNullable<typeof x> => !!x && x.role === "branch_teacher" && x.via_link && !!x.full_name)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, locale));
  const statuses = await claimStatuses(found.map((x) => x.id));
  const teachers = found.map((x) => ({ id: x.id, full_name: x.full_name, locked: statuses.get(x.id) === "locked" }));

  return (
    <Shell className={cls.name} subtitle={cls.classTeacherName} backHref={`/${token}`}>
      <TeacherPicker
        teachers={teachers}
        showLockedNotice={kilit === "1"}
        joinExisting={joinAsExisting.bind(null, token)}
        joinNew={joinAsNew.bind(null, token)}
      />
    </Shell>
  );
}

async function Shell({
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
  const { t } = await getT();
  return (
    <main className="flex-1 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-1 flex items-center justify-between gap-2">
          {backHref ? (
            <Link href={backHref} className="-ml-2 inline-flex min-h-11 items-center px-2 text-sm text-slate-500">
              ← {t("common.back")}
            </Link>
          ) : (
            <span />
          )}
          <LanguageSwitcher />
        </div>
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="LineClass" className="mx-auto mb-3 h-14 w-auto" />
          {className ? (
            <>
              <p className="text-sm text-slate-500">{t("join.header")}</p>
              <h1 className="text-3xl font-bold">{className}</h1>
              {subtitle && <p className="text-sm text-slate-500">{t("join.classTeacherLine", { name: subtitle })}</p>}
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
