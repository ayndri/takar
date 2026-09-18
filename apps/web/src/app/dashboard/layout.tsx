"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearSession } from "@/lib/client-api";
import { notifySessionChanged, useSession } from "@/lib/session";

type MenuItem = { href: string; label: string; ownerOnly?: boolean };

const MENU: MenuItem[] = [
  { href: "/dashboard/pesanan", label: "Pesanan" },
  { href: "/dashboard/bahan", label: "Bahan baku" },
  { href: "/dashboard/menu", label: "Menu & resep", ownerOnly: true },
  { href: "/dashboard/pembelian", label: "Pembelian" },
  { href: "/dashboard/waste", label: "Waste" },
  { href: "/dashboard/opname", label: "Opname" },
  { href: "/dashboard/meja", label: "Meja & QR" },
  { href: "/dashboard/laporan", label: "Laporan", ownerOnly: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();

  useEffect(() => {
    // Render pertama selalu tanpa sesi (server tidak punya localStorage),
    // jadi pengalihan baru boleh dilakukan setelah komponen ada di browser.
    if (session === null) router.replace("/login");
  }, [session, router]);

  if (!session) {
    return <p className="p-8 text-muted">Memeriksa sesi…</p>;
  }

  const user = session.user;
  const items = MENU.filter((m) => !m.ownerOnly || user?.role === "OWNER");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard/pesanan" className="font-semibold">
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
