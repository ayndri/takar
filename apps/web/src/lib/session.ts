"use client";

import { useSyncExternalStore } from "react";
import { getSessionUser, getToken, type SessionUser } from "./client-api";

/**
 * Sesi dibaca lewat useSyncExternalStore dengan alasan yang sama seperti
 * keranjang: localStorage tidak ada saat render di server, jadi hasil render
 * pertama di server dan di browser wajib dibedakan secara eksplisit.
 */

export type Session = { token: string; user: SessionUser | null } | null;

/**
 * Tiga keadaan, bukan dua.
 *
 * `undefined` berarti belum diketahui, `null` berarti memang tidak login.
 * Membedakan keduanya itu perlu: saat React menghidrasi halaman, ia WAJIB
 * memakai nilai dari server supaya cocok dengan HTML-nya, dan di server
 * localStorage tidak ada. Kalau "belum diketahui" dan "tidak login" sama-sama
 * null, halaman dasbor melempar orang ke login pada render pertama walau
 * tokennya ada. Gejalanya: menyegarkan halaman dasbor selalu keluar sendiri.
 */
export type SesiTerbaca = Session | undefined;

let snapshot: Session = null;
let loaded = false;
const listeners = new Set<() => void>();

function baca(): Session {
  const token = getToken();
  return token ? { token, user: getSessionUser() } : null;
}

function segarkan() {
  const next = baca();

  // Bandingkan isinya, bukan referensinya — kalau tidak, tiap panggilan
  // menghasilkan objek baru dan React merender tanpa henti.
  const sama =
    next?.token === snapshot?.token && next?.user?.id === snapshot?.user?.id;

  if (!sama) {
    snapshot = next;
    for (const l of listeners) l();
  }
}

/** Dipanggil setelah login atau logout supaya komponen ikut berubah. */
export function notifySessionChanged() {
  segarkan();
}

function subscribe(listener: () => void) {
  if (!loaded) {
    loaded = true;
    snapshot = baca();
  }

  listeners.add(listener);

  const onStorage = () => segarkan();
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
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
const getSnapshot = (): Session => {
  if (!loaded) {
    loaded = true;
    snapshot = baca();
  }

  return snapshot;
};
/**
 * Di server localStorage tidak ada, jadi jawabannya bukan "tidak login"
 * melainkan "belum bisa tahu". Nilai ini juga yang dipakai React saat
 * menghidrasi, dan itulah inti perbaikannya.
 */
const getServerSnapshot = (): SesiTerbaca => undefined;

export function useSession(): SesiTerbaca {
  return useSyncExternalStore<SesiTerbaca>(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
}
