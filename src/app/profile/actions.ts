"use server";

import { revalidatePath } from "next/cache";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type AccountState = { error?: string; ok?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Mevcut şifreyi, kullanıcının oturumuna dokunmayan ayrı bir istemciyle doğrular. */
async function passwordMatches(email: string, password: string) {
  const probe = createJsClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return false;
  // Doğrulama için açılan oturumu hemen kapat (yalnızca bu oturum)
  await probe.auth.signOut({ scope: "local" });
  return true;
}

/**
 * Sınıf öğretmeni ve yöneticinin profil ayarları: ad, branş, e-posta, şifre.
 * E-posta veya şifre değişikliği mevcut şifreyi ister.
 */
export async function updateAccount(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const me = await requireRole("class_teacher", "super_admin");
  const { t } = await getT();
  const fullName = str(fd, "full_name");
  const branch = str(fd, "branch") || null;
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const password2 = str(fd, "password2");
  const current = str(fd, "current_password");

  if (!fullName || !email) return { error: t("users.errRequired") };
  if (!EMAIL_RE.test(email)) return { error: t("account.errEmail") };
  if (password && password.length < 8) return { error: t("users.errPassword") };
  if (password !== password2) return { error: t("account.errMismatch") };

  const emailChanged = email !== me.email.toLowerCase();
  const admin = createAdminClient();

  if (emailChanged || password) {
    if (!rateLimit(`account:${me.id}`, 5, 10 * 60_000)) return { error: t("common.tooMany") };
    if (!current || !(await passwordMatches(me.email, current))) return { error: t("account.errCurrent") };

    if (emailChanged) {
      // Onay e-postası beklemeden, sunucu tarafında değiştir
      const { error } = await admin.auth.admin.updateUserById(me.id, { email, email_confirm: true });
      if (error) return { error: error.code === "email_exists" ? t("users.errEmailTaken") : t("users.errGeneric") };
    }
    if (password) {
      // Kullanıcının kendi oturumuyla: admin API tüm oturumları kapatırdı, bu yol mevcut oturumu korur
      const supabase = await createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error && error.code !== "same_password") return { error: t("users.errGeneric") };
    }
  }

  const { error } = await admin.from("profiles").update({ full_name: fullName, branch, email }).eq("id", me.id);
  if (error) return { error: t("users.errGeneric") };

  revalidatePath("/", "layout");
  return { ok: t("account.saved") };
}
