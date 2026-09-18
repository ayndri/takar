"use client";

import { useSyncExternalStore } from "react";

/**
 * Alamat asal halaman (protokol + domain + port).
 *
 * Dipakai untuk menuliskan alamat lengkap ke dalam kode QR meja, supaya stiker
 * yang dicetak dari server mana pun menunjuk ke domain yang sedang dibuka.
 * Nilainya tidak pernah berubah selama halaman hidup, jadi tidak ada yang perlu
 * dilanggan; yang dibutuhkan hanya perbedaan antara render di server dan di
 * browser.
 */

const subscribe = () => () => {};
const getSnapshot = () => window.location.origin;
const getServerSnapshot = () => "";

export function useOrigin() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
