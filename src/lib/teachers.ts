import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Bu sınıf öğretmeninin "kendi" saydığı öğretmenler: erişimlerinin tamamı onun sınıflarında olanlar.
 * Başka bir sınıf öğretmeninin sınıfına da giren öğretmenin hesabı değiştirilemez/silinemez
 * (yalnızca kendi sınıfından kaldırılabilir).
 */
export async function ownedTeacherIds(classTeacherId: string, teacherIds: string[]) {
  if (!teacherIds.length) return new Set<string>();
  const admin = createAdminClient();
  const { data: access } = await admin
    .from("teacher_class_access")
    .select("teacher_id, class:classes(class_teacher_id)")
    .in("teacher_id", teacherIds);

  const owned = new Set(teacherIds);
  for (const row of access ?? []) {
    const cls = row.class as unknown as { class_teacher_id: string | null } | null;
    if (cls?.class_teacher_id !== classTeacherId) owned.delete(row.teacher_id);
  }
  return owned;
}
