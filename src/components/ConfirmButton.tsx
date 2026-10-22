"use client";

import type { ReactNode } from "react";

/** Gönderimden önce onay soran buton (silme gibi geri alınamayan işlemler için). */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
