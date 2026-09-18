"use client";

import { useState } from "react";
import { Select } from "@/components/select";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { PageHead, SearchBox, TablePager } from "@/components/ui/toolbar";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/use-table";
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
  const session = useSession();
  const pemilik = session?.user?.role === "OWNER";

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

  const tabel = useTable(logs, {
    cari: (l) => [l.ingredient, LABEL_ALASAN[l.reason], l.note, l.by],
    perHalaman: 10,
  });

  const totalNilai = logs.reduce((s, l) => s + Number(l.value), 0);

  const perBahan = new Map<string, number>();
  for (const l of logs) {
    perBahan.set(
      l.ingredient,
      (perBahan.get(l.ingredient) ?? 0) + Number(l.value),
    );
  }
  const paling = [...perBahan].sort((a, b) => b[1] - a[1])[0];

  const perAlasan = new Map<string, number>();
  for (const l of logs) {
    perAlasan.set(l.reason, (perAlasan.get(l.reason) ?? 0) + Number(l.value));
  }
  const alasanTeratas = [...perAlasan].sort((a, b) => b[1] - a[1])[0];

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

  return (
    <div>
      <PageHead
        judul="Waste"
        deskripsi="Bahan yang terbuang dicatat terpisah dari penjualan. Ini yang menjawab ke mana uangnya bocor."
      />

      <StatRow>
        <StatCard
          label="Jumlah catatan"
          nilai={riwayat.isLoading ? "…" : String(logs.length)}
        />
        {pemilik && (
          <StatCard
            label="Nilai terbuang"
            nilai={riwayat.isLoading ? "…" : formatRupiah(totalNilai)}
            nada="rugi"
          />
        )}
        {pemilik && paling && (
          <StatCard
            label="Bahan paling boros"
            nilai={paling[0]}
            catatan={formatRupiah(paling[1])}
          />
        )}
        {pemilik && alasanTeratas && (
          <StatCard
            label="Penyebab terbesar"
            nilai={LABEL_ALASAN[alasanTeratas[0]] ?? alasanTeratas[0]}
            catatan={formatRupiah(alasanTeratas[1])}
          />
        )}
      </StatRow>

      <form
        onSubmit={simpan}
        className="mb-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[2fr_1fr_1.5fr_2fr_auto]"
      >
        <Select
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
          required
        >
          <option value="">Pilih bahan…</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>

        <input
          type="number"
          step="0.001"
          min="0.001"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          required
          placeholder={bahanTerpilih?.baseUnit.toLowerCase() ?? "jumlah"}
          className="rounded-xl border border-border bg-paper px-3 py-2.5 text-sm"
        />

        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {ALASAN.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="rounded-xl border border-border bg-paper px-3 py-2.5 text-sm"
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "…" : "Catat"}
        </button>

        {error && <p className="text-sm text-danger sm:col-span-5">{error}</p>}
      </form>

      <div className="mb-3">
        <SearchBox
          nilai={tabel.kata}
          onChange={tabel.setKata}
          placeholder="Cari bahan, alasan, atau pencatat…"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">Bahan</th>
              <th className="px-4 py-3 text-right font-medium">Jumlah</th>
              <th className="px-4 py-3 font-medium">Alasan</th>
              {pemilik && (
                <th className="px-4 py-3 text-right font-medium">Nilai</th>
              )}
              <th className="px-4 py-3 font-medium">Oleh</th>
            </tr>
          </thead>
          <tbody>
            {riwayat.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Memuat catatan…
                </td>
              </tr>
            )}

            {!riwayat.isLoading && tabel.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {logs.length === 0
                    ? "Belum ada catatan waste."
                    : "Tidak ada catatan yang cocok."}
                </td>
              </tr>
            )}

            {tabel.items.map((log) => (
              <tr key={log.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatWaktu(log.createdAt)}
                </td>
                <td className="px-4 py-3">{log.ingredient}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {log.qty} {log.baseUnit.toLowerCase()}
                </td>
                <td className="px-4 py-3">
                  {LABEL_ALASAN[log.reason] ?? log.reason}
                  {log.note && <span className="text-muted"> · {log.note}</span>}
                </td>
                {pemilik && (
                  <td className="px-4 py-3 text-right text-danger tabular-nums">
                    {formatRupiah(log.value)}
                  </td>
                )}
                <td className="px-4 py-3 text-muted">{log.by}</td>
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
        satuan="catatan"
        onGanti={tabel.setHalaman}
      />
    </div>
  );
}
