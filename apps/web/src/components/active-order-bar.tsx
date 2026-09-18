"use client";

import Link from "next/link";
import { formatRupiah } from "@/lib/client-api";
import { lupakanPesananTerakhir, usePesananTerakhir } from "@/lib/last-order";
import { useApi } from "@/lib/use-api";

type Order = {
  code: string;
  status: "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "DONE" | "CANCELLED";
  total: string;
  table: { number: string } | null;
  items: { id: string; qty: number; menu: { name: string } }[];
};

const TAHAP = ["PENDING", "CONFIRMED", "PREPARING", "READY"] as const;

const LABEL: Record<string, string> = {
  PENDING: "Diterima",
  CONFIRMED: "Masuk antrean",
  PREPARING: "Sedang dibuat",
  READY: "Siap diambil",
};

/**
 * Bar status pesanan yang sedang berjalan.
 *
 * Hanya muncul kalau perangkat ini memang baru mengirim pesanan, dan hilang
 * sendiri begitu pesanannya selesai atau dibatalkan.
 */
export function ActiveOrderBar() {
  const code = usePesananTerakhir();
  const { data: order } = useApi<Order>(code ? `/api/orders/${code}` : null, {
    refreshInterval: 10000,
  });

  if (!code || !order) return null;

  if (order.status === "DONE" || order.status === "CANCELLED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
        <p className="text-sm">
          Pesanan <span className="font-mono font-medium">{order.code}</span>{" "}
          {order.status === "DONE" ? "sudah selesai." : "dibatalkan."}
        </p>
        <button
          type="button"
          onClick={lupakanPesananTerakhir}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-ink"
        >
          Sembunyikan
        </button>
      </div>
    );
  }

  const indeks = TAHAP.indexOf(order.status as (typeof TAHAP)[number]);
  const ringkasan = order.items
    .map((i) => `${i.qty}× ${i.menu.name}`)
    .join(", ");

  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            Pesanan kamu {LABEL[order.status]?.toLowerCase()}
          </p>
          <p className="truncate text-sm text-muted">
            <span className="font-mono">{order.code}</span>
            {order.table ? ` · meja ${order.table.number}` : " · bawa pulang"} ·{" "}
            {ringkasan}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular-nums">
            {formatRupiah(order.total)}
          </span>
          <Link
            href={`/pesanan/${order.code}`}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-ink"
          >
            Lihat status
          </Link>
        </div>
      </div>

      <ol className="mt-4 flex items-center gap-2">
        {TAHAP.map((tahap, i) => (
          <li key={tahap} className="flex flex-1 items-center gap-2">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-medium ${
                i <= indeks
                  ? "bg-accent text-white"
                  : "bg-sunk text-muted"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`hidden text-xs sm:inline ${
                i <= indeks ? "text-ink" : "text-muted"
              }`}
            >
              {LABEL[tahap]}
            </span>
            {i < TAHAP.length - 1 && (
              <span
                className={`h-0.5 flex-1 rounded ${
                  i < indeks ? "bg-accent" : "bg-border"
                }`}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
