"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { Role } from "@/lib/types";

export type FormState = { error?: string; ok?: string };

const ROLES: Role[] = ["super_admin", "class_teacher", "branch_teacher"];
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ---------------------------------------------------------------- Kullanıcılar (super admin)

export async function createUser(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("super_admin");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const fullName = str(fd, "full_name");
  const role = str(fd, "role") as Role;
  const branch = str(fd, "branch") || null;

  if (!email || !fullName) return { error: "Ad ve e-posta gerekli." };
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  if (!ROLES.includes(role)) return { error: "Geçersiz rol." };

  // auth.users kaydı service-role ister; profil satırını DB trigger'ı oluşturur.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, branch },
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/manage");
  return { ok: `${fullName} oluşturuldu.` };
}

export async function updateUserRole(fd: FormData) {
  await requireRole("super_admin");
  const role = str(fd, "role") as Role;
  if (!ROLES.includes(role)) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", str(fd, "user_id"));
  revalidatePath("/admin/manage");
}

// ---------------------------------------------------------------- Sınıflar (super admin)

export async function createClass(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("super_admin");
  const name = str(fd, "name").toUpperCase();
  const teacherId = str(fd, "class_teacher_id") || null;
  if (!name) return { error: "Sınıf adı gerekli." };

  const supabase = await createClient();
  const { error } = await supabase.from("classes").insert({ name, class_teacher_id: teacherId });
  if (error) return { error: error.code === "23505" ? "Bu sınıf zaten var." : error.message };
  if (teacherId) await promoteToClassTeacher(teacherId);

  revalidatePath("/admin", "layout");
  return { ok: `${name} oluşturuldu.` };
}

export async function setClassTeacher(fd: FormData) {
  await requireRole("super_admin");
  const teacherId = str(fd, "class_teacher_id") || null;
  const supabase = await createClient();
  await supabase.from("classes").update({ class_teacher_id: teacherId }).eq("id", str(fd, "class_id"));
  if (teacherId) await promoteToClassTeacher(teacherId);
  revalidatePath("/admin", "layout");
}

export async function deleteClass(fd: FormData) {
  await requireRole("super_admin");
  const supabase = await createClient();
  await supabase.from("classes").delete().eq("id", str(fd, "class_id"));
  revalidatePath("/admin", "layout");
}

/** Sınıf öğretmeni atanan branş öğretmeninin rolünü yükseltir (admin rolüne dokunmaz). */
async function promoteToClassTeacher(userId: string) {
  const supabase = await createClient();
  await supabase.from("profiles").update({ role: "class_teacher" }).eq("id", userId).eq("role", "branch_teacher");
}

// ---------------------------------------------------------------- Öğrenciler & atamalar
// (super admin veya o sınıfın sınıf öğretmeni — yetkiyi RLS doğrular)

export async function addStudent(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("super_admin", "class_teacher");
  const classId = str(fd, "class_id");
  const firstName = str(fd, "first_name");
  const lastName = str(fd, "last_name");
  const shortInfo = str(fd, "short_info") || null;
  const photo = fd.get("photo");
  if (!firstName || !lastName) return { error: "Ad ve soyad gerekli." };

  const supabase = await createClient();
  let photoUrl: string | null = null;

  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) return { error: "Fotoğraf bir görsel dosyası olmalı." };
    if (photo.size > 5 * 1024 * 1024) return { error: "Fotoğraf en fazla 5 MB olabilir." };
    const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${classId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("student-photos")
      .upload(path, photo, { contentType: photo.type });
    if (upErr) return { error: "Fotoğraf yüklenemedi: " + upErr.message };
    photoUrl = supabase.storage.from("student-photos").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("students").insert({
    class_id: classId,
    first_name: firstName,
    last_name: lastName,
    short_info: shortInfo,
    photo_url: photoUrl,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/classes/${classId}`);
  return { ok: `${firstName} ${lastName} eklendi.` };
}

export async function deleteStudent(fd: FormData) {
  await requireRole("super_admin", "class_teacher");
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", str(fd, "student_id"));
  revalidatePath(`/admin/classes/${str(fd, "class_id")}`);
}

export async function assignTeacher(fd: FormData) {
  await requireRole("super_admin", "class_teacher");
  const classId = str(fd, "class_id");
  const teacherId = str(fd, "teacher_id");
  if (!teacherId) return;
  const supabase = await createClient();
  await supabase.from("teacher_class_access").upsert({ class_id: classId, teacher_id: teacherId });
  revalidatePath(`/admin/classes/${classId}`);
}

export async function unassignTeacher(fd: FormData) {
  await requireRole("super_admin", "class_teacher");
  const classId = str(fd, "class_id");
  const supabase = await createClient();
  await supabase
    .from("teacher_class_access")
    .delete()
    .eq("class_id", classId)
    .eq("teacher_id", str(fd, "teacher_id"));
  revalidatePath(`/admin/classes/${classId}`);
}

/** Sınıf davet linkini yeniler; eski link anında geçersiz olur (yetkiyi DB fonksiyonu denetler). */
export async function regenerateJoinToken(classId: string) {
  await requireRole("super_admin", "class_teacher");
  const supabase = await createClient();
  await supabase.rpc("regenerate_join_token", { p_class_id: classId });
  revalidatePath(`/admin/classes/${classId}`);
}
