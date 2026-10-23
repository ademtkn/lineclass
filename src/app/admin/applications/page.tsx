import { AppHeader } from "@/components/AppHeader";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ApplicationCard, type Application } from "./ApplicationCard";

/** Yönetici: sınıf öğretmeni başvurularını inceler, onaylar (hesap + sınıf açılır) veya reddeder. */
export default async function ApplicationsPage() {
  const profile = await requireRole("super_admin");
  const { t } = await getT();
  const { data } = await createAdminClient()
    .from("teacher_applications")
    .select("id, full_name, email, phone, school, class_name, city, address, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const apps = (data ?? []) as Application[];
  const pendingCount = apps.filter((a) => a.status === "pending").length;
  // Tek liste, bekleyenler üstte: onaylanan kart aynı yerde (aynı anahtarla) kalır,
  // böylece üretilen geçici şifre ekranda görünmeye devam eder.
  const sorted = [...apps.filter((a) => a.status === "pending"), ...apps.filter((a) => a.status !== "pending")];

  return (
    <>
      <AppHeader profile={profile} title={t("applications.title")} backHref="/admin/users" />
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-5">
        <h2 className="text-lg font-bold">{t("applications.pending", { n: pendingCount })}</h2>
        {sorted.length === 0 && <p className="card text-sm text-slate-500">{t("applications.none")}</p>}
        <ul className="space-y-3">
          {sorted.map((a) => <ApplicationCard key={a.id} app={a} />)}
        </ul>
      </main>
    </>
  );
}
