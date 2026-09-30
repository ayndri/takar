import { SkeletonArea, Skeleton } from "@/components/ui/skeleton";

/**
 * Rangka luar untuk seluruh halaman toko.
 *
 * Sengaja netral, tidak menyerupai halaman mana pun secara khusus. Ini yang
 * tampil saat seseorang masuk langsung ke salah satu alamat toko — dari
 * tautan yang dibagikan atau hasil memindai QR.
 *
 * Bentuk yang lebih spesifik ada di loading.tsx masing-masing halaman, dan
 * itu yang dipakai saat berpindah halaman dari dalam aplikasi. Kalau rangka
 * ini dibuat menyerupai beranda, membuka /menu langsung dari tautan akan
 * menampilkan bentuk hero dulu lalu melompat jadi grid — persis lompatan
 * yang mau dihindari rangka.
 */
export default function TokoLoading() {
  return (
    <SkeletonArea label="Memuat halaman…">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-52 max-w-full" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </main>
    </SkeletonArea>
  );
}
