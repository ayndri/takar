"use client";

import Image from "next/image";
import Link from "next/link";
import { IconApi } from "@/components/icons";
import { Takaran } from "@/components/takaran";
import { useCart } from "@/lib/cart";
import { formatRupiah } from "@/lib/client-api";
import type { PublicMenu } from "@/lib/api";

const AMBANG_MENIPIS = 5;

/**
 * Harga, dengan angka lama dicoret saat sedang promo.
 *
 * Yang dicoret ditaruh sesudah harga baru, bukan sebelum: yang perlu dibaca
 * duluan adalah jumlah yang benar-benar dibayar.
 */
function Harga({ menu }: { menu: PublicMenu }) {
  if (menu.normalPrice === null) {
    return (
      <span className="text-sm font-medium tabular-nums">
        {formatRupiah(menu.price)}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-sm font-semibold text-danger tabular-nums">
        {formatRupiah(menu.price)}
      </span>
      <span className="text-xs text-muted line-through tabular-nums">
        {formatRupiah(menu.normalPrice)}
      </span>
    </span>
  );
}

/**
 * Kartu menu dipakai di beranda dan katalog.
 *
 * Varian `ringkas` hanya memperkecil foto dan menyembunyikan garis takaran,
 * supaya grid pendamping di beranda tidak berebut perhatian dengan kartu
 * unggulan di sebelahnya.
 */
export function MenuCard({
  menu,
  peringkat,
  ringkas = false,
}: {
  menu: PublicMenu;
  peringkat?: string;
  ringkas?: boolean;
}) {
  const cart = useCart();
  const diKeranjang = cart.items.find((i) => i.menuId === menu.id)?.qty ?? 0;
  const habis = !menu.available;
  const menipis = menu.available && menu.remainingPortions <= AMBANG_MENIPIS;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-accent/40">
      <Link
        href={`/menu/${menu.id}`}
        className="block"
        aria-label={`Lihat detail ${menu.name}`}
      >
        <div
          className={`relative overflow-hidden bg-sunk ${
            ringkas ? "aspect-16/10" : "aspect-4/3"
          }`}
        >
          {menu.imageUrl ? (
            <Image
              src={menu.imageUrl}
              alt=""
              fill
              sizes={ringkas ? "(max-width: 640px) 100vw, 220px" : "(max-width: 640px) 100vw, 300px"}
              className={`object-cover transition duration-300 group-hover:scale-105 ${
                habis ? "grayscale" : ""
              }`}
            />
          ) : (
            <div className="grid h-full place-items-center font-display text-3xl text-muted">
              {menu.name.charAt(0)}
            </div>
          )}

          {/* Tanda terlaris menang atas label peringkat: keduanya di sudut yang
              sama, dan "Terlaris" dengan ikon lebih jelas daripada teks saja. */}
          {menu.isBestSeller && !habis ? (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-medium text-white">
              <IconApi className="size-3.5" aria-hidden="true" />
              Terlaris
            </span>
          ) : (
            peringkat &&
            !habis && (
              <span className="absolute top-3 left-3 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white">
                {peringkat}
              </span>
            )
          )}

          {menu.discountPercent !== null && !habis && (
            <span className="absolute bottom-3 left-3 rounded-lg bg-danger px-2 py-1 text-xs font-semibold text-white">
              −{menu.discountPercent}%
            </span>
          )}

          {habis ? (
            <span className="absolute top-3 left-3 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-accent-ink">
              Bahan habis
            </span>
          ) : (
            menipis && (
              <span className="absolute top-3 right-3 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-warning">
                Tinggal {menu.remainingPortions}
              </span>
            )
          )}
        </div>
      </Link>

      <div className={`flex flex-1 flex-col ${ringkas ? "p-3.5" : "p-4"}`}>
        <p className="text-xs text-muted">
          {menu.category}
          {!ringkas && menu.soldThisWeek > 0 && (
            <span> · terjual {menu.soldThisWeek} minggu ini</span>
          )}
        </p>

        <h3
          className={`mt-1 font-display font-semibold ${
            ringkas ? "text-base" : "text-lg"
          }`}
        >
          <Link href={`/menu/${menu.id}`} className="hover:text-accent-ink">
            {menu.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          {ringkas || habis ? (
            <Harga menu={menu} />
          ) : (
            <div>
              <Harga menu={menu} />
              <div className="mt-1.5">
                <Takaran sisa={menu.remainingPortions} />
              </div>
            </div>
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
              <span className="w-5 text-center text-sm font-medium tabular-nums">
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
