"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { NoteStatus } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

export type FormState = { error?: string; ok?: boolean };

const STATUSES: NoteStatus[] = ["positive", "neutral", "concern"];

/** Branş ve isim seçimi (ilk girişte ve profil ekranında). */
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole();
  const { t } = await getT();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const branch = String(formData.get("branch") ?? "").trim();
  if (!fullName || !branch) return { error: t("profile.errRequired") };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, branch })
    .eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/teacher");
}

export async function addNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole();
  const { t } = await getT();
  const studentId = String(formData.get("student_id") ?? "");
  const text = String(formData.get("note_text") ?? "").trim();
  const status = String(formData.get("status") ?? "neutral") as NoteStatus;

  if (!text) return { error: t("noteForm.errEmpty") };
  if (text.length > 4000) return { error: t("noteForm.errLong") };
  if (!STATUSES.includes(status)) return { error: t("noteForm.errStatus") };

  const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("class_id").eq("id", studentId).maybeSingle();
  if (!student) return { error: t("noteForm.errSave") };

  // Not, öğretmenin o sınıftaki derslerinden birine bağlanır (tek dersi varsa otomatik)
  const { data: mine } = await supabase
    .from("class_subjects")
    .select("id")
    .eq("class_id", student.class_id)
    .eq("teacher_id", profile.id);
  let subjectId = String(formData.get("subject_id") ?? "") || null;
  if (!subjectId && mine?.length === 1) subjectId = mine[0].id;
  if (!subjectId && (mine?.length ?? 0) > 1) return { error: t("noteForm.errSubject") };

  // RLS: öğretmen sadece erişebildiği sınıftaki aktif öğrenciye, kendi adına ve kendi dersiyle not ekleyebilir.
  const { error } = await supabase.from("notes").insert({
    student_id: studentId,
    teacher_id: profile.id,
    note_text: text,
    status,
    subject_id: subjectId,
  });
  if (error) return { error: t("noteForm.errSave") };

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true };
}

/** Not silme: yalnızca sınıf öğretmeni (RLS de aynısını zorlar); yazan öğretmen notu sonradan silemez. */
export async function deleteNote(formData: FormData) {
  await requireRole("class_teacher");
  const noteId = String(formData.get("note_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");

  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", noteId);

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath(`/admin/students/${studentId}`);
}

/** Branş öğretmeni, sınıfta henüz öğretmeni olmayan derslerden kendine seçer (diğerlerini sınıf öğretmeni atar). */
export async function saveSubjects(classId: string, formData: FormData) {
  const profile = await requireRole("branch_teacher", "class_teacher");
  const supabase = await createClient();
  // RLS: sınıfa erişimi yoksa sınıf dönmez
  const { data: cls } = await supabase.from("classes").select("id").eq("id", classId).maybeSingle();
  if (!cls) redirect("/teacher");

  const { data: subjects } = await supabase
    .from("class_subjects")
    .select("id, subject, teacher_id")
    .eq("class_id", classId)
    .order("created_at");
  const all = subjects ?? [];
  const mine = all.filter((x) => x.teacher_id === profile.id);
  const wanted = new Set(formData.getAll("subject_id").map(String));
  const chosen = all.filter((x) => !x.teacher_id && wanted.has(x.id));

  if (!mine.length && !chosen.length && all.length) redirect(`/teacher/classes/${classId}/subjects?err=pick`);

  if (chosen.length) {
    // Yalnızca hâlâ boş olan dersler alınır (aynı anda başkası aldıysa dokunulmaz)
    await createAdminClient()
      .from("class_subjects")
      .update({ teacher_id: profile.id })
      .in("id", chosen.map((x) => x.id))
      .is("teacher_id", null);
    if (!profile.branch) {
      await createAdminClient().from("profiles").update({ branch: chosen[0].subject }).eq("id", profile.id);
    }
  }

  revalidatePath("/teacher", "layout");
  const first = chosen[0] ?? mine[0];
  redirect(`/teacher/classes/${classId}${first ? `?ders=${first.id}` : ""}`);
}
