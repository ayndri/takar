"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "takar.meja";

/**
 * Nomor meja yang dipilih pelanggan.
 *
 * Disimpan sekali di header, lalu dipakai ulang saat mengirim pesanan, supaya
 * orang tidak perlu memilih mejanya lagi di langkah terakhir. Nanti kalau QR
 * per meja dipakai, nilainya diisi dari token di URL.
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

function tulis(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // Pilihan meja tetap berlaku sampai tab ditutup.
  }
  snapshot = id;
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

export function useMeja() {
  const nilai = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pilih = useCallback((id: string | null) => tulis(id), []);
  return { nilai, pilih };
}
