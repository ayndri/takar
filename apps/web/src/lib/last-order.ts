"use client";

import { useSyncExternalStore } from "react";

/**
 * Kode pesanan yang pernah dikirim dari perangkat ini.
 *
 * Disimpan supaya pelanggan tidak perlu mencatat kodenya sendiri. Yang
 * terbaru dipakai bar status di beranda; seluruh daftarnya muncul di halaman
 * lacak pesanan, karena kasus yang paling sering terjadi bukan "aku ganti HP"
 * melainkan "aku menutup tabnya".
 *
 * Dibaca lewat useSyncExternalStore dengan alasan yang sama seperti keranjang:
 * localStorage tidak ada saat render di server, jadi hasil render pertama di
 * server dan di browser wajib dibedakan secara eksplisit.
 */

const KEY = "takar.pesanan";

/** Versi sebelumnya cuma menyimpan satu kode. Dipindahkan sekali lalu dibuang. */
const KEY_LAMA = "takar.pesanan-terakhir";

/**
 * Lima sudah lebih dari cukup. Yang dicari orang hampir selalu pesanan hari
 * ini, dan daftar panjang berisi kode acak justru lebih sulit dipindai
 * daripada daftar pendek.
 */
const MAKS = 5;

export type CatatanPesanan = { code: string; at: number };

let snapshot: CatatanPesanan[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function baca(): CatatanPesanan[] {
  try {
    const mentah = localStorage.getItem(KEY);

    if (mentah) {
      const isi: unknown = JSON.parse(mentah);
      if (!Array.isArray(isi)) return [];

      return isi
        .filter(
          (x): x is CatatanPesanan =>
            typeof x === "object" &&
            x !== null &&
            typeof (x as CatatanPesanan).code === "string" &&
            typeof (x as CatatanPesanan).at === "number",
        )
        .slice(0, MAKS);
    }

    // Pindahan dari versi lama. Waktunya tidak diketahui, jadi dianggap
    // barusan — satu-satunya kode yang ada memang yang paling akhir.
    const lama = localStorage.getItem(KEY_LAMA);
    if (lama) {
      const pindah = [{ code: lama, at: Date.now() }];
      localStorage.setItem(KEY, JSON.stringify(pindah));
      localStorage.removeItem(KEY_LAMA);
      return pindah;
    }

    return [];
  } catch {
    return [];
  }
}

function tulis(daftar: CatatanPesanan[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(daftar));
  } catch {
    // Storage diblokir. Daftarnya tetap hidup sampai tab ditutup, dan
    // pelanggan masih punya kodenya di halaman status.
  }

  snapshot = daftar;
  for (const l of listeners) l();
}

export function simpanPesananTerakhir(code: string) {
  const bersih = code.trim().toUpperCase();
  if (!bersih) return;

  const tanpaDuplikat = snapshot.filter((c) => c.code !== bersih);

  tulis([{ code: bersih, at: Date.now() }, ...tanpaDuplikat].slice(0, MAKS));
}

/** Buang satu kode dari daftar. */
export function lupakanPesanan(code: string) {
  tulis(snapshot.filter((c) => c.code !== code));
}

/** Buang yang paling baru — dipakai tombol tutup di bar status beranda. */
export function lupakanPesananTerakhir() {
  tulis(snapshot.slice(1));
}

function subscribe(listener: () => void) {
  if (!loaded) {
    loaded = true;
    snapshot = baca();
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

// Konstanta, bukan array baru tiap panggilan: mengembalikan referensi baru
// membuat React merender tanpa henti.
const KOSONG: CatatanPesanan[] = [];
const getServerSnapshot = (): CatatanPesanan[] => KOSONG;

export function useRiwayatPesanan() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Kode pesanan terakhir dari perangkat ini, atau null. */
export function usePesananTerakhir() {
  return useRiwayatPesanan()[0]?.code ?? null;
}
