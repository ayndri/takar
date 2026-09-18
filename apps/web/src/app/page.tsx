import { formatRupiah, getPublicMenus, type PublicMenu } from "@/lib/api";

// Katalog ikut stok yang berubah tiap pesanan — jangan dibekukan saat build.
export const dynamic = "force-dynamic";

/** Di bawah angka ini pelanggan diberi tahu sisanya, supaya tidak kecewa di akhir. */
const AMBANG_MENIPIS = 5;

export default async function MenuPage() {
  let menus: PublicMenu[] = [];
  let error: string | null = null;

  try {
    menus = await getPublicMenus();
  } catch (e) {
    error = e instanceof Error ? e.message : "Gagal memuat menu";
  }

  const categories = [...new Set(menus.map((m) => m.category))];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-10">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Takar Coffee
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Daftar menu
        </h1>
        <p className="mt-2 text-muted">
          Pesan dari meja, ambil di kasir saat sudah siap.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-medium text-danger">Menu belum bisa dimuat</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <p className="mt-3 text-sm text-muted">
            Pastikan API sudah jalan di{" "}
            <code className="font-mono text-xs">localhost:3001</code>.
          </p>
        </div>
      )}

      {!error && menus.length === 0 && (
        <p className="text-muted">Belum ada menu yang aktif.</p>
      )}

      <div className="space-y-10">
        {categories.map((category) => (
          <section key={category}>
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">
              {category}
            </h2>

            <ul className="grid gap-3 sm:grid-cols-2">
              {menus
                .filter((m) => m.category === category)
                .map((menu) => (
                  <MenuCard key={menu.id} menu={menu} />
                ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

function MenuCard({ menu }: { menu: PublicMenu }) {
  const habis = !menu.available;
  const menipis =
    menu.available && menu.remainingPortions <= AMBANG_MENIPIS;

  return (
    <li
      className={`rounded-xl border border-border bg-surface p-4 transition ${
        habis ? "opacity-60" : "hover:border-accent"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{menu.name}</h3>
          <p className="mt-0.5 text-sm text-muted">{formatRupiah(menu.price)}</p>
        </div>

        {habis ? (
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-danger">
            Habis
          </span>
        ) : (
          <button
            type="button"
            disabled
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted"
            title="Keranjang menyusul"
          >
            Tambah
          </button>
        )}
      </div>

      {menipis && (
        <p className="mt-3 text-xs text-warning">
          Tinggal {menu.remainingPortions} porsi
        </p>
      )}
    </li>
  );
}
