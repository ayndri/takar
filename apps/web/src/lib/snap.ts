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
 * Pastikan Snap sudah termuat, lalu kembalikan objeknya.
 *
 * Dipanggil berkali-kali aman: kalau skripnya sudah ada di halaman, yang
 * kedua menunggu yang pertama selesai alih-alih menambah tag baru.
 */
export function muatSnap(clientKey: string, produksi: boolean): Promise<Snap> {
  return new Promise((selesai, gagal) => {
    if (window.snap) return selesai(window.snap);

    const adaSudah = document.getElementById(ID_SKRIP);

    const siap = () => {
      if (window.snap) selesai(window.snap);
      else gagal(new Error("Snap termuat tapi tidak bisa dipakai"));
    };

    if (adaSudah) {
      adaSudah.addEventListener("load", siap, { once: true });
      adaSudah.addEventListener(
        "error",
        () => gagal(new Error("Gagal memuat Midtrans Snap")),
        { once: true },
      );
      return;
    }

    const skrip = document.createElement("script");
    skrip.id = ID_SKRIP;
    skrip.src = alamatSkrip(produksi);
    skrip.setAttribute("data-client-key", clientKey);
    skrip.async = true;
    skrip.addEventListener("load", siap, { once: true });
    skrip.addEventListener(
      "error",
      () => gagal(new Error("Gagal memuat Midtrans Snap")),
      { once: true },
    );

    document.body.appendChild(skrip);
  });
}
