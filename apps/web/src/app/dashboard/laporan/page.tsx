"use client";

import { formatRupiah } from "@/lib/client-api";
import { useApi } from "@/lib/use-api";

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

export default function LaporanPage() {
  const penjualan = useApi<Sales>("/api/reports/sales");
  const pembuangan = useApi<Waste>("/api/reports/waste");
  const persediaan = useApi<Inventory>("/api/reports/inventory");
  const marginMenu = useApi<Margin[]>("/api/reports/margins");

  const sales = penjualan.data;
  const waste = pembuangan.data;
  const inventory = persediaan.data;
  const margins = marginMenu.data ?? [];

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Laporan</h1>
        <p className="mt-1 text-sm text-muted">
          Semua angka dihitung dari ledger, bukan dari catatan terpisah.
        </p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel judul="Menu paling laku">
          {sales?.topMenus.length ? (
            <ul className="space-y-2 text-sm">
              {sales.topMenus.map((m) => (
                <li key={m.menuId} className="flex justify-between gap-3">
                  <span>
                    {m.name}
                    <span className="text-muted"> · {m.qty} porsi</span>
                  </span>
                  <span className="tabular-nums">{formatRupiah(m.revenue)}</span>
                </li>
              ))}
            </ul>
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
            <ul className="space-y-2 text-sm">
              {waste.byReason.map((r) => (
                <li key={r.reason} className="flex justify-between gap-3">
                  <span>{LABEL_ALASAN[r.reason] ?? r.reason}</span>
                  <span className="text-danger tabular-nums">
                    {formatRupiah(r.value)}
                  </span>
                </li>
              ))}
            </ul>
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
