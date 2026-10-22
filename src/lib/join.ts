import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** Token'a ait sınıfı RLS'siz okur (linki açan kişi henüz giriş yapmamış olabilir). */
export async function findClassByToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("classes").select("id, name").eq("join_token", token).maybeSingle();
  return data;
}
