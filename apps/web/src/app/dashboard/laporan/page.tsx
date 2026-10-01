"use client";

import { useState } from "react";
import { ApiError, formatRupiah, unduh } from "@/lib/client-api";
import { useApi } from "@/lib/use-api";
import { JagaModul } from "@/components/ui/fitur-mati";
import {
  GrafikBatang,
  GrafikOmzet,
  WARNA_GRAFIK,
  type TitikHarian,
} from "@/components/ui/grafik";

type Sales = {
  orderCount: number;
  revenue: string;
  cogs: string;
  grossProfit: string;
  marginPercent: string;
  topMenus: { menuId: string; name: string; qty: number; revenue: string }[];
};

type Waste = {
  total: string;
  count: number;
  byReason: { reason: string; value: string }[];
  topIngredients: {
    ingredientId: string;
    name: string;
    baseUnit: string;
    qty: string;
    value: string;
  }[];
};

type Inventory = {
  total: string;
  lowCount: number;
  items: { id: string; name: string; qty: string; baseUnit: string; value: string; isLow: boolean }[];
};

type Margin = {
  menuId: string;
  name: string;
  price: string;
  cost: string;
  profit: string;
  marginPercent: string;
};

const LABEL_ALASAN: Record<string, string> = {
  SPILLED: "Tumpah",
  EXPIRED: "Basi / kedaluwarsa",
  MISTAKE: "Salah bikin",
  OTHER: "Lainnya",
};

/**
 * Angka di balik grafiknya, disembunyikan di balik satu baris yang bisa
 * dibuka.
 *
 * Bukan sekadar pelengkap: grafik menyampaikan bentuk, bukan nilai, dan ada
 * orang yang membaca halaman ini dengan pembaca layar. Ditutup secara bawaan
 * supaya halamannya tidak jadi dua kali lebih panjang untuk yang tidak
 * membutuhkannya.
 */
function TabelAngka({
  judul,
  kepala,
  baris,
}: {
  judul: string;
  kepala: string[];
  baris: string[][];
}) {
  if (baris.length === 0) return null;

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-xs text-muted hover:text-ink">
        {judul}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              {kepala.map((k, i) => (
                <th
                  key={k}
                  scope="col"
                  className={`py-2 font-normal ${i === 0 ? "text-left" : "text-right"}`}
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.join("|")} className="border-b border-border last:border-0">
                {b.map((sel, i) => (
                  <td
                    key={i}
                    className={`py-1.5 ${i === 0 ? "" : "text-right tabular-nums"}`}
                  >
                    {sel}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function IsiLaporanPage() {
  const penjualan = useApi<Sales>("/api/reports/sales");
  const tren = useApi<TitikHarian[]>("/api/reports/sales-trend");
  const pembuangan = useApi<Waste>("/api/reports/waste");
  const persediaan = useApi<Inventory>("/api/reports/inventory");
  const marginMenu = useApi<Margin[]>("/api/reports/margins");

  const sales = penjualan.data;
  const waste = pembuangan.data;
  const inventory = persediaan.data;
  const margins = marginMenu.data ?? [];

  const [mengunduh, setMengunduh] = useState(false);
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);

  /**
   * Unduh seluruh laporan sebagai satu berkas Excel.
   *
   * Lewat fetch, bukan tautan biasa, karena endpoint-nya butuh token. Tautan
   * <a href> tidak membawa header Authorization.
   */
  async function unduhLaporan() {
    setMengunduh(true);
    setGalatUnduh(null);

    try {
      await unduh("/api/reports/export");
    } catch (e) {
      setGalatUnduh(
        e instanceof ApiError ? e.message : "Gagal menyiapkan berkas",
      );
    } finally {
      setMengunduh(false);
    }
  }
  const harian = tren.data ?? [];

  const error =
    penjualan.error ?? pembuangan.error ?? persediaan.error ?? marginMenu.error;

  if (error) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-danger">
        {error.message}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Laporan</h1>
          <p className="mt-1 text-sm text-muted">
            Semua angka dihitung dari ledger, bukan dari catatan terpisah.
          </p>
        </div>

        <div className="text-right">
          <button
            type="button"
            onClick={unduhLaporan}
            disabled={mengunduh}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:border-accent disabled:opacity-50"
          >
            {mengunduh ? "Menyiapkan…" : "Unduh Excel"}
          </button>
          {galatUnduh && (
            <p className="mt-1 text-xs text-danger">{galatUnduh}</p>
          )}
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kartu
          label="Omzet"
          nilai={sales ? formatRupiah(sales.revenue) : "…"}
          catatan={sales ? `${sales.orderCount} pesanan` : ""}
        />
        <Kartu
          label="Laba kotor"
          nilai={sales ? formatRupiah(sales.grossProfit) : "…"}
          catatan={sales ? `margin ${sales.marginPercent}%` : ""}
        />
        <Kartu
          label="Nilai persediaan"
          nilai={inventory ? formatRupiah(inventory.total) : "…"}
          catatan={inventory ? `${inventory.lowCount} bahan menipis` : ""}
        />
        <Kartu
          label="Terbuang"
          nilai={waste ? formatRupiah(waste.total) : "…"}
          catatan={waste ? `${waste.count} catatan` : ""}
          merah
        />
      </div>

      <div className="mb-6">
        <Panel judul="Omzet dan laba kotor per hari">
          {tren.isLoading ? (
            <p className="py-8 text-center text-sm text-muted">Memuat grafik…</p>
          ) : (
            <>
              <GrafikOmzet data={harian} />
              <TabelAngka
                judul={`Lihat ${harian.length} hari dalam angka`}
                kepala={["Tanggal", "Omzet", "Laba kotor", "Pesanan"]}
                baris={harian.map((d) => [
                  new Intl.DateTimeFormat("id-ID", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(d.date)),
                  formatRupiah(d.revenue),
                  formatRupiah(d.grossProfit),
                  String(d.orderCount),
                ])}
              />
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel judul="Menu paling laku">
          {sales?.topMenus.length ? (
            <>
              <GrafikBatang
                satuan="Porsi terjual"
                data={sales.topMenus.map((m) => ({
                  nama: m.name,
                  nilai: m.qty,
                  keterangan: formatRupiah(m.revenue),
                }))}
              />
              <TabelAngka
                judul="Lihat dalam angka"
                kepala={["Menu", "Porsi", "Omzet"]}
                baris={sales.topMenus.map((m) => [
                  m.name,
                  String(m.qty),
                  formatRupiah(m.revenue),
                ])}
              />
            </>
          ) : (
            <p className="text-sm text-muted">Belum ada penjualan.</p>
          )}
        </Panel>

        <Panel judul="Margin per menu, yang paling tipis di atas">
          <ul className="space-y-2 text-sm">
            {margins.map((m) => (
              <li key={m.menuId} className="flex justify-between gap-3">
                <span>
                  {m.name}
                  <span className="text-muted">
                    {" "}
                    · HPP {formatRupiah(m.cost)}
                  </span>
                </span>
                <span
                  className={`tabular-nums ${
                    Number(m.marginPercent) < 50 ? "text-warning" : ""
                  }`}
                >
                  {m.marginPercent}%
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel judul="Bocor ke mana">
          {waste?.byReason.length ? (
            <>
              {/* Teal, bukan merah. Merah sudah dipakai menandai keadaan yang
                  perlu ditindaklanjuti di seluruh aplikasi ini; memakainya
                  lagi sebagai warna seri membuat keduanya kehilangan arti. */}
              <GrafikBatang
                satuan="Nilai terbuang"
                warna={WARNA_GRAFIK.laba}
                format={(n) => formatRupiah(n)}
                data={waste.byReason.map((r) => ({
                  nama: LABEL_ALASAN[r.reason] ?? r.reason,
                  nilai: Number(r.value),
                }))}
              />
              <TabelAngka
                judul="Lihat dalam angka"
                kepala={["Alasan", "Nilai"]}
                baris={waste.byReason.map((r) => [
                  LABEL_ALASAN[r.reason] ?? r.reason,
                  formatRupiah(r.value),
                ])}
              />
            </>
          ) : (
            <p className="text-sm text-muted">
              Belum ada waste tercatat. Kalau selisih opname besar tapi ini
              kosong, berarti pembuangan belum dicatat.
            </p>
          )}
        </Panel>

        <Panel judul="Bahan paling boros">
          {waste?.topIngredients.length ? (
            <ul className="space-y-2 text-sm">
              {waste.topIngredients.map((i) => (
                <li key={i.ingredientId} className="flex justify-between gap-3">
                  <span>
                    {i.name}
                    <span className="text-muted">
                      {" "}
                      · {i.qty} {i.baseUnit.toLowerCase()}
                    </span>
                  </span>
                  <span className="text-danger tabular-nums">
                    {formatRupiah(i.value)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Belum ada data.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Kartu({
  label,
  nilai,
  catatan,
  merah,
}: {
  label: string;
  nilai: string;
  catatan?: string;
  merah?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          merah ? "text-danger" : ""
        }`}
      >
        {nilai}
      </p>
      {catatan && <p className="mt-0.5 text-xs text-muted">{catatan}</p>}
    </div>
  );
}

function Panel({
  judul,
  children,
}: {
  judul: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{judul}</h2>
      {children}
    </section>
  );
}

export default function LaporanPage() {
  return (
    <JagaModul kunci="modul.laporan">
      <IsiLaporanPage />
    </JagaModul>
  );
}
