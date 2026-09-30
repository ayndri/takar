"use client";

import { useState } from "react";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { muatSnap } from "@/lib/snap";
import { useApi } from "@/lib/use-api";

type Order = {
  code: string;
  status: "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "DONE" | "CANCELLED";
  customerName: string | null;
  note: string | null;
  total: string;
  createdAt: string;
  table: { number: string } | null;
  paymentMethod: "CASHIER" | "ONLINE";
  payments: {
    status:
      | "PENDING"
      | "PAID"
      | "FAILED"
      | "EXPIRED"
      | "CANCELLED"
      | "REFUND_NEEDED";
    channel: string | null;
    amount: string;
    paidAt: string | null;
  }[];
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

/** Yang dibaca tamu, bukan istilah Midtrans. */
const KABAR_BAYAR: Record<string, { teks: string; nada: "tunggu" | "aman" | "gagal" }> = {
  PENDING: { teks: "Menunggu pembayaran", nada: "tunggu" },
  PAID: { teks: "Pembayaran diterima", nada: "aman" },
  FAILED: { teks: "Pembayaran gagal", nada: "gagal" },
  EXPIRED: { teks: "Batas waktu pembayaran habis", nada: "gagal" },
  CANCELLED: { teks: "Pembayaran dibatalkan", nada: "gagal" },
  REFUND_NEEDED: {
    teks: "Sudah dibayar, tapi bahannya keburu habis — kafe akan menghubungimu untuk pengembalian dana",
    nada: "gagal",
  },
};

export function OrderStatus({ code }: { code: string }) {
  const [sibukBayar, setSibukBayar] = useState(false);
  const [galatBayar, setGalatBayar] = useState<string | null>(null);
  // Pelanggan cuma melihat satu pesanan, jadi polling ringan sudah cukup —
  // tidak perlu buka koneksi SSE seperti layar dapur.
  const { data: order, error, mutate } = useApi<Order>(`/api/orders/${code}`, {
    refreshInterval: 8000,
  });

  /**
   * Buka lagi popup pembayaran.
   *
   * Sebelum memintanya, backend ditanya dulu apakah ada kabar baru dari
   * Midtrans. Notifikasi bisa tercecer di jaringan — dan saat dikembangkan di
   * laptop, Midtrans memang tidak bisa memanggil localhost sama sekali. Tanpa
   * langkah ini, pesanan yang sebenarnya sudah lunas bisa terlihat menggantung
   * selamanya.
   */
  async function bayar() {
    setSibukBayar(true);
    setGalatBayar(null);

    try {
      await request(`/api/payments/${code}/refresh`, { method: "POST" }).catch(
        () => null,
      );

      const segar = await mutate();
      if (segar?.payments[0]?.status === "PAID") return;

      const bayar = await request<{
        snapToken: string | null;
        clientKey: string;
        produksi: boolean;
      }>(`/api/payments/${code}/snap`, { method: "POST" });

      if (!bayar.snapToken) throw new Error("Token pembayaran tidak diterima");

      const snap = await muatSnap(bayar.clientKey, bayar.produksi);

      snap.pay(bayar.snapToken, {
        onSuccess: () => void mutate(),
        onPending: () => void mutate(),
        onClose: () => void mutate(),
      });
    } catch (e) {
      setGalatBayar(
        e instanceof ApiError ? e.message : "Gagal membuka halaman pembayaran",
      );
    } finally {
      setSibukBayar(false);
    }
  }

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

  const bayaran = order.payments[0];
  const kabar = bayaran ? KABAR_BAYAR[bayaran.status] : undefined;

  // Tombol bayar ditawarkan selama pesanannya masih bisa dibayar. Pesanan
  // yang sudah dikonfirmasi berarti uangnya sudah masuk atau kasir sudah
  // menanganinya; menawarkan bayar lagi di situ cuma membingungkan.
  const perluBayar =
    order.status === "PENDING" &&
    (!bayaran || ["PENDING", "FAILED", "EXPIRED", "CANCELLED"].includes(bayaran.status));

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

      {order.paymentMethod === "ONLINE" && (
        <div
          className={`mt-2 rounded-xl border p-4 ${
            kabar?.nada === "aman"
              ? "border-accent/40 bg-accent-soft/40"
              : kabar?.nada === "gagal"
                ? "border-danger/40"
                : "border-warning/40"
          }`}
        >
          <p className="text-sm font-medium">
            {kabar?.teks ?? "Menunggu pembayaran"}
          </p>

          {bayaran?.channel && bayaran.status === "PAID" && (
            <p className="mt-0.5 text-sm text-muted">
              Lewat {bayaran.channel.replace(/_/g, " ")}
              {bayaran.paidAt && ` · ${formatWaktu(bayaran.paidAt)}`}
            </p>
          )}

          {galatBayar && (
            <p className="mt-2 text-sm text-danger">{galatBayar}</p>
          )}

          {perluBayar && (
            <button
              type="button"
              onClick={bayar}
              disabled={sibukBayar}
              className="mt-3 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {sibukBayar ? "Membuka…" : "Bayar sekarang"}
            </button>
          )}
        </div>
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
