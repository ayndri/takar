import Link from "next/link";
import { OrderStatus } from "@/components/order-status";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-muted">
        ← Kembali ke menu
      </Link>

      <OrderStatus code={code} />
    </main>
  );
}
