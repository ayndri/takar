"use client";

/**
 * Pemuat Snap, popup pembayaran milik Midtrans.
 *
 * Skripnya dimuat saat dibutuhkan, bukan di layout. Sebagian besar orang yang
 * membuka halaman menu tidak akan membayar online, dan tidak ada gunanya
 * semua orang mengunduh skrip pihak ketiga untuk sesuatu yang mungkin tidak
 * dipakai.
 *
 * Nomor kartu tidak pernah melewati aplikasi ini — seluruh pengisiannya
 * terjadi di dalam popup milik Midtrans.
 */

type SnapHasil = { order_id?: string; transaction_status?: string };

type Snap = {
  pay: (
    token: string,
    opsi: {
      onSuccess?: (hasil: SnapHasil) => void;
      onPending?: (hasil: SnapHasil) => void;
      onError?: (hasil: SnapHasil) => void;
      onClose?: () => void;
    },
  ) => void;
};

declare global {
  interface Window {
    snap?: Snap;
  }
}

const ID_SKRIP = "midtrans-snap";

const alamatSkrip = (produksi: boolean) =>
  produksi
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";

/**
 * Pemuatan yang sedang berjalan, ditahan di tingkat modul.
 *
 * Tanpa ini, dua pemanggilan beruntun sama-sama menunggu peristiwa `load`
 * pada tag yang sama — dan yang kedua menunggu selamanya, karena peristiwa
 * itu sudah lewat dan tidak akan terulang. Gejalanya tombol yang berputar
 * tanpa akhir, dan itu jenis kerusakan yang paling sulit ditebak sebabnya.
 */
let sedangMemuat: Promise<Snap> | null = null;

export function muatSnap(clientKey: string, produksi: boolean): Promise<Snap> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Snap hanya bisa dimuat di browser"));
  }

  if (window.snap) return Promise.resolve(window.snap);
  if (sedangMemuat) return sedangMemuat;

  sedangMemuat = new Promise<Snap>((selesai, gagal) => {
    const lepas = () => {
      // Dilepas supaya percobaan berikutnya memulai dari awal, bukan
      // menunggu janji yang sudah gagal.
      sedangMemuat = null;
    };

    const siap = () => {
      if (window.snap) selesai(window.snap);
      else {
        lepas();
        gagal(new Error("Snap termuat tapi tidak bisa dipakai"));
      }
    };

    const rusak = () => {
      lepas();
      gagal(new Error("Gagal memuat Midtrans Snap"));
    };

    const adaSudah = document.getElementById(ID_SKRIP);

    if (adaSudah) {
      // Tag-nya ada tapi window.snap belum terisi: bisa jadi masih memuat,
      // bisa jadi sudah selesai sebelum modul ini sempat mendengarkan.
      // Menunggu peristiwa saja tidak cukup, jadi keadaannya juga diperiksa
      // berkala dengan batas waktu yang jelas.
      adaSudah.addEventListener("load", siap, { once: true });
      adaSudah.addEventListener("error", rusak, { once: true });

      const mulai = Date.now();
      const periksa = setInterval(() => {
        if (window.snap) {
          clearInterval(periksa);
          selesai(window.snap);
        } else if (Date.now() - mulai > 15_000) {
          clearInterval(periksa);
          rusak();
        }
      }, 150);

      return;
    }

    const skrip = document.createElement("script");
    skrip.id = ID_SKRIP;
    skrip.src = alamatSkrip(produksi);
    skrip.setAttribute("data-client-key", clientKey);
    skrip.async = true;
    skrip.addEventListener("load", siap, { once: true });
    skrip.addEventListener("error", rusak, { once: true });

    document.body.appendChild(skrip);
  });

  return sedangMemuat;
}
