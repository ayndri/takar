import { KatalogMenu } from "@/components/katalog-menu";
import { MejaTerpilih } from "@/components/meja-terpilih";
import {
  getHighlights,
  getPublicMenus,
  type Highlights,
  type Paginated,
  type PublicMenu,
} from "@/lib/api";
import { urutkanKategori } from "@/lib/kategori";

export const dynamic = "force-dynamic";

const PER_HALAMAN = 12;

/**
 * Katalog menu.
 *
 * Muatan pertamanya diambil di server, dan itu disengaja: tautan
 * `/menu?q=kopi` yang dibagikan orang harus langsung berisi, bukan mulai dari
 * layar kosong yang baru terisi setelah JavaScript jalan.
 *
 * Pencarian, saringan kategori, dan perpindahan halaman setelah itu dikerjakan
 * di browser oleh KatalogMenu, tanpa memuat ulang halaman.
 */
export default async function KatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kategori?: string; hal?: string }>;
}) {
  const { q = "", kategori = "", hal = "1" } = await searchParams;
  const halaman = Math.max(1, Number(hal) || 1);

  let hasil: Paginated<PublicMenu> | null = null;
  let ringkasan: Highlights | null = null;
  let gagal = false;

  try {
    [hasil, ringkasan] = await Promise.all([
      getPublicMenus({
        q: q.trim() || undefined,
        category: kategori || undefined,
        page: halaman,
        pageSize: PER_HALAMAN,
      }),
      getHighlights(),
    ]);
  } catch {
    gagal = true;
  }

  const kategoriTersedia = urutkanKategori(
    (ringkasan?.categories ?? []).map((c) => c.name),
  );

  const jumlahPerKategori = Object.fromEntries(
    (ringkasan?.categories ?? []).map((c) => [c.name, c.count]),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Menu hari ini
      </h1>
      <p className="mt-2 text-muted">
        {gagal
          ? "Daftar menu sedang tidak bisa dimuat."
          : ringkasan
            ? `${ringkasan.stats.available} dari ${ringkasan.stats.total} menu bisa dibuat sekarang.`
            : ""}
      </p>

      <MejaTerpilih />

      {gagal ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <p className="font-medium text-accent-ink">Menu belum bisa dimuat</p>
          <p className="mt-1 text-sm text-muted">
            Layanan pesanan sedang tidak bisa dihubungi. Coba muat ulang
            halaman, atau pesan langsung ke kasir.
          </p>
        </div>
      ) : (
        /**
         * Kunci dari alamatnya: kalau pencarian datang dari kotak cari di
         * header — yang memang berpindah halaman sungguhan — komponen ini
         * dipasang ulang dengan keadaan awal yang benar, bukan mempertahankan
         * kata kunci lamanya.
         */
        <KatalogMenu
          key={`${q}|${kategori}|${halaman}`}
          awal={hasil}
          qAwal={q}
          kategoriAwal={kategori}
          halAwal={halaman}
          kategoriTersedia={kategoriTersedia}
          jumlahPerKategori={jumlahPerKategori}
        />
      )}
    </main>
  );
}
