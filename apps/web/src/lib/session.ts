"use client";

import { useSyncExternalStore } from "react";
import { getSessionUser, getToken, type SessionUser } from "./client-api";

/**
 * Sesi dibaca lewat useSyncExternalStore dengan alasan yang sama seperti
 * keranjang: localStorage tidak ada saat render di server, jadi hasil render
 * pertama di server dan di browser wajib dibedakan secara eksplisit.
 */

export type Session = { token: string; user: SessionUser | null } | null;

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

const getSnapshot = () => snapshot;
const getServerSnapshot = (): Session => null;

export function useSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
