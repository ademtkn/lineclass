import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

/** Giriş yapmış kullanıcının profili (istek başına bir kez sorgulanır). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, branch")
    .eq("id", user.id)
    .single();
  return data;
});

/** Profil yoksa /login'e, rol uymuyorsa ana sayfaya yönlendirir. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (roles.length && !roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

export function homeFor(role: Role) {
  return role === "branch_teacher" ? "/teacher" : "/admin";
}
