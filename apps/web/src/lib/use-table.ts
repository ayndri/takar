"use client";

import { useMemo, useState } from "react";

export type Arah = "naik" | "turun";

/**
 * Pencarian, pengurutan, dan halaman untuk tabel dasbor.
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
    /**
     * Nilai yang dipakai saat sebuah kolom diurutkan. Angka dibandingkan
     * sebagai angka, teks sebagai teks, jadi "10 g" tidak mendarat sebelum
     * "2 g" seperti kalau semuanya diperlakukan sebagai teks.
     */
    kolom?: Record<string, (item: T) => string | number | Date | null>;
    urutanAwal?: { kolom: string; arah: Arah };
  },
) {
  const perHalaman = options.perHalaman ?? 10;
  const [kata, setKataAsli] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [urutan, setUrutan] = useState<{ kolom: string; arah: Arah } | null>(
    options.urutanAwal ?? null,
  );

  const { cari, kolom } = options;

  const tersaring = useMemo(() => {
    const k = kata.trim().toLowerCase();
    if (!k) return items;

    return items.filter((item) =>
      cari(item).some((bagian) => bagian?.toLowerCase().includes(k)),
    );
    // `cari` dan `kolom` dibuat ulang tiap render dan hanya membaca properti
    // baris, jadi sengaja tidak masuk daftar dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, kata]);

  const terurut = useMemo(() => {
    if (!urutan || !kolom?.[urutan.kolom]) return tersaring;

    const ambil = kolom[urutan.kolom]!;
    const pengali = urutan.arah === "naik" ? 1 : -1;

    return [...tersaring].sort((a, b) => {
      const va = ambil(a);
      const vb = ambil(b);

      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;

      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * pengali;
      }

      if (va instanceof Date && vb instanceof Date) {
        return (va.getTime() - vb.getTime()) * pengali;
      }

      return String(va).localeCompare(String(vb), "id") * pengali;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tersaring, urutan]);

  const halamanTotal = Math.max(1, Math.ceil(terurut.length / perHalaman));
  const halamanAktif = Math.min(halaman, halamanTotal);

  const potongan = useMemo(
    () =>
      terurut.slice(
        (halamanAktif - 1) * perHalaman,
        halamanAktif * perHalaman,
      ),
    [terurut, halamanAktif, perHalaman],
  );

  return {
    kata,
    /** Mengubah kata pencarian selalu kembali ke halaman pertama. */
    setKata: (nilai: string) => {
      setKataAsli(nilai);
      setHalaman(1);
    },

    urutan,
    /**
     * Klik pertama pada sebuah kolom mengurutkan naik, klik kedua membalik,
     * klik ketiga melepas pengurutan dan mengembalikan urutan aslinya.
     */
    urutkan: (namaKolom: string) => {
      setHalaman(1);
      setUrutan((lama) => {
        if (lama?.kolom !== namaKolom) return { kolom: namaKolom, arah: "naik" };
        if (lama.arah === "naik") return { kolom: namaKolom, arah: "turun" };
        return null;
      });
    },

    halaman: halamanAktif,
    halamanTotal,
    setHalaman,
    items: potongan,
    total: terurut.length,
    totalSemua: items.length,
    awal: terurut.length === 0 ? 0 : (halamanAktif - 1) * perHalaman + 1,
    akhir: Math.min(halamanAktif * perHalaman, terurut.length),
  };
}

export type TableState<T> = ReturnType<typeof useTable<T>>;
