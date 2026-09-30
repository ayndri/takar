"use client";

import { useEffect, useState } from "react";
import { MenuCard } from "@/components/menu-card";
import { Pagination } from "@/components/pagination";
import { SkeletonKartuMenu } from "@/components/ui/skeleton";
import type { Paginated, PublicMenu } from "@/lib/api";
import { useApi } from "@/lib/use-api";

const PER_HALAMAN = 12;

/** Jeda sebelum mencari. Cukup untuk selesai mengetik satu kata. */
const JEDA_KETIK = 300;

function buatKunci(q: string, kategori: string, hal: number) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (kategori) p.set("category", kategori);
  if (hal > 1) p.set("page", String(hal));
  p.set("pageSize", String(PER_HALAMAN));

  return `/api/menus?${p.toString()}`;
}

function buatAlamat(q: string, kategori: string, hal: number) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (kategori) p.set("kategori", kategori);
  if (hal > 1) p.set("hal", String(hal));

  const s = p.toString();
  return s ? `/menu?${s}` : "/menu";
}

/**
 * Katalog yang mencari tanpa memuat ulang halaman.
 *
 * Muatan pertamanya tetap datang dari server — itu yang membuat tautan
 * `/menu?q=kopi` yang dibagikan tetap langsung berisi, dan halaman ini tidak
 * dimulai dari layar kosong. Yang dikerjakan di sini pencarian berikutnya.
 *
 * Alamatnya tetap ikut berubah lewat `history.replaceState`, jadi hasil
 * pencarian masih bisa disalin dan dibagikan. Dipakai `replaceState`, bukan
 * `pushState`: kalau tiap ketikan menambah satu langkah riwayat, tombol
 * kembali harus ditekan belasan kali untuk keluar dari halaman ini.
 */
export function KatalogMenu({
  awal,
  qAwal,
  kategoriAwal,
  halAwal,
  kategoriTersedia,
  jumlahPerKategori,
}: {
  awal: Paginated<PublicMenu> | null;
  qAwal: string;
  kategoriAwal: string;
  halAwal: number;
  kategoriTersedia: string[];
  jumlahPerKategori: Record<string, number>;
}) {
  const [q, setQ] = useState(qAwal);
  const [qCari, setQCari] = useState(qAwal);
  const [kategori, setKategori] = useState(kategoriAwal);
  const [hal, setHal] = useState(halAwal);

  // Menunggu ketikan berhenti dulu. Tanpa ini, mengetik "cappuccino"
  // mengirim sepuluh permintaan dan yang ditampilkan belum tentu yang
  // terakhir selesai.
  useEffect(() => {
    const jeda = setTimeout(() => {
      setQCari(q.trim());
      setHal(1);
    }, JEDA_KETIK);

    return () => clearTimeout(jeda);
  }, [q]);

  const kunciAwal = buatKunci(qAwal, kategoriAwal, halAwal);
  const kunci = buatKunci(qCari, kategori, hal);

  const { data, isValidating, error } = useApi<Paginated<PublicMenu>>(kunci, {
    // Data dari server dipakai apa adanya untuk keadaan awal, jadi tidak ada
    // kedipan kosong saat halaman baru dibuka.
    ...(kunci === kunciAwal && awal ? { fallbackData: awal } : {}),
    // Hasil lama ditahan selama yang baru diambil. Grid yang mengosong lalu
    // terisi lagi tiap ketikan jauh lebih mengganggu daripada hasil yang
    // telat sepersekian detik.
    keepPreviousData: true,
  });

  useEffect(() => {
    const alamat = buatAlamat(qCari, kategori, hal);
    if (window.location.pathname + window.location.search !== alamat) {
      window.history.replaceState(null, "", alamat);
    }
  }, [qCari, kategori, hal]);

  const hasil = data ?? awal;
  const memuat = !hasil && !error;

  const awalNomor = hasil ? (hasil.page - 1) * hasil.pageSize + 1 : 0;
  const akhirNomor = hasil
    ? Math.min(hasil.page * hasil.pageSize, hasil.total)
    : 0;

  function gantiKategori(nilai: string) {
    setKategori(nilai);
    setHal(1);
  }

  const kelasChip = (aktif: boolean) =>
    `inline-block rounded-xl border px-3 py-1.5 text-sm ${
      aktif
        ? "border-ink bg-ink text-paper"
        : "border-border bg-surface text-muted hover:text-ink"
    }`;

  return (
    <>
      <div className="mt-6 flex max-w-md items-center gap-2" role="search">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama menu…"
          aria-label="Cari menu"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm"
        />
        {/* Tidak ada tombol Cari: hasilnya sudah berubah sambil mengetik,
            dan tombol yang tidak mengubah apa pun cuma membingungkan. */}
        <span
          aria-hidden="true"
          className={`text-sm text-muted transition-opacity ${
            isValidating ? "opacity-100" : "opacity-0"
          }`}
        >
          mencari…
        </span>
      </div>

      {kategoriTersedia.length > 0 && (
        <nav aria-label="Saring kategori" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            <li>
              <button
                type="button"
                onClick={() => gantiKategori("")}
                aria-current={kategori === "" ? "true" : undefined}
                className={kelasChip(kategori === "")}
              >
                Semua
              </button>
            </li>
            {kategoriTersedia.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => gantiKategori(k)}
                  aria-current={kategori === k ? "true" : undefined}
                  className={kelasChip(kategori === k)}
                >
                  {k}
                  <span className="ml-1.5 text-xs opacity-70">
                    {jumlahPerKategori[k]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Perubahan hasil diumumkan ke pembaca layar; tanpa ini, mengetik di
          kotak cari mengubah isi halaman tanpa ada yang memberitahu. */}
      <p role="status" aria-live="polite" className="mt-6 text-sm text-muted">
        {memuat
          ? "Memuat menu…"
          : hasil && hasil.total > 0
            ? `Menampilkan ${awalNomor}–${akhirNomor} dari ${hasil.total} menu`
            : ""}
      </p>

      {memuat ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonKartuMenu jumlah={6} />
        </div>
      ) : !hasil || hasil.items.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="font-display text-xl">Tidak ada yang cocok</p>
          <p className="mt-1 text-sm text-muted">
            {qCari
              ? `Tidak ada menu bernama "${qCari}".`
              : "Kategori ini belum punya menu."}
          </p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setQCari("");
              setKategori("");
              setHal(1);
            }}
            className="mt-4 inline-block rounded-xl border border-border px-4 py-2 text-sm hover:border-accent"
          >
            Tampilkan semua menu
          </button>
        </div>
      ) : (
        <>
          <div
            className={`mt-3 grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${
              isValidating ? "opacity-60" : ""
            }`}
          >
            {hasil.items.map((menu) => (
              <MenuCard key={menu.id} menu={menu} />
            ))}
          </div>

          <Pagination
            page={hasil.page}
            pages={hasil.pages}
            buatTautan={(n) => buatAlamat(qCari, kategori, n)}
            onPilih={(n) => {
              setHal(n);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}
    </>
  );
}
