"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { BRANCHES } from "@/lib/types";
import { findClassByToken } from "@/lib/join";

export type JoinState = { error?: string };

/** Şifre sormadan oturum açar: sunucuda tek kullanımlık giriş anahtarı üretip hemen doğrular. */
async function signInWithoutPassword(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
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
  if (!cls || !profile) redirect(`/join/${token}`);

  if (profile.role !== "super_admin") await grantAccess(profile.id, cls.id);
  redirect(`/teacher/classes/${cls.id}`);
}

/** Bu sınıfa daha önce katılmış bir branş öğretmeni olarak devam eder. */
export async function joinAsExisting(token: string, teacherId: string) {
  const cls = await findClassByToken(token);
  if (!cls) redirect(`/join/${token}`);

  const admin = createAdminClient();
  const [{ data: teacher }, { data: access }] = await Promise.all([
    admin.from("profiles").select("email, role").eq("id", teacherId).maybeSingle(),
    admin
      .from("teacher_class_access")
      .select("teacher_id")
      .eq("teacher_id", teacherId)
      .eq("class_id", cls.id)
      .maybeSingle(),
  ]);
  // Link yalnızca bu sınıfa atanmış BRANŞ öğretmenleri için şifresiz giriş sağlar;
  // sınıf öğretmeni ve admin hesapları her zaman şifreyle girer.
  if (!teacher || teacher.role !== "branch_teacher" || !access) redirect(`/join/${token}`);

  await signInWithoutPassword(teacher.email);
  redirect(`/teacher/classes/${cls.id}`);
}

/** İlk kez gelen öğretmen: ad + branş ile şifresiz hesap açılır ve sınıfa eklenir. */
export async function joinAsNew(token: string, _prev: JoinState, fd: FormData): Promise<JoinState> {
  const cls = await findClassByToken(token);
  if (!cls) return { error: "Bu link artık geçerli değil. Sınıf öğretmeninizden yeni link isteyin." };

  const fullName = String(fd.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const branch = String(fd.get("branch") ?? "");
  if (fullName.length < 3) return { error: "Lütfen adınızı ve soyadınızı yazın." };
  if (!BRANCHES.includes(branch)) return { error: "Lütfen branşınızı seçin." };

  const admin = createAdminClient();

  // Aynı ad + branşla daha önce (başka bir sınıfın linkinden) katılmışsa aynı hesabı kullan
  const { data: existing } = await admin
    .from("profiles")
    .select("id, email")
    .eq("role", "branch_teacher")
    .eq("branch", branch)
    .ilike("full_name", fullName.replace(/[\\%_]/g, "\\$&"))
    .limit(1)
    .maybeSingle();

  let teacherId = existing?.id;
  let email = existing?.email;

  if (!teacherId) {
    email = `link-${randomUUID()}@ogretmen.lineclass.local`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      // Kimsenin bilmediği rastgele şifre: hesap sadece sınıf linkiyle açılır
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
      user_metadata: { full_name: fullName, branch, role: "branch_teacher", via_link: true },
    });
    if (error) return { error: "Hesap oluşturulamadı: " + error.message };
    teacherId = data.user.id;
  }

  await grantAccess(teacherId, cls.id);
  await signInWithoutPassword(email!);
  redirect(`/teacher/classes/${cls.id}`);
}

/** "Ben bu kişi değilim": mevcut oturumu kapatıp aynı linke döner. */
export async function switchUser(token: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/join/${token}`);
}
