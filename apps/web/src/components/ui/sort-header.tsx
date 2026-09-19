"use client";

import type { Arah } from "@/lib/use-table";

/**
 * Judul kolom yang bisa diklik untuk mengurutkan.
 *
 * Arah pengurutan ditandai panah sekaligus `aria-sort`, supaya pembaca layar
 * mengumumkan hal yang sama dengan yang terlihat.
 */
export function SortHeader({
  label,
  kolom,
  urutan,
  onUrutkan,
  rata = "kiri",
}: {
  label: string;
  kolom: string;
  urutan: { kolom: string; arah: Arah } | null;
  onUrutkan: (kolom: string) => void;
  rata?: "kiri" | "kanan";
}) {
  const aktif = urutan?.kolom === kolom;

  return (
    <th
      scope="col"
      aria-sort={
        aktif ? (urutan.arah === "naik" ? "ascending" : "descending") : "none"
      }
      className={`px-4 py-3 font-medium ${rata === "kanan" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onUrutkan(kolom)}
        className={`inline-flex items-center gap-1 rounded hover:text-ink ${
          aktif ? "text-ink" : ""
        } ${rata === "kanan" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <span
          aria-hidden="true"
          className={`text-[10px] leading-none ${aktif ? "text-accent" : "text-border"}`}
        >
          {aktif ? (urutan.arah === "naik" ? "▲" : "▼") : "▲"}
        </span>
      </button>
    </th>
  );
}
