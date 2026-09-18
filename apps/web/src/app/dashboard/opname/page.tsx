"use client";

import { useState } from "react";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { useApi } from "@/lib/use-api";

type Ingredient = {
  id: string;
  name: string;
  baseUnit: string;
  qty: string;
};

type Opname = {
  id: string;
  date: string;
  note: string | null;
  by: string;
  totalValue: string;
  items: {
    ingredientId: string;
    name: string;
    baseUnit: string;
    systemQty: string;
    physicalQty: string;
    diff: string;
    value: string;
  }[];
};

export default function OpnamePage() {
  const bahan = useApi<Ingredient[]>("/api/ingredients");
  const riwayat = useApi<Opname[]>("/api/opname");

  const [fisik, setFisik] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const ingredients = bahan.data ?? [];
  const history = riwayat.data ?? [];

  async function simpan(e: React.FormEvent) {
    e.preventDefault();

    const items = Object.entries(fisik)
      .filter(([, v]) => v.trim() !== "")
      .map(([ingredientId, v]) => ({
        ingredientId,
        physicalQty: Number(v),
      }));

    if (items.length === 0) {
      setError("Isi minimal satu hasil hitung fisik");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await request("/api/opname", {
        method: "POST",
        body: JSON.stringify({
          ...(note.trim() && { note: note.trim() }),
          items,
        }),
      });

      setFisik({});
      setNote("");
      await Promise.all([bahan.mutate(), riwayat.mutate()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan opname");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Stock opname</h1>
        <p className="mt-1 text-sm text-muted">
          Isi hasil hitung fisik. Angka sistem tidak ditimpa — selisihnya
          dicatat sebagai penyesuaian di kartu stok.
        </p>
      </div>

      <form
        onSubmit={simpan}
        className="mb-8 rounded-xl border border-border bg-surface p-4"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="pb-2 font-medium">Bahan</th>
                <th className="pb-2 text-right font-medium">Menurut sistem</th>
                <th className="pb-2 text-right font-medium">Hitung fisik</th>
                <th className="pb-2 text-right font-medium">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((item) => {
                const isi = fisik[item.id] ?? "";
                const selisih =
                  isi.trim() === "" ? null : Number(isi) - Number(item.qty);

                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-right text-muted tabular-nums">
                      {item.qty} {item.baseUnit.toLowerCase()}
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={isi}
                        onChange={(e) =>
                          setFisik((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="—"
                        className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-right"
                      />
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        selisih === null
                          ? "text-muted"
                          : selisih < 0
                            ? "text-danger"
                            : selisih > 0
                              ? "text-warning"
                              : "text-muted"
                      }`}
                    >
                      {selisih === null
                        ? "—"
                        : `${selisih > 0 ? "+" : ""}${selisih}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan opname (opsional)"
          className="mt-4 w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-lg bg-accent px-4 py-2 font-medium text-background disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan opname"}
        </button>
      </form>

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
        Riwayat opname
      </h2>

      <ul className="space-y-3">
        {history.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            Belum pernah opname.
          </li>
        )}

        {history.map((op) => (
          <li
            key={op.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-medium">{formatWaktu(op.date)}</p>
                <p className="text-sm text-muted">
                  oleh {op.by}
                  {op.note ? ` · ${op.note}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <p
                  className={`text-sm font-medium ${
                    Number(op.totalValue) < 0 ? "text-danger" : "text-muted"
                  }`}
                >
                  Selisih {formatRupiah(op.totalValue)}
                </p>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === op.id ? null : op.id)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs"
                >
                  {openId === op.id ? "Tutup" : "Rincian"}
                </button>
              </div>
            </div>

            {openId === op.id && (
              <table className="mt-3 w-full border-t border-border text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-2 font-medium">Bahan</th>
                    <th className="py-2 text-right font-medium">Sistem</th>
                    <th className="py-2 text-right font-medium">Fisik</th>
                    <th className="py-2 text-right font-medium">Selisih</th>
                    <th className="py-2 text-right font-medium">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {op.items.map((i) => (
                    <tr key={i.ingredientId} className="border-t border-border">
                      <td className="py-2">{i.name}</td>
                      <td className="py-2 text-right text-muted tabular-nums">
                        {i.systemQty}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {i.physicalQty}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          Number(i.diff) < 0 ? "text-danger" : ""
                        }`}
                      >
                        {Number(i.diff) > 0 ? "+" : ""}
                        {i.diff}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatRupiah(i.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
