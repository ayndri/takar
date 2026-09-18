import Link from "next/link";
import { MenuBrowser } from "@/components/menu-browser";
import { api, getPublicMenus, type PublicMenu } from "@/lib/api";

// Katalog ikut stok yang berubah tiap pesanan — jangan dibekukan saat build.
export const dynamic = "force-dynamic";

type CafeTable = { id: string; number: string };

export default async function MenuPage() {
  let menus: PublicMenu[] = [];
  let tables: CafeTable[] = [];
  let error: string | null = null;

  try {
    [menus, tables] = await Promise.all([
      getPublicMenus(),
      api<CafeTable[]>("/api/tables"),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Gagal memuat menu";
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-wide text-accent uppercase">
            Takar Coffee
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Daftar menu
          </h1>
          <p className="mt-2 text-muted">
            Pesan dari meja, bayar di kasir saat pesanan siap.
          </p>
        </div>

        <Link
          href="/login"
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-muted"
        >
          Staff
        </Link>
      </header>

      {error ? (
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="font-medium text-danger">Menu belum bisa dimuat</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <p className="mt-3 text-sm text-muted">
            Pastikan API sudah jalan di{" "}
            <code className="font-mono text-xs">localhost:3001</code>.
          </p>
        </div>
      ) : menus.length === 0 ? (
        <p className="text-muted">Belum ada menu yang aktif.</p>
      ) : (
        <MenuBrowser menus={menus} tables={tables} />
      )}
    </main>
  );
}
