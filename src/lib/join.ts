import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

import { JOIN_CODE_RE } from "@/lib/join-code";

/** Token'a ait sınıfı RLS'siz okur (linki açan kişi henüz giriş yapmamış olabilir). */
export async function findClassByToken(token: string) {
  if (!JOIN_CODE_RE.test(token)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("classes")
    .select("id, name, class_teacher:profiles!classes_class_teacher_id_fkey(full_name)")
    .eq("join_token", token)
    .maybeSingle();
  if (error) console.error("findClassByToken failed", error);
  if (!data) return null;
  const teacher = data.class_teacher as unknown as { full_name: string } | null;
  return { id: data.id, name: data.name, classTeacherName: teacher?.full_name || null };
}
