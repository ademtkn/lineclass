"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { BRANCH_NAMES, type SubjectNames } from "@/lib/i18n/branches";
import { LOCALES } from "@/lib/i18n/locales";
import { getT } from "@/lib/i18n/server";
import type { Role } from "@/lib/types";

export type FormState = { error?: string; ok?: string };

const ROLES: Role[] = ["super_admin", "class_teacher", "branch_teacher"];
// Uzantı istemcinin dosya adından değil türden belirlenir (bucket da aynı listeyi zorlar)
const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ================================================================ Kullanıcılar (yalnızca super admin)
// Yöneticinin tek görevi: kullanıcı eklemek; görevini, şifresini ve bilgilerini belirlemek.

export async function createUser(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("super_admin");
  const { t } = await getT();
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const fullName = str(fd, "full_name");
  const role = str(fd, "role") as Role;
  const branch = str(fd, "branch") || null;

  if (!email || !fullName) return { error: t("users.errRequired") };
  if (!EMAIL_RE.test(email)) return { error: t("account.errEmail") };
  if (password.length < 8) return { error: t("users.errPassword") };
  if (!ROLES.includes(role)) return { error: t("users.errRole") };

  // auth.users kaydı service-role ister; profil satırını DB trigger'ı oluşturur.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Rol app_metadata'da: yalnızca sunucu yazabilir (bkz. 0006)
    app_metadata: { role },
    user_metadata: { full_name: fullName, branch },
  });
  if (error) return { error: error.code === "email_exists" ? t("users.errEmailTaken") : t("users.errGeneric") };

  revalidatePath("/admin/users");
  return { ok: t("users.created", { name: fullName }) };
}

export async function updateUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("super_admin");
  const { t } = await getT();
  const userId = str(fd, "user_id");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const fullName = str(fd, "full_name");
  const role = str(fd, "role") as Role;
  const branch = str(fd, "branch") || null;

  if (!userId || !email || !fullName) return { error: t("users.errRequired") };
  if (!EMAIL_RE.test(email)) return { error: t("account.errEmail") };
  if (password && password.length < 8) return { error: t("users.errPassword") };
  if (!ROLES.includes(role)) return { error: t("users.errRole") };

  const admin = createAdminClient();
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  if (!existing.user) return { error: t("users.errGeneric") };
  // Yönetici kendi görevini düşüremez (sistem yöneticisiz kalmasın)
  const newRole = userId === me.id ? me.role : role;

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: email !== existing.user.email ? email : undefined,
    email_confirm: email !== existing.user.email ? true : undefined,
    password: password || undefined,
    app_metadata: { ...existing.user.app_metadata, role: newRole },
  });
  if (error) return { error: error.code === "email_exists" ? t("users.errEmailTaken") : t("users.errGeneric") };

  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: fullName, email, branch })
    .eq("id", userId);
  if (pErr) return { error: t("users.errGeneric") };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: t("users.saved") };
}

export async function deleteUser(fd: FormData) {
  const me = await requireRole("super_admin");
  const userId = str(fd, "user_id");
  if (!userId || userId === me.id) return;
  await createAdminClient().auth.admin.deleteUser(userId);
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

// ================================================================ Sınıf (yalnızca sınıf öğretmeni)
// Sınıfı sınıf öğretmeni kendisi açar; yetkiyi ayrıca RLS doğrular (bkz. 0008).

export async function createClass(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("class_teacher");
  const { t } = await getT();
  const name = str(fd, "name").toUpperCase().replace(/\s+/g, " ");
  if (!name || name.length > 40) return { error: t("classAdmin.errName") };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({ name, class_teacher_id: me.id })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? t("classAdmin.errExists") : t("users.errGeneric") };

  revalidatePath("/admin", "layout");
  redirect(`/admin/classes/${data.id}`);
}

export async function renameClass(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("class_teacher");
  const { t } = await getT();
  const classId = str(fd, "class_id");
  const name = str(fd, "name").toUpperCase().replace(/\s+/g, " ");
  if (!name || name.length > 40) return { error: t("classAdmin.errName") };

  const supabase = await createClient();
  const { error } = await supabase.from("classes").update({ name }).eq("id", classId);
  if (error) return { error: error.code === "23505" ? t("classAdmin.errExists") : t("users.errGeneric") };

  revalidatePath("/admin", "layout");
  return { ok: t("common.saved") };
}

export async function deleteClass(fd: FormData) {
  await requireRole("class_teacher");
  const supabase = await createClient();
  await supabase.from("classes").delete().eq("id", str(fd, "class_id"));
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

// ================================================================ Öğrenciler (sınıf öğretmeni)

async function uploadPhoto(classId: string, photo: FormDataEntryValue | null) {
  const { t } = await getT();
  if (!(photo instanceof File) || photo.size === 0) return { url: null };
  const ext = PHOTO_TYPES[photo.type];
  if (!ext) return { error: t("student.errPhotoType") };
  if (photo.size > 5 * 1024 * 1024) return { error: t("student.errPhotoSize") };

  const supabase = await createClient();
  const path = `${classId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("student-photos").upload(path, photo, { contentType: photo.type });
  if (error) return { error: t("student.errUpload") };
  return { url: supabase.storage.from("student-photos").getPublicUrl(path).data.publicUrl };
}

export async function addStudent(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("class_teacher");
  const { t } = await getT();
  const classId = str(fd, "class_id");
  const firstName = str(fd, "first_name");
  const lastName = str(fd, "last_name");
  const shortInfo = str(fd, "short_info") || null;
  if (!firstName || !lastName) return { error: t("student.errName") };

  const photo = await uploadPhoto(classId, fd.get("photo"));
  if ("error" in photo) return { error: photo.error };

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    class_id: classId,
    first_name: firstName,
    last_name: lastName,
    short_info: shortInfo,
    photo_url: photo.url,
  });
  if (error) return { error: t("users.errGeneric") };

  revalidatePath(`/admin/classes/${classId}`);
  revalidatePath("/admin");
  return { ok: t("student.added", { name: `${firstName} ${lastName}` }) };
}

export async function updateStudent(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("class_teacher");
  const { t } = await getT();
  const studentId = str(fd, "student_id");
  const classId = str(fd, "class_id");
  const firstName = str(fd, "first_name");
  const lastName = str(fd, "last_name");
  const shortInfo = str(fd, "short_info") || null;
  if (!firstName || !lastName) return { error: t("student.errName") };

  const photo = await uploadPhoto(classId, fd.get("photo"));
  if ("error" in photo) return { error: photo.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      first_name: firstName,
      last_name: lastName,
      short_info: shortInfo,
      ...(photo.url ? { photo_url: photo.url } : {}),
    })
    .eq("id", studentId)
    .eq("class_id", classId);
  if (error) return { error: t("users.errGeneric") };

  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath(`/admin/classes/${classId}`);
  revalidatePath("/admin");
  return { ok: t("student.updated", { name: `${firstName} ${lastName}` }) };
}

export async function deleteStudent(fd: FormData) {
  await requireRole("class_teacher");
  const classId = str(fd, "class_id");
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", str(fd, "student_id")).eq("class_id", classId);
  revalidatePath(`/admin/classes/${classId}`);
  revalidatePath("/admin");
  if (str(fd, "redirect")) redirect(`/admin?class=${classId}`);
}

// ================================================================ Öğretmen erişimi & davet linki

export async function assignTeacher(fd: FormData) {
  await requireRole("class_teacher");
  const classId = str(fd, "class_id");
  const teacherId = str(fd, "teacher_id");
  if (!teacherId) return;
  const supabase = await createClient();
  await supabase.from("teacher_class_access").upsert({ class_id: classId, teacher_id: teacherId });
  revalidatePath(`/admin/classes/${classId}`);
}

export async function unassignTeacher(fd: FormData) {
  await requireRole("class_teacher");
  const classId = str(fd, "class_id");
  const teacherId = str(fd, "teacher_id");
  const supabase = await createClient();
  // Öğretmen sınıftan çıkarılınca verdiği derslerden de düşer
  await supabase.from("class_subjects").update({ teacher_id: null }).eq("class_id", classId).eq("teacher_id", teacherId);
  await supabase.from("teacher_class_access").delete().eq("class_id", classId).eq("teacher_id", teacherId);
  revalidatePath(`/admin/classes/${classId}`);
}

/** Sınıf davet linkini yeniler; eski link anında geçersiz olur (yetkiyi DB fonksiyonu denetler). */
export async function regenerateJoinToken(classId: string) {
  await requireRole("class_teacher");
  const supabase = await createClient();
  await supabase.rpc("regenerate_join_token", { p_class_id: classId });
  revalidatePath(`/admin/classes/${classId}`);
}

// ================================================================ Dersler (sınıf öğretmeni, 4 dilde ad)
// Derse öğretmen atamak sınıf erişimini de verir (DB tetikleyicisi senkronlar).

/** Formdaki name_tr/name_en/name_ky/name_ru alanlarından boş olmayanları toplar. */
function namesFrom(fd: FormData): SubjectNames {
  const names: SubjectNames = {};
  for (const l of LOCALES) {
    const v = str(fd, `name_${l}`).replace(/\s+/g, " ").slice(0, 60);
    if (v) names[l] = v;
  }
  return names;
}

export async function addSubject(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("class_teacher");
  const { t } = await getT();
  const classId = str(fd, "class_id");
  const branch = str(fd, "subject");

  // Hazır ders çipi: 4 dildeki ad sözlükten gelir. Özel ders: öğretmen 4 dilde yazar.
  let subject: string;
  let names: SubjectNames;
  if (branch && BRANCH_NAMES[branch]) {
    subject = branch;
    names = { ...BRANCH_NAMES[branch] };
  } else {
    names = namesFrom(fd);
    const first = names.tr ?? names.en ?? names.ky ?? names.ru;
    if (!first) return { error: t("subjects.errName") };
    subject = first;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_subjects")
    .upsert({ class_id: classId, subject, names }, { onConflict: "class_id,subject", ignoreDuplicates: true });
  if (error) return { error: t("users.errGeneric") };

  revalidatePath(`/admin/classes/${classId}`);
  return { ok: t("common.saved") };
}

export async function updateSubjectNames(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("class_teacher");
  const { t } = await getT();
  const classId = str(fd, "class_id");
  const names = namesFrom(fd);
  if (!Object.keys(names).length) return { error: t("subjects.errName") };

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_subjects")
    .update({ names })
    .eq("id", str(fd, "subject_id"))
    .eq("class_id", classId);
  if (error) return { error: t("users.errGeneric") };

  revalidatePath(`/admin/classes/${classId}`);
  return { ok: t("common.saved") };
}

export async function setSubjectTeacher(fd: FormData) {
  await requireRole("class_teacher");
  const classId = str(fd, "class_id");
  const supabase = await createClient();
  await supabase
    .from("class_subjects")
    .update({ teacher_id: str(fd, "teacher_id") || null })
    .eq("id", str(fd, "subject_id"))
    .eq("class_id", classId);
  revalidatePath(`/admin/classes/${classId}`);
}

export async function deleteSubject(fd: FormData) {
  await requireRole("class_teacher");
  const classId = str(fd, "class_id");
  const supabase = await createClient();
  await supabase.from("class_subjects").delete().eq("id", str(fd, "subject_id")).eq("class_id", classId);
  revalidatePath(`/admin/classes/${classId}`);
}
