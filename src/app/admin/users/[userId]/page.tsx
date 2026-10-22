import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmButton } from "@/components/ConfirmButton";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";
import { deleteUser, updateUser } from "../../actions";
import { UserFields } from "../UserFields";

export default async function EditUserPage(props: PageProps<"/admin/users/[userId]">) {
  const { userId } = await props.params;
  const profile = await requireRole("super_admin");
  const { t } = await getT();

  const { data: user } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, email, role, branch, via_link")
    .eq("id", userId)
    .maybeSingle();
  if (!user) notFound();
  const isSelf = user.id === profile.id;

  return (
    <>
      <AppHeader profile={profile} title={t("users.editTitle")} backHref="/admin/users" />
      <main className="mx-auto max-w-xl space-y-5 px-4 py-5">
        {user.via_link && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("users.viaLink")}</p>}
        {isSelf && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">{t("users.selfHint")}</p>}

        <div className="card">
          <ActionForm action={updateUser} submitLabel={t("common.save")} resetOnSuccess={false}>
            <input type="hidden" name="user_id" value={user.id} />
            <UserFields user={{ ...user, role: user.role as Role }} lockRole={isSelf} />
          </ActionForm>
        </div>

        {!isSelf && (
          <form action={deleteUser} className="text-center">
            <input type="hidden" name="user_id" value={user.id} />
            <ConfirmButton
              message={t("users.deleteConfirm", { name: user.full_name || user.email })}
              className="min-h-11 rounded-xl px-4 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              {t("users.delete")}
            </ConfirmButton>
          </form>
        )}
      </main>
    </>
  );
}
