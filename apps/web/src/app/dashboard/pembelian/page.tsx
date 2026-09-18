"use client";

import { useState } from "react";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { useApi } from "@/lib/use-api";

type Ingredient = {
  id: string;
  name: string;
  baseUnit: string;
  purchaseUnits: { id: string; name: string; factor: string }[];
};

type Purchase = {
  id: string;
  supplier: string;
  date: string;
  total: string;
  note: string | null;
  items: {
    id: string;
    qty: string;
    unitPrice: string;
    baseQty: string;
    ingredient: { name: string; baseUnit: string };
    purchaseUnit: { name: string } | null;
  }[];
};

type Baris = {
  ingredientId: string;
  purchaseUnitId: string;
  qty: string;
  unitPrice: string;
};

const BARIS_KOSONG: Baris = {
  ingredientId: "",
  purchaseUnitId: "",
  qty: "",
  unitPrice: "",
};

export default function PembelianPage() {
  const bahan = useApi<Ingredient[]>("/api/ingredients");
  const nota = useApi<Purchase[]>("/api/purchases");

  const [supplier, setSupplier] = useState("");
  const [rows, setRows] = useState<Baris[]>([{ ...BARIS_KOSONG }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const ingredients = bahan.data ?? [];
  const purchases = nota.data ?? [];

  function ubahBaris(index: number, patch: Partial<Baris>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);

    try {
      await request("/api/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplier,
          items: rows
            .filter((r) => r.ingredientId && r.qty && r.unitPrice)
            .map((r) => ({
              ingredientId: r.ingredientId,
              ...(r.purchaseUnitId && { purchaseUnitId: r.purchaseUnitId }),
              qty: Number(r.qty),
              unitPrice: Number(r.unitPrice),
            })),
        }),
      });

      setSupplier("");
      setRows([{ ...BARIS_KOSONG }]);
      setOk("Nota tersimpan. Stok dan harga rata-rata sudah diperbarui.");
      await Promise.all([bahan.mutate(), nota.mutate()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan nota");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Pembelian</h1>
        <p className="mt-1 text-sm text-muted">
          Barang masuk dari supplier. Harga rata-rata tiap bahan ikut dihitung
          ulang otomatis.
        </p>
      </div>

      <form
        onSubmit={simpan}
        className="mb-8 rounded-xl border border-border bg-surface p-4"
      >
        <label className="block text-sm">
          <span className="text-muted">Supplier</span>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            required
            placeholder="Contoh: Toko Bahan Jaya"
            className="mt-1 w-full max-w-sm rounded-lg border border-border bg-paper px-3 py-2"
          />
        </label>

        <div className="mt-4 space-y-3">
          {rows.map((row, index) => {
            const bahan = ingredients.find((i) => i.id === row.ingredientId);

            return (
              <div
                key={index}
                className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
              >
                <select
                  value={row.ingredientId}
                  onChange={(e) =>
                    ubahBaris(index, {
                      ingredientId: e.target.value,
                      purchaseUnitId: "",
                    })
                  }
                  className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                >
                  <option value="">Pilih bahan…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>

                <select
                  value={row.purchaseUnitId}
                  onChange={(e) =>
                    ubahBaris(index, { purchaseUnitId: e.target.value })
                  }
                  disabled={!bahan}
                  className="rounded-lg border border-border bg-paper px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">
                    {bahan ? bahan.baseUnit.toLowerCase() : "satuan"}
                  </option>
                  {bahan?.purchaseUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.factor})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={row.qty}
                  onChange={(e) => ubahBaris(index, { qty: e.target.value })}
                  placeholder="Jumlah"
                  className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                />

                <input
                  type="number"
                  step="1"
                  min="0"
                  value={row.unitPrice}
                  onChange={(e) =>
                    ubahBaris(index, { unitPrice: e.target.value })
                  }
                  placeholder="Harga/satuan"
                  className="rounded-lg border border-border bg-paper px-3 py-2 text-sm"
                />

                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={rows.length === 1}
                  className="rounded-lg px-2 text-sm text-muted disabled:opacity-30"
                  aria-label="Hapus baris"
                >
                  Hapus
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { ...BARIS_KOSONG }])}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          Tambah baris
        </button>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {ok && <p className="mt-4 text-sm text-accent">{ok}</p>}

        <div className="mt-4 border-t border-border pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan nota"}
          </button>
        </div>
      </form>

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
        Riwayat pembelian
      </h2>

      <ul className="space-y-3">
        {purchases.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            Belum ada nota pembelian.
          </li>
        )}

        {purchases.map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{p.supplier}</span>
              <span className="text-sm text-muted">{formatWaktu(p.date)}</span>
            </div>

            <ul className="mt-2 space-y-1 text-sm">
              {p.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>
                    {item.ingredient.name}: {item.qty}{" "}
                    {item.purchaseUnit?.name ??
                      item.ingredient.baseUnit.toLowerCase()}
                    <span className="text-muted">
                      {" "}
                      (= {item.baseQty} {item.ingredient.baseUnit.toLowerCase()})
                    </span>
                  </span>
                  <span className="text-muted">
                    {formatRupiah(item.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-2 border-t border-border pt-2 text-right font-medium">
              {formatRupiah(p.total)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
