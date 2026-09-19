"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SortHeader } from "@/components/ui/sort-header";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { PageHead, SearchBox, TablePager } from "@/components/ui/toolbar";
import { ApiError, formatRupiah, request } from "@/lib/client-api";
import { useTable } from "@/lib/use-table";
import { useApi } from "@/lib/use-api";

type MenuRow = {
  id: string;
  name: string;
  category: string;
  price: string;
  isActive: boolean;
  remainingPortions: number;
  cost: string;
  profit: string;
  marginPercent: string;
  recipes: { ingredientId: string; name: string; baseUnit: string; qty: string }[];
};

/** Di bawah angka ini margin dianggap perlu ditengok lagi. */
const MARGIN_TIPIS = 50;

export default function MenuPage() {
  const { data, error, isLoading, mutate } = useApi<MenuRow[]>("/api/admin/menus");
  const [aksiError, setAksiError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const menus = data ?? [];
  const tabel = useTable(menus, {
    cari: (m) => [m.name, m.category],
    perHalaman: 10,
    kolom: {
      nama: (m) => m.name,
      kategori: (m) => m.category,
      harga: (m) => Number(m.price),
      hpp: (m) => Number(m.cost),
      margin: (m) => Number(m.marginPercent),
      sisa: (m) => m.remainingPortions,
    },
    urutanAwal: { kolom: "nama", arah: "naik" },
  });

  const aktif = menus.filter((m) => m.isActive);
  const habis = aktif.filter((m) => m.remainingPortions === 0);
  const tipis = menus.filter((m) => Number(m.marginPercent) < MARGIN_TIPIS);
  const marginRata =
    menus.length > 0
      ? menus.reduce((s, m) => s + Number(m.marginPercent), 0) / menus.length
      : 0;

  const dibuka = menus.find((m) => m.id === openId);

  async function ubahAktif(menu: MenuRow) {
    setSibuk(menu.id);
    setAksiError(null);

    try {
      await request(`/api/admin/menus/${menu.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !menu.isActive }),
      });
      await mutate();
    } catch (e) {
      setAksiError(e instanceof ApiError ? e.message : "Gagal mengubah menu");
    } finally {
      setSibuk(null);
    }
  }

  return (
    <div>
      <PageHead
        judul="Menu & resep"
        deskripsi="HPP dihitung dari harga rata-rata bahan terkini, jadi ikut berubah saat harga supplier naik."
      />

      <StatRow>
        <StatCard
          label="Menu aktif"
          nilai={isLoading ? "…" : String(aktif.length)}
          catatan={`dari ${menus.length} menu terdaftar`}
        />
        <StatCard
          label="Sedang habis"
          nilai={isLoading ? "…" : String(habis.length)}
          catatan="bahannya tidak cukup"
          nada={habis.length > 0 ? "sorot" : "netral"}
        />
        <StatCard
          label="Margin rata-rata"
          nilai={isLoading ? "…" : `${marginRata.toFixed(1)}%`}
        />
        <StatCard
          label={`Margin di bawah ${MARGIN_TIPIS}%`}
          nilai={isLoading ? "…" : String(tipis.length)}
          catatan={tipis[0] ? `paling tipis: ${tipis[0].name}` : undefined}
          nada={tipis.length > 0 ? "sorot" : "netral"}
        />
      </StatRow>

      {(error || aksiError) && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm text-danger">
          {aksiError ?? error?.message}
        </p>
      )}

      <div className="mb-3">
        <SearchBox
          nilai={tabel.kata}
          onChange={tabel.setKata}
          placeholder="Cari menu atau kategori…"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <SortHeader
                label="Menu"
                kolom="nama"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Kategori"
                kolom="kategori"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Harga"
                kolom="harga"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="HPP"
                kolom="hpp"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Margin"
                kolom="margin"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Sisa porsi"
                kolom="sisa"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Memuat daftar menu…
                </td>
              </tr>
            )}

            {!isLoading && tabel.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Tidak ada menu yang cocok.
                </td>
              </tr>
            )}

            {tabel.items.map((menu) => (
              <tr key={menu.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{menu.name}</span>
                  {!menu.isActive && (
                    <span className="ml-2 rounded bg-sunk px-1.5 py-0.5 text-xs text-muted">
                      nonaktif
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{menu.category}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatRupiah(menu.price)}
                </td>
                <td className="px-4 py-3 text-right text-muted tabular-nums">
                  {formatRupiah(menu.cost)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    Number(menu.marginPercent) < MARGIN_TIPIS ? "text-warning" : ""
                  }`}
                >
                  {menu.marginPercent}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {menu.remainingPortions === 0 ? (
                    <span className="text-danger">habis</span>
                  ) : (
                    menu.remainingPortions
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setOpenId(menu.id)}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs whitespace-nowrap hover:border-accent"
                  >
                    Lihat resep
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
        satuan="menu"
        onGanti={tabel.setHalaman}
      />

      {dibuka && (
        <Modal
          judul={dibuka.name}
          deskripsi={`${dibuka.category} · takaran untuk satu porsi`}
          onClose={() => setOpenId(null)}
        >
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Harga jual</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {formatRupiah(dibuka.price)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">HPP</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {formatRupiah(dibuka.cost)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Untung per porsi</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {formatRupiah(dibuka.profit)}
              </p>
            </div>
          </div>

          <h3 className="text-sm font-medium">Bahan</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {dibuka.recipes.map((r) => (
              <li
                key={r.ingredientId}
                className="flex justify-between border-b border-border py-1.5 last:border-0"
              >
                <span>{r.name}</span>
                <span className="text-muted tabular-nums">
                  {r.qty} {r.baseUnit.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted">
              Bisa dibuat {dibuka.remainingPortions} porsi dengan stok sekarang
            </p>
            <button
              type="button"
              onClick={() => void ubahAktif(dibuka)}
              disabled={sibuk === dibuka.id}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {dibuka.isActive ? "Nonaktifkan menu" : "Aktifkan menu"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
