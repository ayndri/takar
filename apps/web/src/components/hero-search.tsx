"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconCari, IconMeja } from "@/components/icons";
import { useMeja } from "@/lib/meja";
import { useApi } from "@/lib/use-api";

type CafeTable = { id: string; number: string };

/**
 * Satu baris berisi pemilih meja dan kolom pencarian, digabung dalam satu kotak.
 *
 * Mejanya disimpan sekali di sini lalu dipakai lagi saat mengirim pesanan,
 * jadi pelanggan tidak ditanya dua kali.
 */
export function HeroSearch() {
  const router = useRouter();
  const meja = useMeja();
  const { data: tables } = useApi<CafeTable[]>("/api/tables");
  const [kata, setKata] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(
          kata.trim() ? `/menu?q=${encodeURIComponent(kata.trim())}` : "/menu",
        );
      }}
      className="flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-border bg-surface p-2 sm:flex-row sm:items-center"
    >
      <label className="flex shrink-0 items-center gap-2 rounded-xl px-2 py-2 sm:py-0">
        <IconMeja className="size-4 text-accent" />
        <span className="sr-only">Nomor meja</span>
        <select
          value={meja.nilai ?? ""}
          onChange={(e) => meja.pilih(e.target.value || null)}
          className="bg-transparent text-sm outline-none"
        >
          <option value="">Bawa pulang</option>
          {(tables ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              Meja {t.number}
            </option>
          ))}
        </select>
      </label>

      <span className="hidden h-6 w-px shrink-0 bg-border sm:block" />

      <div className="relative min-w-0 flex-1">
        <IconCari className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
        <input
          value={kata}
          onChange={(e) => setKata(e.target.value)}
          type="search"
          placeholder="Cari kopi, nasi goreng, atau salad"
          aria-label="Cari menu"
          className="w-full bg-transparent py-2 pr-2 pl-8 text-sm outline-none"
        />
      </div>

      <button
        type="submit"
        aria-label="Cari menu"
        className="grid size-10 shrink-0 place-items-center self-end rounded-xl bg-accent text-white hover:bg-accent-ink sm:self-auto"
      >
        <IconCari className="size-4 text-white" />
      </button>
    </form>
  );
}
