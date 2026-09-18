"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";
import type { PublicMenu } from "@/lib/api";

/**
 * Pemilih jumlah pada kartu unggulan di beranda.
 *
 * Dipisah dari kartu biasa karena di sini pelanggan sering memesan lebih dari
 * satu sekaligus, jadi menambah satu per satu terasa lambat.
 */
export function PilihanUtama({ menu }: { menu: PublicMenu }) {
  const cart = useCart();
  const [jumlah, setJumlah] = useState(1);
  const diKeranjang = cart.items.find((i) => i.menuId === menu.id)?.qty ?? 0;
  const sisa = Math.max(0, menu.remainingPortions - diKeranjang);

  if (sisa === 0) {
    return (
      <span className="rounded-xl bg-sunk px-4 py-2.5 text-sm text-muted">
        {diKeranjang > 0 ? "Semua sisa sudah diambil" : "Habis"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-border p-1">
        <button
          type="button"
          onClick={() => setJumlah((n) => Math.max(1, n - 1))}
          disabled={jumlah <= 1}
          aria-label="Kurangi jumlah"
          className="size-8 rounded-lg text-lg leading-none hover:bg-sunk disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-medium tabular-nums">
          {jumlah}
        </span>
        <button
          type="button"
          onClick={() => setJumlah((n) => Math.min(sisa, n + 1))}
          disabled={jumlah >= sisa}
          aria-label="Tambah jumlah"
          className="size-8 rounded-lg text-lg leading-none hover:bg-sunk disabled:opacity-40"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          cart.add(
            { menuId: menu.id, name: menu.name, price: menu.price },
            jumlah,
          );
          setJumlah(1);
        }}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink"
      >
        Tambah
      </button>
    </div>
  );
}
