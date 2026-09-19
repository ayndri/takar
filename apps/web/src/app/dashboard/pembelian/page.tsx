"use client";

import { useState } from "react";
import { Select } from "@/components/select";
import {
  DaftarBukti,
  UnggahBukti,
  type Bukti as BuktiFile,
} from "@/components/ui/bukti";
import { Modal } from "@/components/ui/modal";
import { SortHeader } from "@/components/ui/sort-header";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { PageHead, SearchBox, TablePager } from "@/components/ui/toolbar";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { useTable } from "@/lib/use-table";
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
  buktiCount: number;
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

  const [formTerbuka, setFormTerbuka] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [rows, setRows] = useState<Baris[]>([{ ...BARIS_KOSONG }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bukti, setBukti] = useState<BuktiFile[]>([]);

  const ingredients = bahan.data ?? [];
  const purchases = nota.data ?? [];

  const tabel = useTable(purchases, {
    cari: (p) => [p.supplier, ...p.items.map((i) => i.ingredient.name)],
    perHalaman: 8,
    kolom: {
      tanggal: (p) => new Date(p.date),
      supplier: (p) => p.supplier,
      isi: (p) => p.items.length,
      total: (p) => Number(p.total),
      bukti: (p) => p.buktiCount,
    },
    urutanAwal: { kolom: "tanggal", arah: "turun" },
  });

  const totalBelanja = purchases.reduce((s, p) => s + Number(p.total), 0);

  const perSupplier = new Map<string, number>();
  for (const p of purchases) {
    perSupplier.set(
      p.supplier,
      (perSupplier.get(p.supplier) ?? 0) + Number(p.total),
    );
  }
  const supplierTeratas = [...perSupplier].sort((a, b) => b[1] - a[1])[0];
  const terakhir = purchases[0];
  const dibuka = purchases.find((p) => p.id === openId);

  function ubahBaris(index: number, patch: Partial<Baris>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();

    if (bukti.length === 0) {
      setError("Unggah foto notanya dulu sebelum menyimpan");
      return;
    }

    setSaving(true);
    setError(null);
    setOk(null);

    try {
      await request("/api/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplier,
          attachmentIds: bukti.map((b) => b.id),
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
      setBukti([]);
      setFormTerbuka(false);
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
      <PageHead
        judul="Pembelian"
        deskripsi="Barang masuk dari supplier. Harga rata-rata tiap bahan ikut dihitung ulang otomatis."
        aksi={
          <button
            type="button"
            onClick={() => setFormTerbuka(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-ink"
          >
            Catat nota baru
          </button>
        }
      />

      <StatRow>
        <StatCard
          label="Jumlah nota"
          nilai={nota.isLoading ? "…" : String(purchases.length)}
        />
        <StatCard
          label="Total belanja"
          nilai={nota.isLoading ? "…" : formatRupiah(totalBelanja)}
        />
        {supplierTeratas && (
          <StatCard
            label="Supplier terbesar"
            nilai={supplierTeratas[0]}
            catatan={formatRupiah(supplierTeratas[1])}
          />
        )}
        {terakhir && (
          <StatCard
            label="Belanja terakhir"
            nilai={formatRupiah(terakhir.total)}
            catatan={formatWaktu(terakhir.date)}
          />
        )}
      </StatRow>

      {ok && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm text-accent-ink">
          {ok}
        </p>
      )}

      <div className="mb-3">
        <SearchBox
          nilai={tabel.kata}
          onChange={tabel.setKata}
          placeholder="Cari supplier atau bahan…"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <SortHeader
                label="Tanggal"
                kolom="tanggal"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Supplier"
                kolom="supplier"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Isi"
                kolom="isi"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Total"
                kolom="total"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Bukti"
                kolom="bukti"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {nota.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Memuat nota…
                </td>
              </tr>
            )}

            {!nota.isLoading && tabel.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {purchases.length === 0
                    ? "Belum ada nota pembelian."
                    : "Tidak ada nota yang cocok."}
                </td>
              </tr>
            )}

            {tabel.items.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatWaktu(p.date)}
                </td>
                <td className="px-4 py-3 font-medium">{p.supplier}</td>
                <td className="px-4 py-3 text-muted">
                  {p.items.length} bahan
                  <span className="hidden sm:inline">
                    {" "}
                    ·{" "}
                    {p.items
                      .slice(0, 2)
                      .map((i) => i.ingredient.name)
                      .join(", ")}
                    {p.items.length > 2 ? ", …" : ""}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatRupiah(p.total)}
                </td>
                <td className="px-4 py-3">
                  {p.buktiCount > 0 ? (
                    <span className="text-muted">
                      {p.buktiCount} berkas
                    </span>
                  ) : (
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-warning">
                      belum ada
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setOpenId(p.id)}
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
        halaman={tabel.halaman}
        halamanTotal={tabel.halamanTotal}
        awal={tabel.awal}
        akhir={tabel.akhir}
        total={tabel.total}
        satuan="nota"
        onGanti={tabel.setHalaman}
      />

      {dibuka && (
        <Modal
          judul={dibuka.supplier}
          deskripsi={formatWaktu(dibuka.date)}
          lebar="lg"
          onClose={() => setOpenId(null)}
        >
          <RincianNota nota={dibuka} />

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-medium">Bukti nota</h3>
            <DaftarBukti refType="purchase" refId={dibuka.id} />
          </div>
        </Modal>
      )}

      {formTerbuka && (
        <Modal
          judul="Catat nota pembelian"
          deskripsi="Stok bertambah dan harga rata-rata dihitung ulang begitu disimpan."
          lebar="lg"
          onClose={() => setFormTerbuka(false)}
        >
          <form onSubmit={simpan}>
            <label className="block text-sm">
              <span className="text-muted">Supplier</span>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                required
                placeholder="Contoh: Toko Bahan Jaya"
                className="mt-1 w-full max-w-sm rounded-xl border border-border bg-paper px-3 py-2.5"
              />
            </label>

            <div className="mt-4 space-y-3">
              {rows.map((row, index) => {
                const dipilih = ingredients.find(
                  (i) => i.id === row.ingredientId,
                );

                return (
                  <div
                    key={index}
                    className="grid gap-2 sm:grid-cols-[2fr_1.2fr_1fr_1fr_auto]"
                  >
                    <Select
                      value={row.ingredientId}
                      onChange={(e) =>
                        ubahBaris(index, {
                          ingredientId: e.target.value,
                          purchaseUnitId: "",
                        })
                      }
                    >
                      <option value="">Pilih bahan…</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={row.purchaseUnitId}
                      onChange={(e) =>
                        ubahBaris(index, { purchaseUnitId: e.target.value })
                      }
                      disabled={!dipilih}
                    >
                      <option value="">
                        {dipilih ? dipilih.baseUnit.toLowerCase() : "satuan"}
                      </option>
                      {dipilih?.purchaseUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.factor})
                        </option>
                      ))}
                    </Select>

                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.qty}
                      onChange={(e) => ubahBaris(index, { qty: e.target.value })}
                      placeholder="Jumlah"
                      className="rounded-xl border border-border bg-paper px-3 py-2.5 text-sm"
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
                      className="rounded-xl border border-border bg-paper px-3 py-2.5 text-sm"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) => prev.filter((_, i) => i !== index))
                      }
                      disabled={rows.length === 1}
                      className="rounded-lg px-2 text-sm text-muted disabled:opacity-30"
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

            <div className="mt-5 border-t border-border pt-4">
              <UnggahBukti
                bukti={bukti}
                wajib
                keterangan="Foto nota dari supplier. Tanpa ini, angka belanja di sini tidak bisa dicocokkan dengan apa pun."
                onTambah={(b) => setBukti((prev) => [...prev, b])}
                onHapus={(id) =>
                  setBukti((prev) => prev.filter((b) => b.id !== id))
                }
              />
            </div>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setFormTerbuka(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || bukti.length === 0}
                title={
                  bukti.length === 0 ? "Unggah foto nota dulu" : undefined
                }
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Menyimpan…" : "Simpan nota"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/**
 * Isi pop-up rincian nota.
 *
 * Punya pengurutan sendiri: nota belanja awal berisi puluhan bahan, dan yang
 * dicari biasanya "mana yang paling mahal", bukan urutan ketiknya.
 */
function RincianNota({ nota }: { nota: Purchase }) {
  const tabel = useTable(nota.items, {
    cari: (i) => [i.ingredient.name],
    perHalaman: 10,
    kolom: {
      bahan: (i) => i.ingredient.name,
      dibeli: (i) => Number(i.qty),
      masuk: (i) => Number(i.baseQty),
      harga: (i) => Number(i.unitPrice),
    },
    urutanAwal: { kolom: "harga", arah: "turun" },
  });

  return (
    <>
      {nota.items.length > 10 && (
        <div className="mb-3">
          <SearchBox
            nilai={tabel.kata}
            onChange={tabel.setKata}
            placeholder="Cari bahan di nota ini…"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <SortHeader
                label="Bahan"
                kolom="bahan"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Dibeli"
                kolom="dibeli"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Masuk gudang"
                kolom="masuk"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Harga"
                kolom="harga"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
            </tr>
          </thead>
          <tbody>
            {tabel.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{item.ingredient.name}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {item.qty}{" "}
                  {item.purchaseUnit?.name ??
                    item.ingredient.baseUnit.toLowerCase()}
                </td>
                <td className="px-4 py-2 text-right text-muted tabular-nums">
                  {item.baseQty} {item.ingredient.baseUnit.toLowerCase()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatRupiah(item.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nota.items.length > 10 && (
        <TablePager
          halaman={tabel.halaman}
          halamanTotal={tabel.halamanTotal}
          awal={tabel.awal}
          akhir={tabel.akhir}
          total={tabel.total}
          satuan="bahan"
          onGanti={tabel.setHalaman}
        />
      )}

      <p className="mt-4 flex justify-between border-t border-border pt-3 font-medium">
        <span>Total nota</span>
        <span className="tabular-nums">{formatRupiah(nota.total)}</span>
      </p>

      <p className="mt-3 text-sm text-muted">
        Kolom &ldquo;masuk gudang&rdquo; adalah hasil konversi ke satuan dasar.
        Satu karton susu dicatat sebagai 12.000 ml, karena itu yang dipakai
        resep.
      </p>
    </>
  );
}
