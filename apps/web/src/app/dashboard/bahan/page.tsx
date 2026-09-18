"use client";

import { useState } from "react";
import { formatRupiah, formatWaktu } from "@/lib/client-api";
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
  PURCHASE: "Pembelian",
  SALE: "Terjual",
  WASTE: "Terbuang",
  ADJUSTMENT: "Penyesuaian",
  RETURN: "Dikembalikan",
  TRANSFER_IN: "Masuk",
  TRANSFER_OUT: "Keluar",
};

export default function BahanPage() {
  const { data, error } = useApi<Ingredient[]>("/api/ingredients");
  const [openId, setOpenId] = useState<string | null>(null);

  // Kartu stok baru diambil saat barisnya dibuka — key null berarti SWR diam.
  const card = useApi<StockCard>(
    openId ? `/api/ingredients/${openId}/card` : null,
  );

  const items = data ?? [];
  const totalNilai = items.reduce((sum, i) => sum + Number(i.value), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Bahan baku</h1>
        <p className="mt-1 text-sm text-muted">
          Nilai persediaan sekarang {formatRupiah(totalNilai)} ·{" "}
          {items.filter((i) => i.isLow).length} bahan perlu dibeli
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm text-danger">
          {error.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Bahan</th>
              <th className="px-4 py-3 text-right font-medium">Stok</th>
              <th className="px-4 py-3 text-right font-medium">Minimum</th>
              <th className="px-4 py-3 text-right font-medium">
                Harga rata-rata
              </th>
              <th className="px-4 py-3 text-right font-medium">Nilai</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
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
                <td className="px-4 py-3 text-right text-muted tabular-nums">
                  {formatRupiah(item.avgCost)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatRupiah(item.value)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenId(openId === item.id ? null : item.id)
                    }
                    className="rounded-lg border border-border px-2.5 py-1 text-xs whitespace-nowrap"
                  >
                    {openId === item.id ? "Tutup" : "Kartu stok"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openId && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          {!card.data ? (
            <p className="text-sm text-muted">
              {card.error ? card.error.message : "Memuat kartu stok…"}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">
                  Kartu stok: {card.data.ingredient.name}
                </h2>
                <p className="text-xs text-muted">
                  cache {card.data.currentQty} · ledger {card.data.ledgerQty}
                  {card.data.currentQty !== card.data.ledgerQty && (
                    <span className="ml-1 text-danger">tidak cocok</span>
                  )}
                </p>
              </div>

              <div className="mt-3 overflow-x-auto">
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
                        <td className="py-2 text-muted">
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
        </div>
      )}
    </div>
  );
}
