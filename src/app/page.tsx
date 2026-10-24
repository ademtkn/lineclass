import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getProfile, homeFor } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: `LineClass · ${t("app.tagline")}`, description: t("home.heroText") };
}

const FEATURES = [
  { icon: "🧑‍🎓", key: "f1" },
  { icon: "📝", key: "f2" },
  { icon: "🌐", key: "f3" },
  { icon: "🔗", key: "f4" },
] as const;
const STEPS = ["s1", "s2", "s3"] as const;
const ROLES = ["super_admin", "class_teacher", "branch_teacher"] as const;

/** Açılış sayfası: giriş yapmamış ziyaretçiye uygulamayı 4 dilde tanıtır; giriş yapmış kullanıcı paneline geçer. */
export default async function Home() {
  const profile = await getProfile();
  if (profile) redirect(homeFor(profile.role));
  const { t } = await getT();

  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="LineClass" className="h-11 w-auto" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/login" className="btn-primary min-h-10 px-4 text-sm">{t("login.submit")}</Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 pb-10 pt-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="LineClass" width={240} className="mx-auto mb-6 h-auto w-56" />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("home.heroTitle")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">{t("home.heroText")}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/login" className="btn-primary">{t("login.submit")}</Link>
          <Link href="/apply" className="btn-ghost text-brand-700">{t("home.ctaApply")}</Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t("home.branchNote")}</p>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="mb-5 text-center text-2xl font-bold">{t("home.featuresTitle")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.key} className="card flex gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl" aria-hidden>{f.icon}</span>
              <div>
                <h3 className="font-bold">{t(`home.${f.key}Title`)}</h3>
                <p className="mt-1 text-sm text-slate-600">{t(`home.${f.key}Text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="mb-5 text-center text-2xl font-bold">{t("home.stepsTitle")}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="card">
              <span className="grid size-9 place-items-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</span>
              <h3 className="mt-3 font-bold">{t(`home.${s}Title`)}</h3>
              <p className="mt-1 text-sm text-slate-600">{t(`home.${s}Text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <h2 className="mb-5 text-center text-2xl font-bold">{t("home.rolesTitle")}</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r} className="card">
              <h3 className="font-bold text-brand-700">{t(`role.${r}`)}</h3>
              <p className="mt-1 text-sm text-slate-600">{t(`home.role_${r}`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h2 className="text-2xl font-bold">{t("home.endTitle")}</h2>
        <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/apply" className="btn-primary">{t("home.ctaApply")}</Link>
          <Link href="/login" className="btn-ghost">{t("login.submit")}</Link>
        </div>
      </section>
    </main>
  );
}
