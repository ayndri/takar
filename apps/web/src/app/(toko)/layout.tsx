import Link from "next/link";
import { CartBar } from "@/components/cart-bar";
import { SiteHeader } from "@/components/site-header";

export default function TokoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />

      {/* Ruang bawah disisakan supaya bar keranjang tidak menutupi isi halaman. */}
      <div className="flex-1 pb-24">{children}</div>

      <footer className="border-t border-border bg-sunk">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-sm">
              <p className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-accent font-display text-lg leading-none font-semibold text-white">
                  T
                </span>
                <span className="font-display text-xl font-semibold">
                  Takar
                </span>
              </p>
              <p className="mt-3 text-sm text-muted">
                Menu kafe yang menghitung isi gudangnya sendiri. Bahan habis,
                menunya ikut tutup, jadi yang tampil di daftar memang bisa
                dibuat.
              </p>
            </div>

            <nav aria-label="Tautan halaman">
              <p className="text-sm font-medium">Halaman</p>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>
                  <Link href="/" className="hover:text-ink">
                    Beranda
                  </Link>
                </li>
                <li>
                  <Link href="/menu" className="hover:text-ink">
                    Daftar menu
                  </Link>
                </li>
                <li>
                  <Link href="/pesanan" className="hover:text-ink">
                    Lacak pesanan
                  </Link>
                </li>
              </ul>
            </nav>

            <div>
              <p className="text-sm font-medium">Untuk staff</p>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>
                  <Link href="/login" className="hover:text-ink">
                    Masuk ke dasbor
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/meja" className="hover:text-ink">
                    Cetak QR meja
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-8 border-t border-border pt-6 text-sm text-muted">
            Pesan dari meja, bayar di kasir.
          </p>
        </div>
      </footer>

      <CartBar />
    </>
  );
}
