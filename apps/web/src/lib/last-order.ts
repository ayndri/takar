"use client";

import { useSyncExternalStore } from "react";

const KEY = "takar.pesanan-terakhir";

/**
 * Kode pesanan terakhir yang dikirim dari perangkat ini.
 *
 * Dipakai untuk menampilkan bar status di beranda, supaya pelanggan tidak perlu
 * menyimpan kodenya sendiri. Sama seperti keranjang, ini dibaca lewat
 * useSyncExternalStore karena localStorage tidak ada saat render di server.
 */

let snapshot: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function baca(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function simpanPesananTerakhir(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // Tidak apa-apa: pelanggan masih punya kodenya di halaman status.
  }
  snapshot = code;
  for (const l of listeners) l();
}

export function lupakanPesananTerakhir() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // sama seperti di atas
  }
  snapshot = null;
  for (const l of listeners) l();
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
const getServerSnapshot = (): string | null => null;

export function usePesananTerakhir() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
