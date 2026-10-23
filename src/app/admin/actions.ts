"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { BRANCH_NAMES, type SubjectNames } from "@/lib/i18n/branches";
import { LOCALES } from "@/lib/i18n/locales";
import { getT } from "@/lib/i18n/server";
import { ownedTeacherIds } from "@/lib/teachers";
import { BRANCHES } from "@/lib/i18n/branches";
import { MAX_UPLOAD_BYTES, removePhotos, shrinkPhoto } from "@/lib/photo";
import type { Role } from "@/lib/types";

export type FormState = { error?: string; ok?: string };

const ROLES: Role[] = ["super_admin", "class_teacher", "branch_teacher"];
// Yalnızca bu görsel türleri kabul edilir; kaydedilen dosya her zaman küçültülmüş WebP'dir.
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"]);
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
  const classId = str(fd, "class_id");
  // Sınıf silinince öğrencileri de silinir: fotoğraf dosyaları sunucuda kalmasın
  const { data: photos } = await supabase.from("students").select("photo_url").eq("class_id", classId);
  const { data: gone } = await supabase.from("classes").delete().eq("id", classId).select("id");
  if (gone?.length) await removePhotos((photos ?? []).map((p) => p.photo_url));
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

// ================================================================ Öğrenciler (sınıf öğretmeni)

async function uploadPhoto(classId: string, photo: FormDataEntryValue | null) {
  const { t } = await getT();
  if (!(photo instanceof File) || photo.size === 0) return { url: null };
  if (!PHOTO_TYPES.has(photo.type)) return { error: t("student.errPhotoType") };
  if (photo.size > MAX_UPLOAD_BYTES) return { error: t("student.errPhotoSize") };

  let data: Buffer;
  try {
    data = await shrinkPhoto(photo);
  } catch {
    // Çözülemeyen dosya (ör. desteklenmeyen HEIC türü)
    return { error: t("student.errPhotoRead") };
  }

  const supabase = await createClient();
  const path = `${classId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("student-photos").upload(path, data, { contentType: "image/webp" });
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
  if (error) {
    await removePhotos([photo.url]);
    return { error: t("users.errGeneric") };
  }

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
  const { data: before } = await supabase
    .from("students")
    .select("photo_url")
    .eq("id", studentId)
    .eq("class_id", classId)
    .maybeSingle();
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
  if (error) {
    await removePhotos([photo.url]); // kaydedilemediyse yeni dosya sunucuda yetim kalmasın
    return { error: t("users.errGeneric") };
  }
  if (photo.url) await removePhotos([before?.photo_url]); // eski fotoğraf sunucudan silinir

  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath(`/admin/classes/${classId}`);
  revalidatePath("/admin");
  return { ok: t("student.updated", { name: `${firstName} ${lastName}` }) };
}

/** Öğrenciyi kalıcı siler: kaydı, notları (cascade) ve sunucudaki fotoğraf dosyası. */
export async function deleteStudent(fd: FormData) {
  await requireRole("class_teacher");
  const classId = str(fd, "class_id");
  const studentId = str(fd, "student_id");
  const supabase = await createClient();
  // RLS: yalnızca kendi sınıfının öğrencisi silinebilir; silinen satırın fotoğraf yolu geri döner
  const { data: gone } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId)
    .eq("class_id", classId)
    .select("photo_url");
  await removePhotos((gone ?? []).map((s) => s.photo_url));
  revalidatePath(`/admin/classes/${classId}`);
  revalidatePath("/admin");
  if (str(fd, "redirect")) redirect(`/admin?class=${classId}`);
}

/** Pasif öğrenci listelerden kalkar ama silinmez; istenirse tekrar aktif edilir. */
export async function setStudentActive(fd: FormData) {
  await requireRole("class_teacher");
  const classId = str(fd, "class_id");
  const studentId = str(fd, "student_id");
  const supabase = await createClient();
  await supabase
    .from("students")
    .update({ active: str(fd, "active") === "1" })
    .eq("id", studentId)
    .eq("class_id", classId);
  revalidatePath(`/admin/classes/${classId}`);
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin");
  revalidatePath("/teacher", "layout");
  if (str(fd, "redirect")) redirect(`/admin/classes/${classId}`);
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

  // Çip: sınıf öğretmeninin diğer sınıflarındaki ders (adlar oradan kopyalanır). Yoksa 4 dilde yeni ders yazılır.
  const supabase = await createClient();
  let subject: string;
  let names: SubjectNames;
  if (branch) {
    const { data: known } = await supabase.from("class_subjects").select("subject, names").eq("subject", branch).limit(1).maybeSingle();
    if (!known) return { error: t("subjects.errName") };
    subject = known.subject;
    names = (known.names as SubjectNames | null) ?? BRANCH_NAMES[branch] ?? { tr: branch };
  } else {
    names = namesFrom(fd);
    const first = names.tr ?? names.en ?? names.ky ?? names.ru;
    if (!first) return { error: t("subjects.errName") };
    subject = first;
  }

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

// ================================================================ Öğretmen hesabı (sınıf öğretmeni, yalnızca kendi öğretmenleri)

/** Hedef, bu sınıf öğretmeninin sınıflarına giren bir branş öğretmeni mi (ve başkasının sınıfında yok mu)? */
async function ownedBranchTeacher(meId: string, teacherId: string) {
  if (!teacherId) return false;
  const { data } = await createAdminClient().from("profiles").select("role").eq("id", teacherId).maybeSingle();
  if (data?.role !== "branch_teacher") return false;
  return (await ownedTeacherIds(meId, [teacherId])).has(teacherId);
}

export async function updateTeacher(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("class_teacher");
  const { t } = await getT();
  const teacherId = str(fd, "teacher_id");
  const fullName = str(fd, "full_name").replace(/\s+/g, " ");
  const branch = str(fd, "branch") || null;
  if (fullName.length < 3) return { error: t("join.errName") };
  if (branch && !BRANCHES.includes(branch)) {
    // Özel dersler: branş, kendi sınıflarındaki bir dersin adı olabilir
    const { data: mine } = await (await createClient()).from("class_subjects").select("id").eq("subject", branch).limit(1);
    if (!mine?.length) return { error: t("join.errBranch") };
  }
  if (!(await ownedBranchTeacher(me.id, teacherId))) return { error: t("teacherEdit.errNotAllowed") };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ full_name: fullName, branch })
    .eq("id", teacherId);
  if (error) return { error: t("users.errGeneric") };

  revalidatePath("/admin", "layout");
  return { ok: t("common.saved") };
}

/** Öğretmen hesabını tamamen siler (yazdığı notlar dahil). Yalnızca kendi sınıflarındaki öğretmenler. */
export async function deleteTeacher(fd: FormData) {
  const me = await requireRole("class_teacher");
  const teacherId = str(fd, "teacher_id");
  if (!(await ownedBranchTeacher(me.id, teacherId))) return;
  await createAdminClient().auth.admin.deleteUser(teacherId);
  revalidatePath("/admin", "layout");
}

// ================================================================ Sınıf öğretmeni başvuruları (yalnızca super admin)

export type ApprovalState = FormState & { email?: string; password?: string; className?: string };

// Karıştırılabilen karakterler (0/O, 1/l/I) yok: şifre telefonla/WhatsApp'la iletilebilsin
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePassword(length = 10) {
  return Array.from(randomBytes(length), (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
}

export async function approveApplication(_prev: ApprovalState, fd: FormData): Promise<ApprovalState> {
  await requireRole("super_admin");
  const { t } = await getT();
  const admin = createAdminClient();
  const { data: app } = await admin
    .from("teacher_applications")
    .select("*")
    .eq("id", str(fd, "application_id"))
    .eq("status", "pending")
    .maybeSingle();
  if (!app) return { error: t("applications.errGone") };

  const password = generatePassword();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: app.email.toLowerCase(),
    password,
    email_confirm: true,
    app_metadata: { role: "class_teacher" },
    user_metadata: { full_name: app.full_name, branch: null },
  });
  if (error || !created.user) {
    return { error: error?.code === "email_exists" ? t("users.errEmailTaken") : t("users.errGeneric") };
  }

  // Başvurudaki sınıfı hazırla: öğretmen ilk girişte boş bir sınıf formuyla karşılaşmasın
  const className = String(app.class_name).toUpperCase().replace(/\s+/g, " ");
  const { error: classError } = await admin
    .from("classes")
    .insert({ name: className, class_teacher_id: created.user.id });
  if (classError) console.error("approveApplication: class insert failed", classError);

  await admin
    .from("teacher_applications")
    .update({ status: "approved", user_id: created.user.id, reviewed_at: new Date().toISOString() })
    .eq("id", app.id);

  revalidatePath("/admin/applications");
  revalidatePath("/admin/users");
  return { ok: t("applications.approved"), email: app.email.toLowerCase(), password, className: classError ? undefined : className };
}

export async function rejectApplication(fd: FormData) {
  await requireRole("super_admin");
  await createAdminClient()
    .from("teacher_applications")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", str(fd, "application_id"))
    .eq("status", "pending");
  revalidatePath("/admin/applications");
  revalidatePath("/admin/users");
}

export async function deleteApplication(fd: FormData) {
  await requireRole("super_admin");
  await createAdminClient()
    .from("teacher_applications")
    .delete()
    .eq("id", str(fd, "application_id"))
    .neq("status", "pending");
  revalidatePath("/admin/applications");
}

// ================================================================ Notlar (yalnızca sınıf öğretmeni)

const NOTE_STATUSES = ["positive", "neutral", "concern"];

/** Yazan öğretmen notunu değiştiremez; düzeltme yalnızca sınıf öğretmenindedir (RLS de bunu zorlar). */
export async function updateNote(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("class_teacher");
  const { t } = await getT();
  const text = str(fd, "note_text");
  const status = str(fd, "status");
  if (!text) return { error: t("noteForm.errEmpty") };
  if (text.length > 4000) return { error: t("noteForm.errLong") };
  if (!NOTE_STATUSES.includes(status)) return { error: t("noteForm.errStatus") };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .update({ note_text: text, status })
    .eq("id", str(fd, "note_id"))
    .select("id");
  if (error || !data?.length) return { error: t("noteForm.errSave") };

  // Düzeltilen notun eski çevirileri geçersiz
  await createAdminClient().from("note_translations").delete().eq("note_id", str(fd, "note_id"));
  revalidatePath(`/admin/students/${str(fd, "student_id")}`);
  return { ok: t("common.saved") };
}

/** Linkle katılan öğretmenin cihaz kilidini açar: adı sonra seçen ilk cihaz alır. Yalnızca kendi sınıfındaki öğretmen için. */
export async function resetTeacherLock(fd: FormData) {
  await requireRole("class_teacher");
  const classId = str(fd, "class_id");
  const teacherId = str(fd, "teacher_id");
  // RLS: yalnızca kendi sınıfı görünür; öğretmenin o sınıfa erişimi olmalı
  const { data: access } = await (await createClient())
    .from("teacher_class_access")
    .select("teacher_id")
    .eq("class_id", classId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!access) return;
  await createAdminClient().from("link_claims").delete().eq("teacher_id", teacherId);
  revalidatePath(`/admin/classes/${classId}`);
}
