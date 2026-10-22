import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type Profile } from "@/lib/types";
import { findClassByToken } from "@/lib/join";
import { joinAsCurrent, joinAsExisting, joinAsNew, switchUser } from "./actions";
import { JoinNewForm } from "./JoinNewForm";

export const metadata = { title: "Sınıfa katıl · LineClass" };

export default async function JoinPage(props: PageProps<"/join/[token]">) {
  const { token } = await props.params;
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

  // Zaten giriş yapılmış (aynı telefon): tek dokunuşla devam
  if (profile) {
    return (
      <Shell className={cls.name}>
        <div className="card space-y-4 p-6 text-center">
          <p className="text-slate-600">Bu cihazda şu kişi olarak giriş yapılmış:</p>
          <div>
            <p className="text-xl font-bold">{profile.full_name || profile.email}</p>
            <p className="text-sm text-slate-500">
              {ROLE_LABELS[profile.role]}
              {profile.branch && ` · ${profile.branch}`}
            </p>
          </div>
          <form action={joinAsCurrent.bind(null, token)}>
            <button className="btn-primary w-full">{cls.name} sınıfına devam et</button>
          </form>
          <form action={switchUser.bind(null, token)}>
            <button className="text-sm text-slate-500 underline">Ben bu kişi değilim</button>
          </form>
        </div>
      </Shell>
    );
  }

  // Bu sınıfa daha önce katılmış branş öğretmenleri
  const admin = createAdminClient();
  const { data: access } = await admin
    .from("teacher_class_access")
    .select("teacher:profiles(id, full_name, branch, role)")
    .eq("class_id", cls.id);
  const teachers = (access ?? [])
    .map((a) => a.teacher as unknown as Pick<Profile, "id" | "full_name" | "branch" | "role"> | null)
    .filter((t): t is NonNullable<typeof t> => !!t && t.role === "branch_teacher")
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"));

  return (
    <Shell className={cls.name}>
      {teachers.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold text-slate-700">Daha önce girdiyseniz adınıza dokunun</h2>
          <ul className="grid gap-2">
            {teachers.map((t) => (
              <li key={t.id}>
                <form action={joinAsExisting.bind(null, token, t.id)}>
                  <button className="card flex w-full items-center justify-between gap-3 text-left transition active:scale-[0.98]">
                    <span>
                      <span className="block font-semibold">{t.full_name}</span>
                      <span className="text-sm text-slate-500">{t.branch}</span>
                    </span>
                    <span className="text-xl text-brand-600" aria-hidden>→</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold text-slate-700">
          {teachers.length ? "Listede yoksanız" : "Adınızı ve branşınızı seçin"}
        </h2>
        <JoinNewForm action={joinAsNew.bind(null, token)} />
      </section>
    </Shell>
  );
}

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-3xl bg-brand-600 text-xl font-bold text-white">
            LC
          </div>
          {className ? (
            <>
              <p className="text-sm text-slate-500">LineClass · Sınıf daveti</p>
              <h1 className="text-3xl font-bold">{className}</h1>
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
