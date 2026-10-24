"use client";

import type { ChangeEvent } from "react";

const MAX_SIDE = 1280;

/**
 * Fotoğraf seçici: seçilen görseli göndermeden önce tarayıcıda küçültür (mobil veriyle 8 MB yerine ~200 KB yüklenir).
 * Tarayıcı dosyayı çözemezse (ör. HEIC) özgün dosya olduğu gibi gider; sunucu yine de küçültür.
 */
export function PhotoInput({ className }: { className?: string }) {
  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
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
    } catch {
      // Özgün dosya kalır
    }
  }

  return (
    <input
      type="file"
      name="photo"
      accept="image/*"
      onChange={onChange}
      className={
        className ??
        "block w-full text-sm file:mr-3 file:min-h-10 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-700"
      }
    />
  );
}
