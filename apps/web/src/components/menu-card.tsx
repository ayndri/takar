"use client";

import Image from "next/image";
import Link from "next/link";
import { Takaran } from "@/components/takaran";
import { useCart } from "@/lib/cart";
import { formatRupiah } from "@/lib/client-api";
import type { PublicMenu } from "@/lib/api";

const AMBANG_MENIPIS = 5;

/**
 * Kartu dipakai di beranda dan di katalog. Ukurannya sama di kedua tempat,
 * yang berbeda hanya jumlah kolomnya, supaya pelanggan mengenali bentuk yang
 * sama saat berpindah halaman.
 */
export function MenuCard({ menu }: { menu: PublicMenu }) {
  const cart = useCart();
  const diKeranjang = cart.items.find((i) => i.menuId === menu.id)?.qty ?? 0;
  const habis = !menu.available;
  const menipis = menu.available && menu.remainingPortions <= AMBANG_MENIPIS;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-surface">
      <Link
        href={`/menu/${menu.id}`}
        className="block"
        aria-label={`Lihat detail ${menu.name}`}
      >
        <div className="relative aspect-4/3 overflow-hidden bg-sunk">
          {menu.imageUrl ? (
            <Image
              src={menu.imageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 320px"
              className={`object-cover transition duration-300 group-hover:scale-105 ${
                habis ? "grayscale" : ""
              }`}
            />
          ) : (
            <div className="grid h-full place-items-center font-display text-3xl text-muted">
              {menu.name.charAt(0)}
            </div>
          )}

          {habis && (
            <span className="absolute top-3 left-3 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-accent-ink">
              Bahan habis
            </span>
          )}

          {menipis && (
            <span className="absolute top-3 left-3 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-warning">
              Tinggal {menu.remainingPortions} porsi
            </span>
          )}
        </div>
      </Link>

      <div className="p-4">
        <p className="text-xs tracking-wide text-muted">{menu.category}</p>

        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">
            <Link href={`/menu/${menu.id}`} className="hover:text-accent-ink">
              {menu.name}
            </Link>
          </h3>
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {formatRupiah(menu.price)}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {habis ? (
            <span className="text-xs text-muted">Menunggu bahan masuk</span>
          ) : (
            <Takaran sisa={menu.remainingPortions} />
          )}

          {habis ? (
            /* Status, bukan kontrol: tidak ada yang bisa dilakukan di sini,
               jadi jangan tampilkan sesuatu yang berbentuk tombol. */
            <span className="rounded-xl bg-sunk px-3 py-1.5 text-sm text-muted">
              Habis
            </span>
          ) : diKeranjang > 0 ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => cart.setQty(menu.id, diKeranjang - 1)}
                aria-label={`Kurangi ${menu.name}`}
                className="size-8 rounded-lg border border-border text-lg leading-none hover:bg-sunk"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium tabular-nums">
                {diKeranjang}
              </span>
              <button
                type="button"
                onClick={() => cart.setQty(menu.id, diKeranjang + 1)}
                disabled={diKeranjang >= menu.remainingPortions}
                aria-label={`Tambah ${menu.name}`}
                className="size-8 rounded-lg border border-border text-lg leading-none hover:bg-sunk disabled:opacity-40"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                cart.add({
                  menuId: menu.id,
                  name: menu.name,
                  price: menu.price,
                })
              }
              className="rounded-xl bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-ink"
            >
              Tambah
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
