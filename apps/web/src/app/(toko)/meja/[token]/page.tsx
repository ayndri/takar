import { TerimaMeja } from "@/components/terima-meja";

export const dynamic = "force-dynamic";

/**
 * Tujuan kode QR yang ditempel di meja.
 *
 * Halaman ini tidak menampilkan apa-apa selain kabar singkat: tugasnya menukar
 * token jadi nomor meja, menyimpannya, lalu melempar pelanggan ke daftar menu.
 */
export default async function ScanMejaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <TerimaMeja token={token} />
    </main>
  );
}
