"use client";

import { useEffect, useRef } from "react";

/**
 * Jendela detail.
 *
 * Bisa ditutup dengan Escape, dengan tombol tutup, atau dengan mengklik di
 * luar kotaknya. Fokus dipindahkan ke dalam saat dibuka dan dikembalikan ke
 * tombol pemicunya saat ditutup, supaya yang memakai papan ketik tidak
 * kehilangan posisi.
 */
export function Modal({
  judul,
  deskripsi,
  lebar = "md",
  onClose,
  children,
}: {
  judul: string;
  deskripsi?: string;
  lebar?: "md" | "lg";
  onClose: () => void;
  children: React.ReactNode;
}) {
  const kotak = useRef<HTMLDivElement>(null);
  const pemicu = useRef<Element | null>(null);

  useEffect(() => {
    pemicu.current = document.activeElement;
    kotak.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    const sebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = sebelumnya;
      (pemicu.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={kotak}
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        tabIndex={-1}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface sm:rounded-2xl ${
          lebar === "lg" ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4">
          <div>
            <h2 className="font-semibold">{judul}</h2>
            {deskripsi && (
              <p className="mt-0.5 text-sm text-muted">{deskripsi}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:text-ink"
          >
            Tutup
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
