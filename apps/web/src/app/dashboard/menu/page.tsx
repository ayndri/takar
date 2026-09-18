"use client";

import { useState } from "react";
import { ApiError, formatRupiah, request } from "@/lib/client-api";
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

export default function MenuPage() {
  const { data, error, mutate } = useApi<MenuRow[]>("/api/admin/menus");
  const [aksiError, setAksiError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const menus = data ?? [];

  async function ubahAktif(menu: MenuRow) {
    setAksiError(null);

    try {
      await request(`/api/admin/menus/${menu.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !menu.isActive }),
      });
      await mutate();
    } catch (e) {
      setAksiError(e instanceof ApiError ? e.message : "Gagal mengubah menu");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Menu & resep</h1>
        <p className="mt-1 text-sm text-muted">
          HPP dihitung dari harga rata-rata bahan terkini. Urutkan perhatianmu
          ke margin yang paling tipis.
        </p>
      </div>

      {(error || aksiError) && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm text-danger">
          {aksiError ?? error?.message}
        </p>
      )}

      <ul className="space-y-3">
        {menus.map((menu) => (
          <li
            key={menu.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{menu.name}</h2>
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-muted">
                    {menu.category}
                  </span>
                  {!menu.isActive && (
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-danger">
                      nonaktif
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  Bisa dibuat {menu.remainingPortions} porsi dengan stok sekarang
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <p className="font-medium">{formatRupiah(menu.price)}</p>
                  <p className="text-muted">
                    HPP {formatRupiah(menu.cost)} · margin{" "}
                    <span
                      className={
                        Number(menu.marginPercent) < 50 ? "text-warning" : ""
                      }
                    >
                      {menu.marginPercent}%
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setOpenId(openId === menu.id ? null : menu.id)
                  }
                  className="rounded-lg border border-border px-2.5 py-1 text-xs"
                >
                  {openId === menu.id ? "Tutup" : "Resep"}
                </button>

                <button
                  type="button"
                  onClick={() => void ubahAktif(menu)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs"
                >
                  {menu.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>

            {openId === menu.id && (
              <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                {menu.recipes.map((r) => (
                  <li key={r.ingredientId} className="flex justify-between">
                    <span>{r.name}</span>
                    <span className="text-muted tabular-nums">
                      {r.qty} {r.baseUnit.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
