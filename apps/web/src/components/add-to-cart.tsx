"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";

export function AddToCart({
  menuId,
  name,
  price,
  maksimal,
}: {
  menuId: string;
  name: string;
  price: string;
  maksimal: number;
}) {
  const cart = useCart();
  const [jumlah, setJumlah] = useState(1);
  const diKeranjang = cart.items.find((i) => i.menuId === menuId)?.qty ?? 0;

  // Sisa porsi dihitung dari stok, jadi batasnya ikut berkurang untuk yang
  // sudah masuk keranjang.
  const sisa = Math.max(0, maksimal - diKeranjang);

  if (sisa === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
        {diKeranjang > 0
          ? `Semua sisa porsi (${diKeranjang}) sudah ada di keranjang kamu.`
          : "Bahannya sedang habis."}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setJumlah((n) => Math.max(1, n - 1))}
          disabled={jumlah <= 1}
          aria-label="Kurangi jumlah"
          className="size-9 rounded-lg text-lg leading-none hover:bg-sunk disabled:opacity-40"
        >
          −
        </button>
        <span className="w-8 text-center font-medium tabular-nums">
          {jumlah}
        </span>
        <button
          type="button"
          onClick={() => setJumlah((n) => Math.min(sisa, n + 1))}
          disabled={jumlah >= sisa}
          aria-label="Tambah jumlah"
          className="size-9 rounded-lg text-lg leading-none hover:bg-sunk disabled:opacity-40"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          cart.add({ menuId, name, price }, jumlah);
          setJumlah(1);
        }}
        className="rounded-xl bg-accent px-6 py-3 font-medium text-white hover:bg-accent-ink"
      >
        Masukkan keranjang
      </button>

      {diKeranjang > 0 && (
        <span className="text-sm text-muted">
          {diKeranjang} sudah di keranjang
        </span>
      )}
    </div>
  );
}
