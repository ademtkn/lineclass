"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { NoteStatus } from "@/lib/types";

export type FormState = { error?: string; ok?: boolean };

const STATUSES: NoteStatus[] = ["positive", "neutral", "concern"];

/** Branş ve isim seçimi (ilk girişte ve profil ekranında). */
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const branch = String(formData.get("branch") ?? "").trim();
  if (!fullName || !branch) return { error: "Ad soyad ve branş seçimi gerekli." };

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
  const studentId = String(formData.get("student_id") ?? "");
  const text = String(formData.get("note_text") ?? "").trim();
  const status = String(formData.get("status") ?? "neutral") as NoteStatus;

  if (!text) return { error: "Not boş olamaz." };
  if (text.length > 4000) return { error: "Not en fazla 4000 karakter olabilir." };
  if (!STATUSES.includes(status)) return { error: "Geçersiz durum." };

  const supabase = await createClient();
  // RLS: öğretmen sadece erişebildiği sınıftaki öğrenciye, kendi adına not ekleyebilir.
  const { error } = await supabase.from("notes").insert({
    student_id: studentId,
    teacher_id: profile.id,
    note_text: text,
    status,
  });
  if (error) return { error: "Not kaydedilemedi: " + error.message };

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true };
}

export async function deleteNote(formData: FormData) {
  await requireRole();
  const noteId = String(formData.get("note_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");

  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", noteId);

  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath(`/admin/students/${studentId}`);
}
