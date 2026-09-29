"use client";

import Link from "next/link";
import { usePengaturan } from "@/lib/use-settings";
import { useSession } from "@/lib/session";

/**
 * Penjaga halaman dasbor untuk modul yang bisa dimatikan.
 *
 * Menyembunyikan tautannya di navigasi saja tidak cukup: alamat halamannya
 * masih bisa diketik langsung, dan yang muncul kalau tidak dijaga adalah
 * tabel kosong tanpa penjelasan — orang akan mengira datanya hilang.
 *
 * API-nya sendiri tetap menolak lewat requireFeature. Ini murni supaya
 * penolakan itu punya wajah.
 */
export function JagaModul({
  kunci,
  children,
}: {
  kunci: string;
  children: React.ReactNode;
}) {
  const { data, isLoading, nyala } = usePengaturan();
  const session = useSession();
  const pemilik = session?.user?.role === "OWNER";

  // Selama pengaturannya belum terbaca, jangan tampilkan apa pun — menampilkan
  // halaman lalu menariknya kembali sedetik kemudian lebih membingungkan
  // daripada menunggu sebentar.
  if (isLoading || !data) {
    return <p className="p-8 text-center text-muted">Memuat…</p>;
  }

  if (nyala(kunci)) return <>{children}</>;

  const label = data.items.find((i) => i.kunci === kunci)?.label ?? "Modul ini";

  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-8 text-center">
      <h1 className="text-lg font-semibold">{label} sedang dimatikan</h1>
      <p className="mt-2 text-sm text-muted">
        Datanya tidak dihapus dan kembali utuh begitu modulnya dinyalakan lagi.
      </p>

      {pemilik ? (
        <Link
          href="/dashboard/pengaturan"
          className="mt-5 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white"
        >
          Buka pengaturan
        </Link>
      ) : (
        <p className="mt-5 text-sm text-muted">
          Minta pemilik menyalakannya lewat halaman pengaturan.
        </p>
      )}
    </div>
  );
}
