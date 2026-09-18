"use client";

import { formatRupiah, formatWaktu } from "@/lib/client-api";
import { useApi } from "@/lib/use-api";

type Order = {
  code: string;
  status: "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "DONE" | "CANCELLED";
  customerName: string | null;
  note: string | null;
  total: string;
  createdAt: string;
  table: { number: string } | null;
  items: {
    id: string;
    qty: number;
    unitPrice: string;
    note: string | null;
    menu: { name: string };
  }[];
};

/** Urutan yang dilihat pelanggan. CANCELLED tidak masuk garis waktu. */
const TAHAPAN = [
  { status: "PENDING", label: "Diterima", detail: "Menunggu dikonfirmasi kasir" },
  { status: "CONFIRMED", label: "Dikonfirmasi", detail: "Pesanan masuk antrean" },
  { status: "PREPARING", label: "Dibuat", detail: "Barista sedang meracik" },
  { status: "READY", label: "Siap", detail: "Silakan ambil di kasir" },
  { status: "DONE", label: "Selesai", detail: "Terima kasih!" },
] as const;

export function OrderStatus({ code }: { code: string }) {
  // Pelanggan cuma melihat satu pesanan, jadi polling ringan sudah cukup —
  // tidak perlu buka koneksi SSE seperti layar dapur.
  const { data: order, error } = useApi<Order>(`/api/orders/${code}`, {
    refreshInterval: 8000,
  });

  if (error) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <p className="font-medium text-danger">Pesanan tidak ditemukan</p>
        <p className="mt-1 text-sm text-muted">{error.message}</p>
      </div>
    );
  }

  if (!order) {
    return <p className="mt-6 text-muted">Memuat…</p>;
  }

  const currentIndex = TAHAPAN.findIndex((t) => t.status === order.status);
  const dibatalkan = order.status === "CANCELLED";

  return (
    <div className="mt-6">
      <p className="text-sm text-muted">Kode pesanan</p>
      <h1 className="font-mono text-3xl font-semibold tracking-tight">
        {order.code}
      </h1>

      <p className="mt-1 text-sm text-muted">
        {order.table ? `Meja ${order.table.number}` : "Bawa pulang"}
        {order.customerName ? ` · ${order.customerName}` : ""} ·{" "}
        {formatWaktu(order.createdAt)}
      </p>

      {dibatalkan ? (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="font-medium text-danger">Pesanan dibatalkan</p>
          {order.note && <p className="mt-1 text-sm text-muted">{order.note}</p>}
        </div>
      ) : (
        <ol className="mt-6 space-y-1">
          {TAHAPAN.map((tahap, i) => {
            const lewat = i < currentIndex;
            const aktif = i === currentIndex;

            return (
              <li key={tahap.status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1 size-2.5 rounded-full ${
                      lewat || aktif ? "bg-accent" : "bg-border"
                    }`}
                  />
                  {i < TAHAPAN.length - 1 && (
                    <span
                      className={`w-px flex-1 ${lewat ? "bg-accent" : "bg-border"}`}
                    />
                  )}
                </div>

                <div className={`pb-5 ${aktif ? "" : "opacity-60"}`}>
                  <p className="font-medium">{tahap.label}</p>
                  <p className="text-sm text-muted">{tahap.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-2 rounded-xl border border-border bg-surface p-4">
        <ul className="space-y-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span>
                {item.qty}× {item.menu.name}
                {item.note && (
                  <span className="block text-xs text-muted">{item.note}</span>
                )}
              </span>
              <span className="shrink-0 text-muted">
                {formatRupiah(Number(item.unitPrice) * item.qty)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex justify-between border-t border-border pt-3 font-medium">
          <span>Total</span>
          <span>{formatRupiah(order.total)}</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Halaman ini memperbarui sendiri tiap beberapa detik.
      </p>
    </div>
  );
}
