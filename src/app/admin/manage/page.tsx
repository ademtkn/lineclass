import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { AppHeader } from "@/components/AppHeader";
import { requireRole } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { BRANCHES, ROLE_LABELS, type Profile, type Role } from "@/lib/types";
import { createClass, createUser, deleteClass, setClassTeacher, updateUserRole } from "../actions";

const TABS = [
  { key: "users", label: "Kullanıcılar" },
  { key: "classes", label: "Sınıflar" },
] as const;

export default async function ManagePage(props: PageProps<"/admin/manage">) {
  const profile = await requireRole("super_admin");
  const { tab = "users" } = await props.searchParams;
  const supabase = await createClient();

  const [{ data: users }, { data: classes }] = await Promise.all([
    // E-postalar yalnızca super admin'e, sunucuda service role ile gösterilir (API'de kapalı)
    createAdminClient().from("profiles").select("id, full_name, email, role, branch, via_link").order("full_name"),
    supabase.from("classes").select("id, name, class_teacher_id").order("name"),
  ]);
  const people = (users ?? []) as (Profile & { via_link: boolean })[];
  const teachers = people.filter((u) => u.role !== "super_admin");

  return (
    <>
      <AppHeader profile={profile} title="Yönetim" />
      <main className="mx-auto max-w-5xl px-4 py-5">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/60 p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/manage?tab=${t.key}`}
              className={`rounded-xl py-2.5 text-center text-sm font-semibold ${
                tab === t.key ? "bg-white shadow-sm" : "text-slate-600"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {tab === "users" ? (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <section className="card h-fit">
              <h2 className="mb-1 text-lg font-bold">Yeni kullanıcı</h2>
              <p className="mb-3 text-sm text-slate-500">
                Admin ve sınıf öğretmenleri için. Branş öğretmenleri hesap gerektirmez; sınıf davet linkiyle katılır.
              </p>
              <ActionForm action={createUser} submitLabel="Kullanıcı Oluştur">
                <input name="full_name" placeholder="Ad Soyad" required className="input" />
                <input name="email" type="email" placeholder="E-posta" required className="input" />
                <input name="password" type="text" placeholder="Geçici şifre (min 8)" minLength={8} required className="input" />
                <select name="role" defaultValue="class_teacher" className="input">
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <select name="branch" defaultValue="" className="input">
                  <option value="">Branş (öğretmen kendisi de seçebilir)</option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </ActionForm>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">Kullanıcılar ({people.length})</h2>
              <ul className="card divide-y divide-slate-100 p-0">
                {people.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <p className="truncate font-medium">{u.full_name || "—"}</p>
                      <p className="truncate text-xs text-slate-500">
                        {u.via_link ? "Sınıf linkiyle katıldı (şifresiz)" : u.email}
                        {u.branch && ` · ${u.branch}`}
                      </p>
                    </div>
                    <form action={updateUserRole} className="flex gap-2">
                      <input type="hidden" name="user_id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        disabled={u.id === profile.id}
                        className="input min-h-10 w-auto py-0 text-sm"
                      >
                        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      {u.id !== profile.id && (
                        <button className="btn-ghost min-h-10 px-3 text-sm">Kaydet</button>
                      )}
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <section className="card h-fit">
              <h2 className="mb-3 text-lg font-bold">Yeni sınıf</h2>
              <ActionForm action={createClass} submitLabel="Sınıf Oluştur">
                <input name="name" placeholder="Örn: 5-A" required className="input" />
                <select name="class_teacher_id" defaultValue="" className="input">
                  <option value="">Sınıf öğretmeni (sonra da atanabilir)</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                  ))}
                </select>
              </ActionForm>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold">Sınıflar ({classes?.length ?? 0})</h2>
              <ul className="space-y-3">
                {classes?.map((c) => (
                  <li key={c.id} className="card flex flex-wrap items-center gap-3">
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-lg font-bold text-brand-700">
                      {c.name}
                    </span>
                    <form action={setClassTeacher} className="flex min-w-0 flex-1 gap-2">
                      <input type="hidden" name="class_id" value={c.id} />
                      <select
                        name="class_teacher_id"
                        defaultValue={c.class_teacher_id ?? ""}
                        className="input min-h-10 min-w-0 flex-1 py-0 text-sm"
                        aria-label="Sınıf öğretmeni"
                      >
                        <option value="">Sınıf öğretmeni yok</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.full_name || t.email}</option>
                        ))}
                      </select>
                      <button className="btn-ghost min-h-10 px-3 text-sm">Kaydet</button>
                    </form>
                    <div className="flex w-full gap-2 sm:w-auto">
                      <Link href={`/admin/classes/${c.id}`} className="btn-ghost min-h-10 flex-1 px-3 text-sm">
                        Öğrenciler & atamalar
                      </Link>
                      <form action={deleteClass}>
                        <input type="hidden" name="class_id" value={c.id} />
                        <button className="min-h-10 rounded-2xl px-3 text-sm text-red-600 hover:bg-red-50">Sil</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
