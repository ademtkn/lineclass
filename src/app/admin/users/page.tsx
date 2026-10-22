import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { AppHeader } from "@/components/AppHeader";
import { requireRole } from "@/lib/auth";
import { branchLabel } from "@/lib/i18n/branches";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";
import { createUser } from "../actions";
import { UserFields } from "./UserFields";

const ROLE_BADGE: Record<Role, string> = {
  super_admin: "bg-violet-50 text-violet-700 ring-violet-200",
  class_teacher: "bg-brand-50 text-brand-700 ring-brand-200",
  branch_teacher: "bg-slate-50 text-slate-600 ring-slate-200",
};

/** Yöneticinin tek ekranı: kullanıcı ekle, listele, düzenlemeye git. */
export default async function UsersPage() {
  const profile = await requireRole("super_admin");
  const { t, locale } = await getT();
  // E-postalar yalnızca yöneticiye, sunucuda service role ile gösterilir (API'de kapalı)
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, email, role, branch, via_link")
    .order("role")
    .order("full_name");
  const users = (data ?? []) as { id: string; full_name: string; email: string; role: Role; branch: string | null; via_link: boolean }[];

  return (
    <>
      <AppHeader profile={profile} title={t("users.title")} />
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5 lg:grid-cols-[2fr_3fr]">
        <section className="min-w-0">
          <h2 className="mb-1 text-lg font-bold">{t("users.new")}</h2>
          <p className="mb-3 text-xs text-slate-500">{t("users.newHint")}</p>
          <div className="card">
            <ActionForm action={createUser} submitLabel={t("users.create")}>
              <UserFields />
            </ActionForm>
          </div>
        </section>

        <section className="min-w-0">
          <h2 className="mb-3 text-lg font-bold">{t("users.count", { n: users.length })}</h2>
          <ul className="card divide-y divide-slate-100 p-0">
            {users.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {u.full_name || t("common.unnamed")}
                      {u.id === profile.id && <span className="text-slate-400"> ·  ✓</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {u.via_link ? t("users.viaLink") : u.email}
                      {u.branch && ` · ${branchLabel(u.branch, locale)}`}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${ROLE_BADGE[u.role]}`}>
                    {t(`role.${u.role}`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
