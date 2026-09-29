import Link from "next/link";
import { ReservasiStatus } from "@/components/reservasi-status";

export const dynamic = "force-dynamic";

export default async function ReservasiPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <Link href="/reservasi" className="text-sm text-muted hover:text-ink">
        Buat reservasi lain
      </Link>

      <ReservasiStatus code={code} />
    </main>
  );
}
