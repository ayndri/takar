"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { PageHead, SearchBox, TablePager } from "@/components/ui/toolbar";
import { formatRupiah, formatWaktu } from "@/lib/client-api";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/use-table";
import { useApi } from "@/lib/use-api";

type Ingredient = {
  id: string;
  name: string;
  baseUnit: string;
  qty: string;
  minStock: string;
  avgCost: string;
  value: string;
  isLow: boolean;
  purchaseUnits: { id: string; name: string; factor: string }[];
};

type StockCard = {
  ingredient: { name: string; baseUnit: string };
  currentQty: string;
  ledgerQty: string;
  movements: {
    id: string;
    createdAt: string;
    type: string;
    qty: string;
    balance: string;
    note: string | null;
  }[];
};

const JENIS: Record<string, string> = {
  PURCHASE: "Barang masuk",
  SALE: "Terjual",
  WASTE: "Terbuang",
  ADJUSTMENT: "Penyesuaian opname",
  RETURN: "Dikembalikan",
  TRANSFER_IN: "Masuk",
  TRANSFER_OUT: "Keluar",
};

export default function BahanPage() {
  const session = useSession();
  const pemilik = session?.user?.role === "OWNER";

  const { data, error, isLoading } = useApi<Ingredient[]>("/api/ingredients");
  const [openId, setOpenId] = useState<string | null>(null);

  // Riwayat baru diambil saat barisnya dibuka: key null berarti SWR diam.
  const card = useApi<StockCard>(
    openId ? `/api/ingredients/${openId}/card` : null,
  );

  const items = data ?? [];
  const tabel = useTable(items, {
    cari: (i) => [i.name, i.baseUnit],
    perHalaman: 10,
  });

  const totalNilai = items.reduce((s, i) => s + Number(i.value), 0);
  const menipis = items.filter((i) => i.isLow);
  const terbesar = [...items].sort((a, b) => Number(b.value) - Number(a.value))[0];
  const dibuka = items.find((i) => i.id === openId);

  return (
    <div>
      <PageHead
        judul="Bahan baku"
        deskripsi="Stok dihitung dari riwayat pergerakan, bukan angka yang diketik."
      />

      <StatRow>
        <StatCard
          label="Jenis bahan"
          nilai={isLoading ? "…" : String(items.length)}
          catatan={`${items.filter((i) => !i.isLow).length} stoknya aman`}
        />
        <StatCard
          label="Perlu dibeli"
          nilai={isLoading ? "…" : String(menipis.length)}
          catatan="di bawah stok minimum"
          nada={menipis.length > 0 ? "sorot" : "netral"}
        />
        {pemilik && (
          <StatCard
            label="Nilai persediaan"
            nilai={isLoading ? "…" : formatRupiah(totalNilai)}
            catatan="stok x harga rata-rata"
          />
        )}
        {pemilik && terbesar && (
          <StatCard
            label="Nilai terbesar"
            nilai={terbesar.name}
            catatan={formatRupiah(terbesar.value)}
          />
        )}
      </StatRow>

      {error && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm text-danger">
          {error.message}
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SearchBox
          nilai={tabel.kata}
          onChange={tabel.setKata}
          placeholder="Cari nama bahan…"
        />
        {menipis.length > 0 && (
          <p className="text-sm text-warning">
            {menipis.map((m) => m.name).join(", ")} perlu dibeli
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Bahan</th>
              <th className="px-4 py-3 text-right font-medium">Stok</th>
              <th className="px-4 py-3 text-right font-medium">Minimum</th>
              {pemilik && (
                <th className="px-4 py-3 text-right font-medium">
                  Harga rata-rata
                </th>
              )}
              {pemilik && (
                <th className="px-4 py-3 text-right font-medium">Nilai</th>
              )}
              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Memuat daftar bahan…
                </td>
              </tr>
            )}

            {!isLoading && tabel.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Tidak ada bahan bernama &ldquo;{tabel.kata}&rdquo;.
                </td>
              </tr>
            )}

            {tabel.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{item.name}</span>
                  {item.isLow && (
                    <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs text-warning">
                      menipis
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {item.qty} {item.baseUnit.toLowerCase()}
                </td>
                <td className="px-4 py-3 text-right text-muted tabular-nums">
                  {item.minStock}
                </td>
                {pemilik && (
                  <td className="px-4 py-3 text-right text-muted tabular-nums">
                    {formatRupiah(item.avgCost)}
                  </td>
                )}
                {pemilik && (
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatRupiah(item.value)}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setOpenId(item.id)}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs whitespace-nowrap hover:border-accent"
                  >
                    Lihat riwayat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager
        halaman={tabel.halaman}
        halamanTotal={tabel.halamanTotal}
        awal={tabel.awal}
        akhir={tabel.akhir}
        total={tabel.total}
        satuan="bahan"
        onGanti={tabel.setHalaman}
      />

      {openId && (
        <Modal
          judul={`Riwayat stok ${dibuka?.name ?? ""}`}
          deskripsi="Tiap baris satu kejadian. Kolom saldo adalah sisa stok setelah kejadian itu, seperti buku tabungan."
          lebar="lg"
          onClose={() => setOpenId(null)}
        >
          {!card.data ? (
            <p className="text-sm text-muted">
              {card.error ? card.error.message : "Memuat riwayat…"}
            </p>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted">Stok sekarang</p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {card.data.currentQty}{" "}
                    {card.data.ingredient.baseUnit.toLowerCase()}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted">Hasil penjumlahan riwayat</p>
                  <p
                    className={`mt-0.5 font-semibold tabular-nums ${
                      card.data.currentQty !== card.data.ledgerQty
                        ? "text-danger"
                        : ""
                    }`}
                  >
                    {card.data.ledgerQty}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted">Jumlah kejadian</p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {card.data.movements.length}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-2 font-medium">Waktu</th>
                      <th className="py-2 font-medium">Kejadian</th>
                      <th className="py-2 text-right font-medium">Jumlah</th>
                      <th className="py-2 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.data.movements.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="py-2 whitespace-nowrap text-muted">
                          {formatWaktu(m.createdAt)}
                        </td>
                        <td className="py-2">
                          {JENIS[m.type] ?? m.type}
                          {m.note && (
                            <span className="text-muted"> · {m.note}</span>
                          )}
                        </td>
                        <td
                          className={`py-2 text-right tabular-nums ${
                            Number(m.qty) < 0 ? "text-danger" : ""
                          }`}
                        >
                          {Number(m.qty) > 0 ? "+" : ""}
                          {m.qty}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {m.balance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
