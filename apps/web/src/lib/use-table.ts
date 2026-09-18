"use client";

import { useMemo, useState } from "react";

/**
 * Pencarian dan halaman untuk tabel dasbor.
 *
 * Dilakukan di browser, bukan di server, karena data yang dipakai staff
 * jumlahnya ratusan baris dan sudah terlanjur diambil untuk menghitung kartu
 * ringkasan di halaman yang sama. Katalog menu pelanggan tetap berhalaman di
 * server, karena di sana yang membuka bisa ribuan orang sekaligus.
 */
export function useTable<T>(
  items: T[],
  options: {
    /** Bagian mana dari tiap baris yang ikut dicari. */
    cari: (item: T) => (string | null | undefined)[];
    perHalaman?: number;
  },
) {
  const perHalaman = options.perHalaman ?? 10;
  const [kata, setKata] = useState("");
  const [halaman, setHalaman] = useState(1);

  const { cari } = options;

  const hasil = useMemo(() => {
    const k = kata.trim().toLowerCase();
    if (!k) return items;

    return items.filter((item) =>
      cari(item).some((bagian) => bagian?.toLowerCase().includes(k)),
    );
    // `cari` sengaja tidak masuk daftar: fungsinya dibuat ulang tiap render,
    // dan isinya hanya membaca properti baris.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, kata]);

  const halamanTotal = Math.max(1, Math.ceil(hasil.length / perHalaman));
  const halamanAktif = Math.min(halaman, halamanTotal);

  const potongan = useMemo(
    () =>
      hasil.slice((halamanAktif - 1) * perHalaman, halamanAktif * perHalaman),
    [hasil, halamanAktif, perHalaman],
  );

  return {
    kata,
    /** Mengubah kata pencarian selalu kembali ke halaman pertama. */
    setKata: (nilai: string) => {
      setKata(nilai);
      setHalaman(1);
    },
    halaman: halamanAktif,
    halamanTotal,
    setHalaman,
    items: potongan,
    total: hasil.length,
    totalSemua: items.length,
    awal: hasil.length === 0 ? 0 : (halamanAktif - 1) * perHalaman + 1,
    akhir: Math.min(halamanAktif * perHalaman, hasil.length),
  };
}
