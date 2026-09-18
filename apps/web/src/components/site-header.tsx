"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { IconCari, IconKeranjang, IconMeja } from "@/components/icons";
import { useCart } from "@/lib/cart";
import { useMeja } from "@/lib/meja";
import { useApi } from "@/lib/use-api";

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/menu", label: "Menu" },
  { href: "/pesanan", label: "Pesanan" },
];

type CafeTable = { id: string; number: string };

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const meja = useMeja();
  const { data: tables } = useApi<CafeTable[]>("/api/tables");
  const [kata, setKata] = useState("");

  const nomorMeja = tables?.find((t) => t.id === meja.nilai)?.number;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent font-display text-lg leading-none font-semibold text-white">
            T
          </span>
          <span className="font-display text-xl font-semibold">Takar</span>
        </Link>

        {/* Pengganti "antar ke alamat": di kafe yang menentukan adalah mejanya. */}
        <label className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface py-1.5 pr-2 pl-2.5 text-sm md:flex">
          <IconMeja className="size-4 text-accent" />
          <span className="sr-only">Nomor meja</span>
          <select
            value={meja.nilai ?? ""}
            onChange={(e) => meja.pilih(e.target.value || null)}
            className="bg-transparent pr-1 outline-none"
          >
            <option value="">Bawa pulang</option>
            {(tables ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                Meja {t.number}
              </option>
            ))}
          </select>
        </label>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(kata.trim() ? `/menu?q=${encodeURIComponent(kata.trim())}` : "/menu");
          }}
          role="search"
          className="relative hidden min-w-0 flex-1 lg:block"
        >
          <IconCari className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={kata}
            onChange={(e) => setKata(e.target.value)}
            type="search"
            placeholder="Cari menu, kategori, atau bahan"
            aria-label="Cari menu"
            className="w-full rounded-xl border border-border bg-surface py-2 pr-3 pl-9 text-sm"
          />
        </form>

        <nav className="ml-auto hidden gap-1 sm:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  active
                    ? "bg-accent-soft font-medium text-accent-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          {nomorMeja && (
            <span className="hidden rounded-lg bg-accent-soft px-2 py-1 text-xs font-medium text-accent-ink sm:inline md:hidden">
              Meja {nomorMeja}
            </span>
          )}

          <Link
            href="/menu"
            aria-label={
              count > 0 ? `Keranjang, ${count} item` : "Keranjang masih kosong"
            }
            className="relative rounded-xl border border-border bg-surface p-2 hover:border-accent"
          >
            <IconKeranjang className="size-5" />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-medium text-white">
                {count}
              </span>
            )}
          </Link>

          <Link
            href="/login"
            className="hidden rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-ink sm:inline-block"
          >
            Staff
          </Link>
        </div>
      </div>
    </header>
  );
}
