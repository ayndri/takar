import { SkeletonArea, Skeleton } from "@/components/ui/skeleton";

export default function DetailMenuLoading() {
  return (
    <SkeletonArea label="Memuat detail menu…">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Skeleton className="h-4 w-32" />

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-4/3 rounded-2xl" />

          <div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-9 w-56 max-w-full" />
            <Skeleton className="mt-4 h-6 w-28" />
            <Skeleton className="mt-6 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-8 h-11 w-40 rounded-xl" />
          </div>
        </div>
      </main>
    </SkeletonArea>
  );
}
