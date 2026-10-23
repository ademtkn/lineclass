import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { JOIN_CODE_RE } from "@/lib/join-code";

const PUBLIC_PATHS = ["/login", "/apply"];

/** Oturum çerezini yeniler; giriş yapmamış kullanıcıyı /login'e yollar. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() token'ı Supabase'e doğrulatır ve gerekirse yeniler.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Supabase'e geçici olarak ulaşılamıyorsa (zayıf Wi-Fi, sunucu yükü) kullanıcıyı çıkış yapmış sayma;
  // sayfa kendi hata ekranında "tekrar dene" gösterir.
  if (!user && isAuthRetryableFetchError(error)) return response;

  const path = request.nextUrl.pathname;
  // Kök adresteki sınıf davet linkleri (örn. /5a-k7m2qxp) girişsiz açılır
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p)) || JOIN_CODE_RE.test(path.slice(1));

  if (!user && !isPublic && !path.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
