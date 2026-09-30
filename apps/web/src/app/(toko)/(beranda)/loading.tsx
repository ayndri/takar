import {
  SkeletonArea,
  SkeletonKartuMenu,
  Skeleton,
} from "@/components/ui/skeleton";

/**
 * Rangka khusus beranda.
 *
 * Dipisah ke dalam route group `(beranda)` supaya bentuknya boleh menyerupai
 * beranda tanpa ikut tampil di halaman toko yang lain — group tidak mengubah
 * alamatnya, beranda tetap di `/`. Rangka netral untuk seluruh toko ada satu
 * tingkat di atas.
 *
 * Yang dirangka cuma bagian yang pasti ada: hero, deretan kategori, dan grid
 * menu. Banner pengumuman dan kartu promo tidak ikut karena belum tentu ada,
 * dan merangka sesuatu yang tidak muncul justru membuat halamannya melompat
 * saat isinya datang.
 */
export default function BerandaLoading() {
  return (
    <SkeletonArea label="Memuat beranda…">
      <main>
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface">
            <Skeleton className="aspect-21/9 rounded-none" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <Skeleton className="h-6 w-36" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="aspect-4/3 rounded-2xl" />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <Skeleton className="h-6 w-44" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonKartuMenu jumlah={3} />
          </div>
        </section>
      </main>
    </SkeletonArea>
  );
}
