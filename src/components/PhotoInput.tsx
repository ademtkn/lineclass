"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useI18n } from "@/lib/i18n/client";

const MAX_SIDE = 1280;

/**
 * Fotoğraf seçici: "Kamera" ile çek, "Galeri" ile telefondan seç. Seçilen görseli göndermeden önce
 * tarayıcıda küçültür (mobil veriyle 8 MB yerine ~200 KB yüklenir).
 * Tarayıcı dosyayı çözemezse (ör. HEIC) özgün dosya olduğu gibi gider; sunucu yine de küçültür.
 */
export function PhotoInput({ className }: { className?: string }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  function pick(camera: boolean) {
    const input = inputRef.current;
    if (!input) return;
    // capture varsa Android doğrudan kamerayı açar, yoksa galeri seçicisini.
    if (camera) input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.click();
  }

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    setFileName(file?.name ?? "");
    if (!file || file.type === "image/gif") return;
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      if (!blob || blob.size >= file.size) return;
      const small = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
      setFileName(small.name);
    } catch {
      // Özgün dosya kalır
    }
  }

  const btn =
    "min-h-10 rounded-xl bg-brand-50 px-4 text-sm font-semibold text-brand-700 active:opacity-70";
  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      <input ref={inputRef} type="file" name="photo" accept="image/*" onChange={onChange} className="hidden" />
      <button type="button" onClick={() => pick(true)} className={btn}>
        {t("photo.camera")}
      </button>
      <button type="button" onClick={() => pick(false)} className={btn}>
        {t("photo.gallery")}
      </button>
      <span className="min-w-0 truncate text-sm text-slate-500">{fileName || t("photo.none")}</span>
    </div>
  );
}
