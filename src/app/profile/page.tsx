import { AccountForm } from "@/components/AccountForm";
import { AppHeader } from "@/components/AppHeader";
import { ProfileForm } from "@/components/ProfileForm";
import { homeFor, requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";

export default async function ProfilePage() {
  const profile = await requireRole();
  const { t } = await getT();
  return (
    <>
      <AppHeader profile={profile} title={t("account.title")} backHref={homeFor(profile.role)} />
      <main className="mx-auto max-w-xl px-4 py-6">
        {profile.role === "branch_teacher" ? (
          // Link ile katılan branş öğretmeninin şifresi/e-postası yok: sadece ad ve branş
          <ProfileForm fullName={profile.full_name} branch={profile.branch} />
        ) : (
          <AccountForm fullName={profile.full_name} branch={profile.branch} email={profile.email} />
        )}
      </main>
    </>
  );
}
