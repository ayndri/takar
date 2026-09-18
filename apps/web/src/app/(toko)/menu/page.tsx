import Link from "next/link";
import { MenuCard } from "@/components/menu-card";
import { getPublicMenus, type PublicMenu } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function KatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kategori?: string }>;
}) {
  const { q = "", kategori = "" } = await searchParams;

  let menus: PublicMenu[] = [];
  let gagal = false;

  try {
    menus = await getPublicMenus();
  } catch {
    gagal = true;
  }

  const kategoriTersedia = [...new Set(menus.map((m) => m.category))];

  const kata = q.trim().toLowerCase();
  const hasil = menus.filter((m) => {
    const cocokKategori = !kategori || m.category === kategori;
    const cocokKata =
      !kata ||
      m.name.toLowerCase().includes(kata) ||
      m.category.toLowerCase().includes(kata);
    return cocokKategori && cocokKata;
  });

  const buatTautan = (patch: { q?: string; kategori?: string }) => {
    const p = new URLSearchParams();
    const nextQ = patch.q ?? q;
    const nextKategori = patch.kategori ?? kategori;
    if (nextQ) p.set("q", nextQ);
    if (nextKategori) p.set("kategori", nextKategori);
    const s = p.toString();
    return s ? `/menu?${s}` : "/menu";
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Menu hari ini
      </h1>
      <p className="mt-2 text-muted">
        {gagal
          ? "Daftar menu sedang tidak bisa dimuat."
          : `${menus.filter((m) => m.available).length} dari ${menus.length} menu bisa dibuat sekarang.`}
      </p>

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
                href={buatTautan({ kategori: "" })}
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
                  href={buatTautan({ kategori: k })}
                  aria-current={kategori === k ? "true" : undefined}
                  className={`inline-block rounded-xl border px-3 py-1.5 text-sm ${
                    kategori === k
                      ? "border-ink bg-ink text-paper"
                      : "border-border bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {k}
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
      ) : hasil.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="font-display text-xl">Tidak ada yang cocok</p>
          <p className="mt-1 text-sm text-muted">
            {kata
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hasil.map((menu) => (
            <MenuCard key={menu.id} menu={menu} />
          ))}
        </div>
      )}
    </main>
  );
}
