import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { translateText } from "@/lib/translate";
import { LANGS, type Lang } from "@/lib/types";

/**
 * POST /api/translate  { noteId, lang }
 * Not RLS ile okunur (yetkisi olmayan kullanıcı notu göremez → 404).
 * Sonuç note_translations tablosunda önbelleğe alınır.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const noteId = typeof body?.noteId === "string" ? body.noteId : null;
  const lang = body?.lang as Lang;
  if (!noteId || !LANGS.some((l) => l.code === lang)) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

  const { data: cached } = await supabase
    .from("note_translations")
    .select("text")
    .eq("note_id", noteId)
    .eq("lang", lang)
    .maybeSingle();
  if (cached) return NextResponse.json({ text: cached.text, cached: true });

  const { data: note } = await supabase.from("notes").select("note_text").eq("id", noteId).maybeSingle();
  if (!note) return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });

  try {
    const { text, provider } = await translateText(note.note_text, lang);
    // Demo çevirileri önbelleğe yazma; gerçek anahtar eklenince yeniden çevrilsin.
    if (provider !== "mock") {
      await supabase.from("note_translations").insert({ note_id: noteId, lang, text });
    }
    return NextResponse.json({ text, cached: false });
  } catch (e) {
    console.error("translate failed", e);
    return NextResponse.json({ error: "Çeviri servisine ulaşılamadı" }, { status: 502 });
  }
}
