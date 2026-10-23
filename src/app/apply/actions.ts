"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";

export type ApplyState = { error?: string; ok?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (fd: FormData, k: string, max: number) =>
  String(fd.get(k) ?? "").trim().replace(/[ \t]+/g, " ").slice(0, max);

/** Herkese açık başvuru formu: kayıt yalnızca sunucuda (service role) yazılır, yönetici onayı bekler. */
export async function submitApplication(_prev: ApplyState, fd: FormData): Promise<ApplyState> {
  const { t } = await getT();

  // Bal küpü alanı: botlar doldurur, insanlar görmez. Sessizce başarılı gibi davran.
  if (String(fd.get("website") ?? "")) return { ok: true };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  if (!rateLimit(`apply:${ip}`, 5, 60 * 60 * 1000)) return { error: t("common.tooMany") };

  const fullName = clean(fd, "full_name", 120);
  const email = clean(fd, "email", 200).toLowerCase();
  const phone = clean(fd, "phone", 40);
  const school = clean(fd, "school", 160);
  const className = clean(fd, "class_name", 40);
  const city = clean(fd, "city", 80) || null;
  const address = clean(fd, "address", 400);
  const message = clean(fd, "message", 1000) || null;

  if (fullName.length < 3 || !school || !className || !phone || address.length < 5) {
    return { error: t("apply.errRequired") };
  }
  if (!EMAIL_RE.test(email)) return { error: t("account.errEmail") };
  if (phone.replace(/\D/g, "").length < 7) return { error: t("apply.errPhone") };

  const admin = createAdminClient();
  const { data: taken } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (taken) return { error: t("apply.errHasAccount") };

  const { error } = await admin.from("teacher_applications").insert({
    full_name: fullName,
    email,
    phone,
    school,
    class_name: className,
    city,
    address,
    message,
  });
  if (error) return { error: error.code === "23505" ? t("apply.errPending") : t("users.errGeneric") };
  return { ok: true };
}
