"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "takar.meja";

/**
 * Token QR yang dipindai terakhir.
 *
 * Disimpan terpisah dari id mejanya, dan itu perlu: id meja terbuka lewat
 * `/api/tables` sehingga siapa pun bisa mengetahuinya, sedangkan tokennya
 * tidak bisa ditebak. Jadi token inilah satu-satunya bukti bahwa perangkat
 * ini benar-benar pernah berada di meja tersebut — dipakai halaman lacak
 * untuk menampilkan pesanan meja ini tanpa memindai ulang.
 */
const KEY_TOKEN = "takar.meja-token";

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

/**
 * Nilainya diisi di sini, bukan hanya di subscribe().
 *
 * React memanggil getSnapshot() lebih dulu, baru subscribe(). Kalau isinya
 * baru dibaca saat subscribe, render pertama di browser selalu melihat nilai
 * kosong, dan efek apa pun yang bergantung padanya ikut berjalan dengan
 * nilai itu. Di halaman dasbor akibatnya nyata: menyegarkan halaman
 * melemparkan orang ke halaman login padahal tokennya masih ada.
 */
const getSnapshot = (): string | null => {
  if (!loaded) {
    loaded = true;
    snapshot = baca();
  }

  return snapshot;
};
const getServerSnapshot = (): string | null => null;

export function useMeja() {
  const nilai = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pilih = useCallback((id: string | null) => tulis(id), []);
  return { nilai, pilih };
}

function bacaToken(): string | null {
  try {
    return localStorage.getItem(KEY_TOKEN);
  } catch {
    return null;
  }
}

let tokenSnapshot: string | null = null;
let tokenLoaded = false;
const tokenListeners = new Set<() => void>();

export function simpanTokenMeja(token: string) {
  try {
    localStorage.setItem(KEY_TOKEN, token);
  } catch {
    // Storage diblokir — halaman lacak cuma kehilangan satu kemudahan.
  }
  tokenSnapshot = token;
  for (const l of tokenListeners) l();
}

function subscribeToken(listener: () => void) {
  if (!tokenLoaded) {
    tokenLoaded = true;
    tokenSnapshot = bacaToken();
  }

  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

const getTokenSnapshot = (): string | null => {
  if (!tokenLoaded) {
    tokenLoaded = true;
    tokenSnapshot = bacaToken();
  }

  return tokenSnapshot;
};
const getTokenServerSnapshot = (): string | null => null;

/** Token QR meja yang terakhir dipindai dari perangkat ini. */
export function useTokenMeja() {
  return useSyncExternalStore(
    subscribeToken,
    getTokenSnapshot,
    getTokenServerSnapshot,
  );
}
