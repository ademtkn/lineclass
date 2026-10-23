import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Linkle katılan öğretmenin adı, ilk seçildiği cihaza (çerez) kilitlenir:
 *  free   → henüz kimse almamış; ilk seçen alır
 *  mine   → bu cihaz almış
 *  locked → başka cihaz almış; sınıf öğretmeni kilidi sıfırlayana kadar girilemez
 */
export type ClaimStatus = "free" | "mine" | "locked";

const cookieName = (teacherId: string) => `lc_claim_${teacherId}`;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function claimStatuses(teacherIds: string[]): Promise<Map<string, ClaimStatus>> {
  const result = new Map<string, ClaimStatus>();
  if (!teacherIds.length) return result;
  const { data } = await createAdminClient().from("link_claims").select("teacher_id, token_hash").in("teacher_id", teacherIds);
  const stored = new Map((data ?? []).map((r) => [r.teacher_id, r.token_hash]));
  const jar = await cookies();
  for (const id of teacherIds) {
    const h = stored.get(id);
    const token = jar.get(cookieName(id))?.value;
    result.set(id, !h ? "free" : token && hash(token) === h ? "mine" : "locked");
  }
  return result;
}

/** Bu cihaz için adı alır (boşsa). Başarılıysa true; başka cihaz almışsa false. */
export async function claimOrVerify(teacherId: string): Promise<boolean> {
  const status = (await claimStatuses([teacherId])).get(teacherId);
  if (status === "mine") return true;
  if (status === "locked") return false;

  const token = randomBytes(32).toString("base64url");
  const { error } = await createAdminClient()
    .from("link_claims")
    .insert({ teacher_id: teacherId, token_hash: hash(token) });
  if (error) return false; // aynı anda başkası aldı (benzersizlik ihlali)
  (await cookies()).set(cookieName(teacherId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return true;
}
