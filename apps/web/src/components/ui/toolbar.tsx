"use client";

import { IconCari } from "@/components/icons";

/** Kolom pencarian di atas tabel, seragam di semua halaman dasbor. */
export function SearchBox({
  nilai,
  onChange,
  placeholder,
}: {
  nilai: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <IconCari className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={nilai}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm"
      />
    </div>
  );
}

/**
 * Navigasi halaman untuk tabel dasbor.
 *
 * Tombol saja, tanpa deretan nomor: di dasbor orang menelusuri berurutan,
 * dan barisnya tidak sebanyak katalog pelanggan.
 */
export function TablePager({
  halaman,
  halamanTotal,
  awal,
  akhir,
  total,
  satuan,
  onGanti,
}: {
  halaman: number;
  halamanTotal: number;
  awal: number;
  akhir: number;
  total: number;
  satuan: string;
  onGanti: (halaman: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {total === 0
          ? `Tidak ada ${satuan} yang cocok`
          : `Menampilkan ${awal}–${akhir} dari ${total} ${satuan}`}
      </p>

      {halamanTotal > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onGanti(halaman - 1)}
            disabled={halaman <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <span className="text-sm text-muted tabular-nums">
            {halaman} / {halamanTotal}
          </span>
          <button
            type="button"
            onClick={() => onGanti(halaman + 1)}
            disabled={halaman >= halamanTotal}
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}

/** Judul halaman dasbor beserta keterangannya. */
export function PageHead({
  judul,
  deskripsi,
  aksi,
}: {
  judul: string;
  deskripsi: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{judul}</h1>
        <p className="mt-1 text-sm text-muted">{deskripsi}</p>
      </div>
      {aksi}
    </div>
  );
}
