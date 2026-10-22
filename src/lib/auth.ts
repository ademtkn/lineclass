import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

/** Giriş yapmış kullanıcının profili (istek başına bir kez sorgulanır). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  // Bağlantı hatası "oturum yok" demek değildir: çıkışa yönlendirmek yerine hata ekranı göster
  if (isAuthRetryableFetchError(error)) throw new Error("AUTH_UNAVAILABLE");
  if (!user) return null;

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, branch")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error("PROFILE_UNAVAILABLE");
  // E-posta sütunu API'ye kapalı (bkz. 0005); kendi e-postası oturumdan gelir
  return data ? { ...data, email: user.email ?? "" } : null;
});

/** Profil yoksa /login'e, rol uymuyorsa ana sayfaya yönlendirir. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (roles.length && !roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

export function homeFor(role: Role) {
  return role === "branch_teacher" ? "/teacher" : role === "super_admin" ? "/admin/users" : "/admin";
}
