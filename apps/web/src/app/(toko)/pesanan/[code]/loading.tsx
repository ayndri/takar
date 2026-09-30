import { SkeletonArea, Skeleton } from "@/components/ui/skeleton";

export default function StatusPesananLoading() {
  return (
    <SkeletonArea label="Memuat status pesanan…">
      <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
        <Skeleton className="h-4 w-32" />

        <Skeleton className="mt-6 h-3.5 w-24" />
        <Skeleton className="mt-2 h-9 w-40" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full" />

        {/* Empat tahap di garis waktu */}
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="mt-1 size-2.5 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1.5 h-3.5 w-48 max-w-full" />
              </div>
            </div>
          ))}
        </div>

        <Skeleton className="mt-4 h-28 rounded-xl" />
      </main>
    </SkeletonArea>
  );
}
