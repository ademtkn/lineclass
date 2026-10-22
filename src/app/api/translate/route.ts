import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { translateText } from "@/lib/translate";
import { LANGS, type Lang } from "@/lib/types";

/**
 * POST /api/translate  { noteId, lang }
 * Not RLS ile okunur (yetkisi olmayan kullanıcı notu göremez → 404).
 * Sonuç note_translations tablosunda önbelleğe alınır.
 */
export async function POST(request: Request) {
  const { t } = await getT();
  const body = await request.json().catch(() => null);
  const noteId = typeof body?.noteId === "string" ? body.noteId : null;
  const lang = body?.lang as Lang;
  if (!noteId || !LANGS.some((l) => l.code === lang)) {
    return NextResponse.json({ error: t("api.badRequest") }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("api.auth") }, { status: 401 });
  // Maliyet koruması: kullanıcı başına dakikada 20 çeviri
  if (!rateLimit(`translate:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: t("api.rateLimit") }, { status: 429 });
  }

  const { data: cached } = await supabase
    .from("note_translations")
    .select("text")
    .eq("note_id", noteId)
    .eq("lang", lang)
    .maybeSingle();
  if (cached) return NextResponse.json({ text: cached.text, cached: true });

  const { data: note } = await supabase.from("notes").select("note_text").eq("id", noteId).maybeSingle();
  if (!note) return NextResponse.json({ error: t("api.notFound") }, { status: 404 });

  try {
    const { text, provider } = await translateText(note.note_text, lang);
    // Demo çevirileri önbelleğe yazma; gerçek anahtar eklenince yeniden çevrilsin.
    if (provider !== "mock") {
      // Not yukarıda RLS ile okunabildiği için yetki doğrulandı; önbelleğe sunucu yazar
      await createAdminClient().from("note_translations").insert({ note_id: noteId, lang, text });
    }
    return NextResponse.json({ text, cached: false });
  } catch (e) {
    console.error("translate failed", e);
    return NextResponse.json({ error: t("api.unavailable") }, { status: 502 });
  }
}
