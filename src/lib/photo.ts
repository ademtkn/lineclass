import "server-only";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";

const BUCKET = "student-photos";
/** Yüklenen özgün dosya sınırı; kaydedilen dosya aşağıda küçültülür. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Öğrenci kartlarında en fazla ~112px gösterilir; 480px retina için de yeterli. */
const MAX_SIDE = 480;

/** Fotoğrafı döndürmesini düzeltip küçültür ve WebP'ye çevirir (tipik sonuç 20–50 KB). */
export async function shrinkPhoto(file: File): Promise<Buffer> {
  return sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 80_000_000 })
    .rotate() // EXIF yönüne göre düzelt (telefon fotoğrafları)
    .resize(MAX_SIDE, MAX_SIDE, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toBuffer();
}

/** Genel URL'den bucket içindeki dosya yolunu çıkarır. */
function pathFromUrl(url: string) {
  const i = url.indexOf(`/${BUCKET}/`);
  return i < 0 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2).split("?")[0]);
}

/** Sunucudaki fotoğraf dosyalarını siler (yetki kontrolü çağıranda yapılmış olmalı). */
export async function removePhotos(urls: (string | null | undefined)[]) {
  const paths = urls.flatMap((u) => (u ? [pathFromUrl(u)] : [])).filter((p): p is string => !!p);
  if (!paths.length) return;
  const { error } = await createAdminClient().storage.from(BUCKET).remove(paths);
  if (error) console.error("removePhotos failed", error);
}
