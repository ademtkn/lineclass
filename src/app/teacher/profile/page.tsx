import { AppHeader } from "@/components/AppHeader";
import { ProfileForm } from "@/components/ProfileForm";
import { requireRole } from "@/lib/auth";

export default async function ProfilePage() {
  const profile = await requireRole("branch_teacher", "class_teacher");
  return (
    <>
      <AppHeader profile={profile} title="Profilim" backHref="/teacher" />
      <main className="mx-auto max-w-xl px-4 py-6">
        <ProfileForm fullName={profile.full_name} branch={profile.branch} />
      </main>
    </>
  );
}
