"use client";

import { useApi } from "./use-api";

/**
 * Pengaturan aplikasi di sisi browser.
 *
 * Dua endpoint, bukan satu: halaman pelanggan cuma boleh tahu aturan yang
 * memang dirasakannya (kafe sedang menerima pesanan atau tidak), sementara
 * dasbor perlu daftar lengkapnya untuk menyaring menu navigasi.
 */

export type SettingGrup = "modul" | "toko" | "reservasi";

export type SettingItem = {
  kunci: string;
  grup: SettingGrup;
  tipe: "boolean" | "angka" | "jam" | "teks";
  label: string;
  keterangan: string;
  /** Yang tersimpan — ini yang muncul di kotak isian. */
  nilai: string;
  /** Yang benar-benar berlaku setelah induknya diperhitungkan. */
  berlaku: string;
  /** Kunci pengaturan induk yang harus menyala supaya baris ini berlaku. */
  butuh: string | null;
  min?: number;
  maks?: number;
  /** Contoh isian, hanya untuk tipe "teks". */
  contoh?: string;
};

export type SettingsResponse = {
  grup: Record<SettingGrup, { judul: string; keterangan: string }>;
  items: SettingItem[];
};

/**
 * Pengaturan untuk halaman pelanggan.
 *
 * `siap` dipisah dari nilainya karena bedanya penting: selama masih memuat,
 * semua flag terbaca mati. Tombol "kirim pesanan" yang berkedip hilang lalu
 * muncul lagi tiap kali halaman dibuka itu bukan yang diinginkan, jadi yang
 * memakai hook ini menunggu `siap` dulu sebelum menyembunyikan apa pun.
 */
export function usePengaturanPublik() {
  const { data, isLoading } = useApi<Record<string, string>>(
    "/api/settings/public",
    { revalidateOnFocus: true },
  );

  return {
    siap: !isLoading && data !== undefined,
    nyala: (kunci: string) => data?.[kunci] === "true",
    angka: (kunci: string, bawaan: number) => {
      const n = Number(data?.[kunci]);
      return Number.isFinite(n) ? n : bawaan;
    },
    teks: (kunci: string, bawaan: string) => data?.[kunci] ?? bawaan,
  };
}

/** Pengaturan lengkap untuk dasbor. Perlu login. */
export function usePengaturan() {
  const { data, error, isLoading, mutate } =
    useApi<SettingsResponse>("/api/settings");

  const nilai = new Map((data?.items ?? []).map((i) => [i.kunci, i.berlaku]));

  return {
    data,
    error,
    isLoading,
    mutate,
    nyala: (kunci: string) => nilai.get(kunci) === "true",
  };
}
