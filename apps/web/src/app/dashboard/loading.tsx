import {
  SkeletonArea,
  SkeletonJudul,
  SkeletonStat,
  Skeleton,
} from "@/components/ui/skeleton";

/**
 * Berlaku untuk seluruh halaman dasbor.
 *
 * Halaman dasbor sendiri komponen browser yang mengambil datanya lewat SWR,
 * jadi perpindahan antar halaman sudah terasa seketika. Rangka ini untuk
 * pemuatan pertama — saat tab dibuka langsung dari alamatnya atau setelah
 * halaman disegarkan.
 */
export default function DashboardLoading() {
  return (
    <SkeletonArea label="Memuat halaman dasbor…">
      <SkeletonJudul />
      <SkeletonStat />
      <Skeleton className="h-9 w-64 max-w-full rounded-lg" />
      <Skeleton className="mt-3 h-80 rounded-xl" />
    </SkeletonArea>
  );
}
