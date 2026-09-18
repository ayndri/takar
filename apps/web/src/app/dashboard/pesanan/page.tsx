"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { PageHead, SearchBox, TablePager } from "@/components/ui/toolbar";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/use-table";
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
  items: {
    id: string;
    qty: number;
    note: string | null;
    unitPrice?: string;
    menu: { name: string };
  }[];
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
  const session = useSession();
  const pemilik = session?.user?.role === "OWNER";

  const { data, error, isLoading, isValidating, mutate } = useApi<Order[]>(
    "/api/admin/orders?limit=200",
  );

  const [aksiError, setAksiError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shortage, setShortage] = useState<{
    code: string;
    items: Shortage[];
  } | null>(null);

  useEffect(() => {
    // Backend cuma mengirim sinyal "ada yang berubah" lewat SSE. Datanya tetap
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
  const berjalan = orders.filter((o) =>
    ["PENDING", "CONFIRMED", "PREPARING", "READY"].includes(o.status),
  );
  const selesai = orders.filter(
    (o) => o.status === "DONE" || o.status === "CANCELLED",
  );

  const hariIni = new Date().toDateString();
  const selesaiHariIni = selesai.filter(
    (o) => new Date(o.createdAt).toDateString() === hariIni,
  );
  const omzetHariIni = selesaiHariIni
    .filter((o) => o.status === "DONE")
    .reduce((s, o) => s + Number(o.total), 0);

  const arsip = useTable(selesai, {
    cari: (o) => [
      o.code,
      o.customerName,
      o.table?.number ? `meja ${o.table.number}` : null,
      ...o.items.map((i) => i.menu.name),
    ],
    perHalaman: 10,
  });

  const dibuka = orders.find((o) => o.id === openId);

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
        setOpenId(null);
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
      <PageHead
        judul="Pesanan"
        deskripsi="Stok bahan dipotong saat pesanan dikonfirmasi."
        aksi={
          <button
            type="button"
            onClick={() => void mutate()}
            disabled={isValidating}
            aria-live="polite"
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {isValidating && (
              <span
                aria-hidden="true"
                className="size-3.5 animate-spin rounded-full border-2 border-border border-t-accent"
              />
            )}
            {isValidating ? "Memuat…" : "Muat ulang"}
          </button>
        }
      />

      <StatRow>
        <StatCard
          label="Perlu dikonfirmasi"
          nilai={
            isLoading
              ? "…"
              : String(orders.filter((o) => o.status === "PENDING").length)
          }
          catatan="stok belum dipotong"
          nada={
            orders.some((o) => o.status === "PENDING") ? "sorot" : "netral"
          }
        />
        <StatCard
          label="Sedang berjalan"
          nilai={isLoading ? "…" : String(berjalan.length)}
          catatan="dari diterima sampai siap"
        />
        <StatCard
          label="Selesai hari ini"
          nilai={
            isLoading
              ? "…"
              : String(selesaiHariIni.filter((o) => o.status === "DONE").length)
          }
        />
        {pemilik && (
          <StatCard
            label="Omzet hari ini"
            nilai={isLoading ? "…" : formatRupiah(omzetHariIni)}
            catatan="dari pesanan yang selesai"
          />
        )}
      </StatRow>

      {(error || aksiError) && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm text-danger">
          {aksiError ?? error?.message}
        </p>
      )}

      {shortage && (
        <div className="mb-4 rounded-lg border border-accent bg-accent-soft p-4">
          <p className="font-medium text-accent-ink">
            Pesanan {shortage.code} tidak bisa dikonfirmasi, bahan kurang
          </p>
          <ul className="mt-2 space-y-1 text-sm text-accent-ink/90">
            {shortage.items.map((s) => (
              <li key={s.ingredient}>
                {s.ingredient}: butuh {s.needed}, tersedia {s.available}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-accent-ink/80">
            Tidak ada bahan yang terpotong. Pesanan masih berstatus baru masuk.
          </p>
        </div>
      )}

      {isLoading && (
        <p className="mb-4 text-sm text-muted">Memuat papan pesanan…</p>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {KOLOM.map((kolom) => {
          const isi = orders.filter((o) => o.status === kolom.status);

          return (
            <section key={kolom.status}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                {kolom.judul}
                <span className="rounded bg-sunk px-1.5 py-0.5 text-xs text-muted">
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
                    <button
                      type="button"
                      onClick={() => setOpenId(order.id)}
                      className="block w-full text-left"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-sm font-medium">
                          {order.code}
                        </span>
                        <span className="text-xs text-muted">
                          {order.table
                            ? `Meja ${order.table.number}`
                            : "Bawa pulang"}
                        </span>
                      </span>

                      {order.customerName && (
                        <span className="mt-0.5 block text-xs text-muted">
                          {order.customerName}
                        </span>
                      )}

                      <span className="mt-3 block space-y-1 text-sm">
                        {order.items.slice(0, 3).map((item) => (
                          <span key={item.id} className="block">
                            {item.qty}× {item.menu.name}
                            {item.note && (
                              <span className="text-muted"> · {item.note}</span>
                            )}
                          </span>
                        ))}
                        {order.items.length > 3 && (
                          <span className="block text-muted">
                            +{order.items.length - 3} lagi
                          </span>
                        )}
                      </span>

                      {order.note && (
                        <span className="mt-2 block text-xs text-warning">
                          {order.note}
                        </span>
                      )}

                      <span className="mt-3 block text-sm font-medium">
                        {formatRupiah(order.total)}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatWaktu(order.createdAt)}
                      </span>
                    </button>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <TombolLanjut
                        order={order}
                        sibuk={busy === order.id}
                        onKonfirmasi={() => void konfirmasi(order)}
                        onLanjut={(s) => void ubahStatus(order, s)}
                      />
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

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Riwayat pesanan</h2>

        <div className="mb-3">
          <SearchBox
            nilai={arsip.kata}
            onChange={arsip.setKata}
            placeholder="Cari kode, nama, meja, atau menu…"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Meja</th>
                <th className="px-4 py-3 font-medium">Isi</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {arsip.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    {selesai.length === 0
                      ? "Belum ada pesanan yang selesai."
                      : "Tidak ada pesanan yang cocok."}
                  </td>
                </tr>
              )}

              {arsip.items.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-mono">{order.code}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {formatWaktu(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {order.table ? order.table.number : "bawa pulang"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {order.items.length} item
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        order.status === "CANCELLED" ? "text-danger" : ""
                      }
                    >
                      {LABEL[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatRupiah(order.total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenId(order.id)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs whitespace-nowrap hover:border-accent"
                    >
                      Lihat rincian
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePager
          halaman={arsip.halaman}
          halamanTotal={arsip.halamanTotal}
          awal={arsip.awal}
          akhir={arsip.akhir}
          total={arsip.total}
          satuan="pesanan"
          onGanti={arsip.setHalaman}
        />
      </section>

      {dibuka && (
        <Modal
          judul={dibuka.code}
          deskripsi={`${LABEL[dibuka.status]} · ${
            dibuka.table ? `meja ${dibuka.table.number}` : "bawa pulang"
          }${dibuka.customerName ? ` · ${dibuka.customerName}` : ""}`}
          onClose={() => setOpenId(null)}
        >
          <p className="text-sm text-muted">{formatWaktu(dibuka.createdAt)}</p>

          <ul className="mt-4 space-y-2">
            {dibuka.items.map((item) => (
              <li
                key={item.id}
                className="flex justify-between gap-3 border-b border-border pb-2 text-sm last:border-0"
              >
                <span>
                  {item.qty}× {item.menu.name}
                  {item.note && (
                    <span className="block text-xs text-warning">
                      {item.note}
                    </span>
                  )}
                </span>
                {item.unitPrice && (
                  <span className="shrink-0 text-muted tabular-nums">
                    {formatRupiah(Number(item.unitPrice) * item.qty)}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {dibuka.note && (
            <p className="mt-3 rounded-lg bg-sunk px-3 py-2 text-sm">
              Catatan pesanan: {dibuka.note}
            </p>
          )}

          <p className="mt-4 flex justify-between border-t border-border pt-3 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatRupiah(dibuka.total)}</span>
          </p>

          {["PENDING", "CONFIRMED", "PREPARING", "READY"].includes(
            dibuka.status,
          ) && (
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void batalkan(dibuka)}
                disabled={busy === dibuka.id}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted"
              >
                Batalkan
              </button>
              <TombolLanjut
                order={dibuka}
                sibuk={busy === dibuka.id}
                onKonfirmasi={() => void konfirmasi(dibuka)}
                onLanjut={(s) => void ubahStatus(dibuka, s)}
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/**
 * Tombol yang memajukan pesanan satu langkah.
 *
 * Isinya ditentukan status sekarang, jadi tidak ada tombol yang muncul untuk
 * langkah yang tidak boleh dilakukan.
 */
function TombolLanjut({
  order,
  sibuk,
  onKonfirmasi,
  onLanjut,
}: {
  order: Order;
  sibuk: boolean;
  onKonfirmasi: () => void;
  onLanjut: (status: "PREPARING" | "READY" | "DONE") => void;
}) {
  if (order.status === "PENDING") {
    return (
      <button
        type="button"
        onClick={onKonfirmasi}
        disabled={sibuk}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {sibuk ? "…" : "Konfirmasi"}
      </button>
    );
  }

  const berikutnya =
    order.status === "CONFIRMED"
      ? (["PREPARING", "Mulai buat"] as const)
      : order.status === "PREPARING"
        ? (["READY", "Siap"] as const)
        : order.status === "READY"
          ? (["DONE", "Selesai"] as const)
          : null;

  if (!berikutnya) return null;

  return (
    <button
      type="button"
      onClick={() => onLanjut(berikutnya[0])}
      disabled={sibuk}
      className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
    >
      {berikutnya[1]}
    </button>
  );
}
