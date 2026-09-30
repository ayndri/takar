import {
  SkeletonArea,
  SkeletonKartuMenu,
  Skeleton,
} from "@/components/ui/skeleton";

/**
 * Katalog dimuat dari server tiap kali dibuka, karena sisa porsinya berubah
 * tiap ada pesanan masuk. Tanpa berkas ini, menekan "Menu" di header berarti
 * layar diam sampai server menjawab — dan yang menekan biasanya menekan lagi.
 */
export default function MenuLoading() {
  return (
    <SkeletonArea label="Memuat katalog menu…">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />

        {/* Baris saringan kategori */}
        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-xl" />
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SkeletonKartuMenu jumlah={12} />
        </div>
      </main>
    </SkeletonArea>
  );
}
