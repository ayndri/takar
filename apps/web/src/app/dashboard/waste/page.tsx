"use client";

import { useState } from "react";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { useApi } from "@/lib/use-api";

type Ingredient = { id: string; name: string; baseUnit: string };

type WasteRow = {
  id: string;
  createdAt: string;
  ingredient: string;
  baseUnit: string;
  qty: string;
  value: string;
  reason: string;
  note: string | null;
  by: string;
};

const ALASAN = [
  { value: "SPILLED", label: "Tumpah" },
  { value: "EXPIRED", label: "Basi / kedaluwarsa" },
  { value: "MISTAKE", label: "Salah bikin" },
  { value: "OTHER", label: "Lainnya" },
] as const;

const LABEL_ALASAN = Object.fromEntries(
  ALASAN.map((a) => [a.value, a.label]),
) as Record<string, string>;

export default function WastePage() {
  const bahan = useApi<Ingredient[]>("/api/ingredients");
  const riwayat = useApi<WasteRow[]>("/api/waste");

  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<string>("SPILLED");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingredients = bahan.data ?? [];
  const logs = riwayat.data ?? [];

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await request("/api/waste", {
        method: "POST",
        body: JSON.stringify({
          ingredientId,
          qty: Number(qty),
          reason,
          ...(note.trim() && { note: note.trim() }),
        }),
      });

      setQty("");
      setNote("");
      await Promise.all([bahan.mutate(), riwayat.mutate()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan catatan");
    } finally {
      setSaving(false);
    }
  }

  const bahanTerpilih = ingredients.find((i) => i.id === ingredientId);
  const totalNilai = logs.reduce((sum, l) => sum + Number(l.value), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Waste</h1>
        <p className="mt-1 text-sm text-muted">
          Bahan yang terbuang dicatat terpisah dari penjualan — ini yang
          menjawab ke mana uangnya bocor.
        </p>
      </div>

      <form
        onSubmit={simpan}
        className="mb-8 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[2fr_1fr_1.5fr_2fr_auto]"
      >
        <select
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
          required
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Pilih bahan…</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          step="0.001"
          min="0.001"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          required
          placeholder={bahanTerpilih?.baseUnit.toLowerCase() ?? "jumlah"}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />

        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          {ALASAN.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? "…" : "Catat"}
        </button>

        {error && (
          <p className="text-sm text-danger sm:col-span-5">{error}</p>
        )}
      </form>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          Riwayat
        </h2>
        <p className="text-sm text-muted">
          Total terbuang: {formatRupiah(totalNilai)}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">Bahan</th>
              <th className="px-4 py-3 text-right font-medium">Jumlah</th>
              <th className="px-4 py-3 font-medium">Alasan</th>
              <th className="px-4 py-3 text-right font-medium">Nilai</th>
              <th className="px-4 py-3 font-medium">Oleh</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Belum ada catatan waste.
                </td>
              </tr>
            )}

            {logs.map((log) => (
              <tr key={log.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted">
                  {formatWaktu(log.createdAt)}
                </td>
                <td className="px-4 py-3">{log.ingredient}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {log.qty} {log.baseUnit.toLowerCase()}
                </td>
                <td className="px-4 py-3">
                  {LABEL_ALASAN[log.reason] ?? log.reason}
                  {log.note && (
                    <span className="text-muted"> · {log.note}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-danger tabular-nums">
                  {formatRupiah(log.value)}
                </td>
                <td className="px-4 py-3 text-muted">{log.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
