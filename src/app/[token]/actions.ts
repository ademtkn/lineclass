"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { claimOrVerify } from "@/lib/claims";
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

/** Zaten giriş yapmış öğretmen linki açtıysa: sınıfı listesine ekler, ders seçimine götürür. */
export async function joinAsCurrent(token: string) {
  const cls = await findClassByToken(token);
  const profile = await getProfile();
  if (!cls || !profile) redirect(`/${token}`);

  if (profile.role === "super_admin") redirect(`/${token}`);
  await grantAccess(profile.id, cls.id);
  redirect(profile.role === "branch_teacher" ? `/teacher/classes/${cls.id}/subjects` : `/teacher/classes/${cls.id}`);
}

/**
 * Listeden adına dokunan öğretmen: ad bu cihazda alınabiliyorsa (boş ya da bu cihaza ait) girer.
 * Başka cihazda alınmışsa girilemez: sınıf öğretmeni kilidi sıfırlamalıdır.
 */
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
  if (!teacher || teacher.role !== "branch_teacher" || !teacher.via_link || !access) redirect(`/${token}`);
  if (!(await claimOrVerify(teacherId))) redirect(`/${token}?adim=ogretmen&kilit=1`);

  await signInWithoutPassword(teacherId);
  redirect(`/teacher/classes/${cls.id}/subjects`);
}

/** Listede olmayan öğretmen: yalnızca adını yazar; dersleri bir sonraki adımda seçer. */
export async function joinAsNew(token: string, _prev: JoinState, fd: FormData): Promise<JoinState> {
  const cls = await findClassByToken(token);
  const { t } = await getT();
  if (!cls) return { error: t("join.errLink") };

  const fullName = String(fd.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  if (fullName.length < 3) return { error: t("join.errName") };
  const admin = createAdminClient();

  // Aynı adla linkle oluşturulmuş bir hesap varsa (başka sınıftan) yalnızca bu cihaz sahibiyse kullanılır.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "branch_teacher")
    .eq("via_link", true)
    .ilike("full_name", fullName.replace(/[\\%_]/g, "\\$&"))
    .limit(1)
    .maybeSingle();

  let teacherId = existing?.id;
  if (teacherId) {
    if (!(await claimOrVerify(teacherId))) return { error: t("join.errTaken") };
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: `link-${randomUUID()}@ogretmen.lineclass.local`,
      // Kimsenin bilmediği rastgele şifre: hesap sadece sınıf linkiyle açılır
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
      app_metadata: { role: "branch_teacher", via_link: true },
      user_metadata: { full_name: fullName, branch: null },
    });
    if (error) return { error: t("join.errCreate") };
    teacherId = data.user.id;
    await claimOrVerify(teacherId);
  }

  await grantAccess(teacherId, cls.id);
  await signInWithoutPassword(teacherId);
  redirect(`/teacher/classes/${cls.id}/subjects`);
}

/** "Ben bu kişi değilim": mevcut oturumu kapatıp aynı linke döner. */
export async function switchUser(token: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${token}?adim=ogretmen`);
}
