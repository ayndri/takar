"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SortHeader } from "@/components/ui/sort-header";
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

type Movement = {
  id: string;
  createdAt: string;
  type: string;
  qty: string;
  balance: string;
  note: string | null;
};

type StockCard = {
  ingredient: { name: string; baseUnit: string };
  currentQty: string;
  ledgerQty: string;
  movements: Movement[];
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

  const card = useApi<StockCard>(
    openId ? `/api/ingredients/${openId}/card` : null,
  );

  const items = data ?? [];
  const tabel = useTable(items, {
    cari: (i) => [i.name, i.baseUnit],
    perHalaman: 10,
    kolom: {
      nama: (i) => i.name,
      stok: (i) => Number(i.qty),
      minimum: (i) => Number(i.minStock),
      harga: (i) => Number(i.avgCost),
      nilai: (i) => Number(i.value),
    },
    urutanAwal: { kolom: "nama", arah: "naik" },
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
          <thead className="border-b border-border text-muted">
            <tr>
              <SortHeader
                label="Bahan"
                kolom="nama"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Stok"
                kolom="stok"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Minimum"
                kolom="minimum"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              {pemilik && (
                <SortHeader
                  label="Harga rata-rata"
                  kolom="harga"
                  urutan={tabel.urutan}
                  onUrutkan={tabel.urutkan}
                  rata="kanan"
                />
              )}
              {pemilik && (
                <SortHeader
                  label="Nilai"
                  kolom="nilai"
                  urutan={tabel.urutan}
                  onUrutkan={tabel.urutkan}
                  rata="kanan"
                />
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
                  Tidak ada bahan yang cocok.
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
            <RiwayatStok data={card.data} />
          )}
        </Modal>
      )}
    </div>
  );
}

/**
 * Isi pop-up riwayat.
 *
 * Dipisah jadi komponen sendiri karena punya pencarian, pengurutan, dan
 * halamannya sendiri: satu bahan bisa punya ratusan pergerakan, dan menggulir
 * sejauh itu di dalam jendela kecil tidak terpakai.
 */
function RiwayatStok({ data }: { data: StockCard }) {
  const tabel = useTable(data.movements, {
    cari: (m) => [JENIS[m.type] ?? m.type, m.note],
    perHalaman: 8,
    kolom: {
      waktu: (m) => new Date(m.createdAt),
      kejadian: (m) => JENIS[m.type] ?? m.type,
      jumlah: (m) => Number(m.qty),
      saldo: (m) => Number(m.balance),
    },
    urutanAwal: { kolom: "waktu", arah: "turun" },
  });

  const cocok = data.currentQty === data.ledgerQty;

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted">Stok sekarang</p>
          <p className="mt-0.5 font-semibold tabular-nums">
            {data.currentQty} {data.ingredient.baseUnit.toLowerCase()}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted">Hasil penjumlahan riwayat</p>
          <p
            className={`mt-0.5 font-semibold tabular-nums ${
              cocok ? "" : "text-danger"
            }`}
          >
            {data.ledgerQty}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted">Jumlah kejadian</p>
          <p className="mt-0.5 font-semibold tabular-nums">
            {data.movements.length}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <SearchBox
          nilai={tabel.kata}
          onChange={tabel.setKata}
          placeholder="Cari kejadian atau catatan…"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <SortHeader
                label="Waktu"
                kolom="waktu"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Kejadian"
                kolom="kejadian"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Jumlah"
                kolom="jumlah"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Saldo"
                kolom="saldo"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
            </tr>
          </thead>
          <tbody>
            {tabel.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  Tidak ada kejadian yang cocok.
                </td>
              </tr>
            )}

            {tabel.items.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 whitespace-nowrap text-muted">
                  {formatWaktu(m.createdAt)}
                </td>
                <td className="px-4 py-2">
                  {JENIS[m.type] ?? m.type}
                  {m.note && <span className="text-muted"> · {m.note}</span>}
                </td>
                <td
                  className={`px-4 py-2 text-right tabular-nums ${
                    Number(m.qty) < 0 ? "text-danger" : ""
                  }`}
                >
                  {Number(m.qty) > 0 ? "+" : ""}
                  {m.qty}
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {m.balance}
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
        satuan="kejadian"
        onGanti={tabel.setHalaman}
      />

      {tabel.urutan?.kolom !== "waktu" && (
        <p className="mt-2 text-xs text-muted">
          Kolom saldo dihitung berurutan dari kejadian paling lama, jadi angkanya
          paling mudah dibaca saat tabel diurutkan berdasarkan waktu.
        </p>
      )}
    </>
  );
}
