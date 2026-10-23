import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NoteWithTeacher } from "@/components/NoteList";
import type { Student } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getStudentWithClass(supabase: Supabase, studentId: string) {
  const { data } = await supabase
    .from("students")
    .select("id, first_name, last_name, class_id, photo_url, short_info, active, class:classes(id, name)")
    .eq("id", studentId)
    .maybeSingle();
  return data as (Student & { active: boolean; class: { id: string; name: string } | null }) | null;
}

/** Bir öğrencinin notları (RLS hangi notların görüneceğine karar verir), en yeni üstte. */
export async function getStudentNotes(supabase: Supabase, studentId: string) {
  const { data } = await supabase
    .from("notes")
    .select("id, student_id, teacher_id, note_text, status, created_at, teacher:profiles(full_name, branch)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as NoteWithTeacher[];
}
