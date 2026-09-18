"use client";

import { useCallback, useSyncExternalStore } from "react";

export type CartItem = {
  menuId: string;
  name: string;
  price: string;
  qty: number;
  /** Permintaan khusus untuk menu ini saja, misalnya "es sedikit". */
  note?: string;
};

const STORAGE_KEY = "takar.cart";

/**
 * Keranjang disimpan di localStorage supaya tidak hilang saat pelanggan
 * menutup tab atau HP-nya terkunci di tengah memilih menu.
 *
 * Dibuat sebagai store di luar React lalu dibaca lewat useSyncExternalStore,
 * bukan useState + useEffect: localStorage tidak ada saat render di server,
 * dan pola ini yang membuat React menangani perbedaan itu dengan benar.
 */

let items: CartItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

// Snapshot harus berupa objek yang sama selama isinya tidak berubah,
// kalau tidak React akan menganggapnya selalu baru dan merender terus.
let snapshot: CartItem[] = items;
const EMPTY: CartItem[] = [];

function baca(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    // Mode penyamaran atau storage diblokir — keranjang tetap jalan di memori.
    return [];
  }
}

function simpan(next: CartItem[]) {
  items = next;
  snapshot = next;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Gagal menyimpan tidak boleh merusak halaman.
  }

  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  if (!loaded) {
    loaded = true;
    items = baca();
    snapshot = items;
  }

  listeners.add(listener);

  // Keranjang ikut sinkron kalau pelanggan membuka dua tab.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    items = baca();
    snapshot = items;
    for (const l of listeners) l();
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => EMPTY;

export function useCart() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    const found = items.find((i) => i.menuId === item.menuId);
    simpan(
      found
        ? items.map((i) =>
            i.menuId === item.menuId ? { ...i, qty: i.qty + qty } : i,
          )
        : [...items, { ...item, qty }],
    );
  }, []);

  const setQty = useCallback((menuId: string, qty: number) => {
    simpan(
      qty <= 0
        ? items.filter((i) => i.menuId !== menuId)
        : items.map((i) => (i.menuId === menuId ? { ...i, qty } : i)),
    );
  }, []);

  const setNote = useCallback((menuId: string, note: string) => {
    simpan(
      items.map((i) =>
        i.menuId === menuId ? { ...i, note: note.trim() ? note : undefined } : i,
      ),
    );
  }, []);

  const clear = useCallback(() => simpan([]), []);

  const total = current.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);
  const count = current.reduce((sum, i) => sum + i.qty, 0);

  return { items: current, add, setQty, setNote, clear, total, count };
}
