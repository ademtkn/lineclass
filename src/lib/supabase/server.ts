import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";

/** Kullanıcının oturumuyla çalışan istemci — RLS kurallarına tabidir. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component içinden çağrıldıysa yazılamaz; oturum yenilemeyi proxy yapar.
          }
        },
      },
    },
  );
}

/**
 * Service-role istemci — RLS'yi atlar. Sadece sunucuda, yetki kontrolünden SONRA kullanın
 * (ör. super admin'in yeni kullanıcı oluşturması).
 */
export function createAdminClient() {
  return createJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
