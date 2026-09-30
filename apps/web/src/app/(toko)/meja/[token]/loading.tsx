import { SkeletonArea, Skeleton } from "@/components/ui/skeleton";

/**
 * Halaman ini yang pertama dilihat orang setelah memindai QR di mejanya —
 * sering di jaringan seluler yang lambat. Justru di sini rangka paling
 * berguna: yang baru memindai perlu tahu kodenya terbaca, bukan melihat
 * layar putih dan mengira QR-nya rusak.
 */
export default function MejaLoading() {
  return (
    <SkeletonArea label="Membaca kode meja…">
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center sm:px-6">
        <Skeleton className="mx-auto size-12 rounded-xl" />
        <Skeleton className="mx-auto mt-5 h-8 w-44" />
        <Skeleton className="mx-auto mt-3 h-4 w-60 max-w-full" />
        <Skeleton className="mx-auto mt-8 h-11 w-40 rounded-xl" />
      </main>
    </SkeletonArea>
  );
}
