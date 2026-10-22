"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { BRANCHES } from "@/lib/i18n/branches";
import { getT } from "@/lib/i18n/server";
import { findClassByToken } from "@/lib/join";

export type JoinState = { error?: string };

/**
 * Şifre sormadan oturum açar: sunucuda tek kullanımlık giriş anahtarı üretip hemen doğrular.
 * E-posta, değiştirilebilir profil tablosundan değil doğrudan Auth kaydından alınır.
 */
async function signInWithoutPassword(userId: string) {
  const admin = createAdminClient();
  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !authUser.user.email) throw userError ?? new Error("kullanıcı bulunamadı");
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: authUser.user.email });
  if (error) throw error;

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
}

async function grantAccess(teacherId: string, classId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("teacher_class_access")
    .upsert({ teacher_id: teacherId, class_id: classId }, { ignoreDuplicates: true });
  if (error) throw error;
}

/** Zaten giriş yapmış öğretmen linki açtıysa: sınıfı kendi listesine ekler. */
export async function joinAsCurrent(token: string) {
  const cls = await findClassByToken(token);
  const profile = await getProfile();
  if (!cls || !profile) redirect(`/${token}`);

  if (profile.role !== "super_admin") await grantAccess(profile.id, cls.id);
  redirect(`/teacher/classes/${cls.id}`);
}

/** Bu sınıfa daha önce katılmış bir branş öğretmeni olarak devam eder. */
export async function joinAsExisting(token: string, fd: FormData) {
  const teacherId = String(fd.get("teacher_id") ?? "");
  const cls = await findClassByToken(token);
  if (!cls) redirect(`/${token}`);

  const admin = createAdminClient();
  const [{ data: teacher }, { data: access }] = await Promise.all([
    admin.from("profiles").select("role, via_link").eq("id", teacherId).maybeSingle(),
    admin
      .from("teacher_class_access")
      .select("teacher_id")
      .eq("teacher_id", teacherId)
      .eq("class_id", cls.id)
      .maybeSingle(),
  ]);
  // Link yalnızca bu sınıfa erişimi olan ve LİNKLE oluşturulmuş branş öğretmeni hesaplarını açar.
  // Şifreyle oluşturulan hesaplar (admin, sınıf öğretmeni, admin'in açtığı öğretmenler) linkle açılamaz.
  if (!teacher || teacher.role !== "branch_teacher" || !teacher.via_link || !access) redirect(`/${token}`);

  await signInWithoutPassword(teacherId);
  redirect(`/teacher/classes/${cls.id}`);
}

/** İlk kez gelen öğretmen: ad + branş ile şifresiz hesap açılır ve sınıfa eklenir. */
export async function joinAsNew(token: string, _prev: JoinState, fd: FormData): Promise<JoinState> {
  const cls = await findClassByToken(token);
  const { t } = await getT();
  if (!cls) return { error: t("join.errLink") };

  const fullName = String(fd.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const branch = String(fd.get("branch") ?? "");
  if (fullName.length < 3) return { error: t("join.errName") };
  const admin = createAdminClient();
  if (!BRANCHES.includes(branch)) {
    const { data: custom } = await admin
      .from("class_subjects")
      .select("id")
      .eq("class_id", cls.id)
      .eq("subject", branch)
      .maybeSingle();
    if (!custom) return { error: t("join.errBranch") };
  }

  // Aynı ad + branşla daha önce (başka bir sınıfın linkinden) katılmışsa aynı hesabı kullan.
  // Yalnızca linkle oluşturulmuş hesaplar eşleşir: şifreli bir hesabın adını yazmak onu açmaz.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "branch_teacher")
    .eq("via_link", true)
    .eq("branch", branch)
    .ilike("full_name", fullName.replace(/[\\%_]/g, "\\$&"))
    .limit(1)
    .maybeSingle();

  let teacherId = existing?.id;

  if (!teacherId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `link-${randomUUID()}@ogretmen.lineclass.local`,
      // Kimsenin bilmediği rastgele şifre: hesap sadece sınıf linkiyle açılır
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
      app_metadata: { role: "branch_teacher", via_link: true },
      user_metadata: { full_name: fullName, branch },
    });
    if (error) return { error: t("join.errCreate") };
    teacherId = data.user.id;
  }

  await grantAccess(teacherId, cls.id);
  // Branşı, sınıfın öğretmeni olmayan bir dersiyle eşleşiyorsa o derse otomatik ata
  await admin
    .from("class_subjects")
    .update({ teacher_id: teacherId })
    .eq("class_id", cls.id)
    .eq("subject", branch)
    .is("teacher_id", null);
  await signInWithoutPassword(teacherId);
  redirect(`/teacher/classes/${cls.id}`);
}

/** "Ben bu kişi değilim": mevcut oturumu kapatıp aynı linke döner. */
export async function switchUser(token: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${token}?adim=ogretmen`);
}
