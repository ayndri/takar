"use client";

import { useEffect, useState } from "react";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { useApi } from "@/lib/use-api";

type Order = {
  id: string;
  code: string;
  status: "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "DONE" | "CANCELLED";
  customerName: string | null;
  note: string | null;
  total: string;
  createdAt: string;
  table: { number: string } | null;
  items: { id: string; qty: number; note: string | null; menu: { name: string } }[];
};

type Shortage = { ingredient: string; needed: string; available: string };

const LABEL: Record<Order["status"], string> = {
  PENDING: "Baru masuk",
  CONFIRMED: "Dikonfirmasi",
  PREPARING: "Sedang dibuat",
  READY: "Siap diambil",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

const KOLOM = [
  { status: "PENDING", judul: "Perlu dikonfirmasi" },
  { status: "CONFIRMED", judul: "Antrean" },
  { status: "PREPARING", judul: "Dibuat" },
  { status: "READY", judul: "Siap diambil" },
] as const;

export default function PesananPage() {
  const { data, error, mutate } = useApi<Order[]>("/api/admin/orders?limit=100");

  const [aksiError, setAksiError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [shortage, setShortage] = useState<{
    code: string;
    items: Shortage[];
  } | null>(null);

  useEffect(() => {
    // Backend cuma mengirim sinyal "ada yang berubah" lewat SSE — datanya tetap
    // diambil lewat endpoint ber-token, karena EventSource tidak bisa mengirim
    // header Authorization.
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const stream = new EventSource(`${base}/api/stream/orders`);

    stream.addEventListener("changed", () => {
      void mutate();
    });

    return () => stream.close();
  }, [mutate]);

  const orders = data ?? [];

  async function aksi(order: Order, jalur: () => Promise<unknown>) {
    setBusy(order.id);
    setShortage(null);
    setAksiError(null);

    try {
      await jalur();
      await mutate();
    } catch (e) {
      if (e instanceof ApiError && e.code === "INSUFFICIENT_STOCK") {
        const details = e.details as { shortages: Shortage[] };
        setShortage({ code: order.code, items: details.shortages });
      } else {
        setAksiError(e instanceof ApiError ? e.message : "Aksi gagal");
      }
    } finally {
      setBusy(null);
    }
  }

  const konfirmasi = (o: Order) =>
    aksi(o, () =>
      request(`/api/admin/orders/${o.id}/confirm`, { method: "POST" }),
    );

  const ubahStatus = (o: Order, status: "PREPARING" | "READY" | "DONE") =>
    aksi(o, () =>
      request(`/api/admin/orders/${o.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    );

  const batalkan = (o: Order) => {
    const reason = window.prompt(`Batalkan pesanan ${o.code}? Alasan:`);
    if (reason === null) return;
    return aksi(o, () =>
      request(`/api/admin/orders/${o.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pesanan</h1>
          <p className="mt-1 text-sm text-muted">
            Stok bahan dipotong saat pesanan dikonfirmasi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          Muat ulang
        </button>
      </div>

      {(error || aksiError) && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm text-danger">
          {aksiError ?? error?.message}
        </p>
      )}

      {shortage && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <p className="font-medium text-danger">
            Pesanan {shortage.code} tidak bisa dikonfirmasi, bahan kurang
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {shortage.items.map((s) => (
              <li key={s.ingredient}>
                {s.ingredient}: butuh {s.needed}, tersedia {s.available}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Tidak ada bahan yang terpotong. Pesanan masih berstatus baru masuk.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {KOLOM.map((kolom) => {
          const isi = orders.filter((o) => o.status === kolom.status);

          return (
            <section key={kolom.status}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                {kolom.judul}
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-muted">
                  {isi.length}
                </span>
              </h2>

              <ul className="space-y-3">
                {isi.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
                    Kosong
                  </li>
                )}

                {isi.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-medium">
                        {order.code}
                      </span>
                      <span className="text-xs text-muted">
                        {order.table
                          ? `Meja ${order.table.number}`
                          : "Bawa pulang"}
                      </span>
                    </div>

                    {order.customerName && (
                      <p className="mt-0.5 text-xs text-muted">
                        {order.customerName}
                      </p>
                    )}

                    <ul className="mt-3 space-y-1 text-sm">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.qty}× {item.menu.name}
                          {item.note && (
                            <span className="text-muted"> · {item.note}</span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {order.note && (
                      <p className="mt-2 text-xs text-warning">{order.note}</p>
                    )}

                    <p className="mt-3 text-sm font-medium">
                      {formatRupiah(order.total)}
                    </p>
                    <p className="text-xs text-muted">
                      {formatWaktu(order.createdAt)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {order.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => void konfirmasi(order)}
                          disabled={busy === order.id}
                          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {busy === order.id ? "…" : "Konfirmasi"}
                        </button>
                      )}

                      {order.status === "CONFIRMED" && (
                        <button
                          type="button"
                          onClick={() => void ubahStatus(order, "PREPARING")}
                          disabled={busy === order.id}
                          className="rounded-lg border border-border px-3 py-1.5 text-sm"
                        >
                          Mulai buat
                        </button>
                      )}

                      {order.status === "PREPARING" && (
                        <button
                          type="button"
                          onClick={() => void ubahStatus(order, "READY")}
                          disabled={busy === order.id}
                          className="rounded-lg border border-border px-3 py-1.5 text-sm"
                        >
                          Siap
                        </button>
                      )}

                      {order.status === "READY" && (
                        <button
                          type="button"
                          onClick={() => void ubahStatus(order, "DONE")}
                          disabled={busy === order.id}
                          className="rounded-lg border border-border px-3 py-1.5 text-sm"
                        >
                          Selesai
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void batalkan(order)}
                        disabled={busy === order.id}
                        className="rounded-lg px-2 py-1.5 text-sm text-muted"
                      >
                        Batalkan
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <details className="mt-8">
        <summary className="cursor-pointer text-sm text-muted">
          Pesanan selesai & dibatalkan
        </summary>
        <ul className="mt-3 space-y-2">
          {orders
            .filter((o) => o.status === "DONE" || o.status === "CANCELLED")
            .map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm"
              >
                <span className="font-mono">{order.code}</span>
                <span className="text-muted">
                  {order.items.map((i) => `${i.qty}× ${i.menu.name}`).join(", ")}
                </span>
                <span className="text-muted">{LABEL[order.status]}</span>
                <span>{formatRupiah(order.total)}</span>
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}
