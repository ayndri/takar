"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearSession } from "@/lib/client-api";
import { notifySessionChanged, useSession } from "@/lib/session";
import {
  Skeleton,
  SkeletonJudul,
  SkeletonStat,
} from "@/components/ui/skeleton";
import { usePengaturan } from "@/lib/use-settings";

type MenuItem = {
  href: string;
  label: string;
  ownerOnly?: boolean;
  /** Kunci pengaturan yang harus menyala supaya tautan ini muncul. */
  fitur?: string;
};

const MENU: MenuItem[] = [
  { href: "/dashboard", label: "Ringkasan" },
  { href: "/dashboard/pesanan", label: "Pesanan" },
  { href: "/dashboard/reservasi", label: "Reservasi", fitur: "modul.reservasi" },
  { href: "/dashboard/bahan", label: "Bahan baku" },
  { href: "/dashboard/menu", label: "Menu & resep", ownerOnly: true },
  { href: "/dashboard/promo", label: "Promo", fitur: "modul.promo" },
  { href: "/dashboard/pembelian", label: "Pembelian", fitur: "modul.pembelian" },
  { href: "/dashboard/waste", label: "Waste", fitur: "modul.waste" },
  { href: "/dashboard/opname", label: "Opname", fitur: "modul.opname" },
  { href: "/dashboard/meja", label: "Meja & QR", fitur: "modul.meja" },
  { href: "/dashboard/laporan", label: "Laporan", ownerOnly: true, fitur: "modul.laporan" },
  { href: "/dashboard/pengaturan", label: "Pengaturan", ownerOnly: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const pengaturan = usePengaturan();

  useEffect(() => {
    // Hanya null yang berarti benar-benar tidak login. `undefined` berarti
    // sesinya belum sempat dibaca — dan itu keadaan setiap render pertama,
    // karena React menghidrasi memakai nilai dari server yang tidak punya
    // localStorage. Mengalihkan di situ membuat halaman dasbor yang
    // disegarkan selalu keluar sendiri.
    if (session === null) router.replace("/login");
  }, [session, router]);

  if (session === undefined || session === null) {
    // Render pertama selalu tanpa sesi, jadi layar ini pasti terlihat sekejap
    // oleh semua orang yang membuka dasbor. Rangka header membuat kedipannya
    // tidak terasa seperti halaman yang salah muat.
    return (
      <div role="status" aria-busy="true" className="flex min-h-full flex-col">
        <span className="sr-only">Memeriksa sesi…</span>
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-7 w-40" />
          </div>
          <div className="mx-auto flex max-w-6xl gap-2 px-4 pb-2 sm:px-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-20" />
            ))}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          <SkeletonJudul />
          <SkeletonStat />
        </main>
      </div>
    );
  }

  const user = session.user;

  // Modul yang dimatikan hilang dari navigasi. Selama pengaturannya belum
  // terbaca, semuanya ditampilkan dulu — menu yang berkedip hilang tiap kali
  // pindah halaman lebih mengganggu daripada satu tautan yang telat hilang,
  // dan halamannya sendiri tetap dijaga JagaModul.
  const items = MENU.filter(
    (m) =>
      (!m.ownerOnly || user?.role === "OWNER") &&
      (!m.fitur || pengaturan.isLoading || pengaturan.nyala(m.fitur)),
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="font-semibold">
            Takar
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">
              {user?.name}
              <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-xs">
                {user?.role === "OWNER" ? "Pemilik" : "Barista"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                clearSession();
                notifySessionChanged();
                router.replace("/login");
              }}
              className="rounded-lg border border-border px-2.5 py-1"
            >
              Keluar
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex gap-1 pb-1">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`inline-block rounded-t-lg px-3 py-2 text-sm whitespace-nowrap ${
                      active
                        ? "border-b-2 border-accent font-medium text-ink"
                        : "text-muted"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
