"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatRupiah } from "@/lib/client-api";
import type { PublicMenu } from "@/lib/api";

/**
 * Kartu kecil yang mengambang di atas foto hero.
 *
 * Isinya menu yang paling laku minggu ini, jadi bagian paling menonjol di
 * halaman sekaligus menunjukkan barang yang benar-benar dijual, bukan hiasan.
 */
export function HeroKartu({ menu }: { menu: PublicMenu }) {
  const cart = useCart();
  const diKeranjang = cart.items.find((i) => i.menuId === menu.id)?.qty ?? 0;
  const bisa = menu.remainingPortions - diKeranjang > 0;

  return (
    <div className="w-[248px] rounded-2xl border border-border bg-surface p-3 shadow-lg shadow-ink/10">
      <div className="flex gap-3">
        <Link
          href={`/menu/${menu.id}`}
          className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-sunk"
        >
          {menu.imageUrl && (
            <Image
              src={menu.imageUrl}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          )}
        </Link>

        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-accent-ink uppercase">
            Paling laku
          </p>
          <Link
            href={`/menu/${menu.id}`}
            className="block truncate font-display text-base font-semibold hover:text-accent-ink"
          >
            {menu.name}
          </Link>
          <p className="text-sm font-medium tabular-nums">
            {formatRupiah(menu.price)}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={!bisa}
        onClick={() =>
          cart.add({ menuId: menu.id, name: menu.name, price: menu.price })
        }
        className="mt-3 w-full rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-ink disabled:opacity-50"
      >
        {!bisa
          ? "Sedang habis"
          : diKeranjang > 0
            ? `Tambah lagi (${diKeranjang} di keranjang)`
            : "Tambah ke keranjang"}
      </button>
    </div>
  );
}
