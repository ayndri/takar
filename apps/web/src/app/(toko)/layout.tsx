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

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <p>
            <span className="font-display font-semibold text-ink">Takar</span> ·
            pesan dari meja, bayar di kasir
          </p>
          <Link href="/login" className="hover:text-ink">
            Masuk sebagai staff
          </Link>
        </div>
      </footer>

      <CartBar />
    </>
  );
}
