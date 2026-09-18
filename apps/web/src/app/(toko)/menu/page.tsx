import Link from "next/link";
import { MejaTerpilih } from "@/components/meja-terpilih";
import { MenuCard } from "@/components/menu-card";
import { Pagination } from "@/components/pagination";
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

  const jumlahPerKategori = new Map(
    (ringkasan?.categories ?? []).map((c) => [c.name, c.count]),
  );

  const buatTautan = (patch: {
    q?: string;
    kategori?: string;
    hal?: number;
  }) => {
    const p = new URLSearchParams();
    const nextQ = patch.q ?? q;
    const nextKategori = patch.kategori ?? kategori;
    const nextHal = patch.hal ?? 1;

    if (nextQ) p.set("q", nextQ);
    if (nextKategori) p.set("kategori", nextKategori);
    if (nextHal > 1) p.set("hal", String(nextHal));

    const s = p.toString();
    return s ? `/menu?${s}` : "/menu";
  };

  const awal = hasil ? (hasil.page - 1) * hasil.pageSize + 1 : 0;
  const akhir = hasil ? Math.min(hasil.page * hasil.pageSize, hasil.total) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {kategori || "Menu hari ini"}
      </h1>
      <p className="mt-2 text-muted">
        {gagal
          ? "Daftar menu sedang tidak bisa dimuat."
          : ringkasan
            ? `${ringkasan.stats.available} dari ${ringkasan.stats.total} menu bisa dibuat sekarang.`
            : ""}
      </p>

      <MejaTerpilih />

      <form action="/menu" className="mt-6 flex max-w-md gap-2" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari nama menu…"
          aria-label="Cari menu"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm"
        />
        {kategori && <input type="hidden" name="kategori" value={kategori} />}
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink"
        >
          Cari
        </button>
      </form>

      {kategoriTersedia.length > 0 && (
        <nav aria-label="Saring kategori" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href={buatTautan({ kategori: "", hal: 1 })}
                aria-current={kategori === "" ? "true" : undefined}
                className={`inline-block rounded-xl border px-3 py-1.5 text-sm ${
                  kategori === ""
                    ? "border-ink bg-ink text-paper"
                    : "border-border bg-surface text-muted hover:text-ink"
                }`}
              >
                Semua
              </Link>
            </li>
            {kategoriTersedia.map((k) => (
              <li key={k}>
                <Link
                  href={buatTautan({ kategori: k, hal: 1 })}
                  aria-current={kategori === k ? "true" : undefined}
                  className={`inline-block rounded-xl border px-3 py-1.5 text-sm ${
                    kategori === k
                      ? "border-ink bg-ink text-paper"
                      : "border-border bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {k}
                  <span className="ml-1.5 text-xs opacity-70">
                    {jumlahPerKategori.get(k)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {gagal ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <p className="font-medium text-accent-ink">Menu belum bisa dimuat</p>
          <p className="mt-1 text-sm text-muted">
            Layanan pesanan sedang tidak bisa dihubungi. Coba muat ulang
            halaman, atau pesan langsung ke kasir.
          </p>
        </div>
      ) : !hasil || hasil.items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="font-display text-xl">Tidak ada yang cocok</p>
          <p className="mt-1 text-sm text-muted">
            {q.trim()
              ? `Tidak ada menu bernama "${q}".`
              : "Kategori ini belum punya menu."}
          </p>
          <Link
            href="/menu"
            className="mt-4 inline-block rounded-xl border border-border px-4 py-2 text-sm hover:border-accent"
          >
            Tampilkan semua menu
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted">
            Menampilkan {awal}–{akhir} dari {hasil.total} menu
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hasil.items.map((menu) => (
              <MenuCard key={menu.id} menu={menu} />
            ))}
          </div>

          <Pagination
            page={hasil.page}
            pages={hasil.pages}
            buatTautan={(n) => buatTautan({ hal: n })}
          />
        </>
      )}
    </main>
  );
}
