"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/menu", label: "Menu" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent font-display text-lg leading-none font-semibold text-white">
            T
          </span>
          <span className="font-display text-xl font-semibold">Takar</span>
        </Link>

        <nav className="ml-4 hidden gap-1 sm:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  active
                    ? "bg-accent-soft font-medium text-accent-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {count > 0 && (
            <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-sm font-medium text-accent-ink">
              {count} item
            </span>
          )}
          <Link
            href="/login"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-ink"
          >
            Staff
          </Link>
        </div>
      </div>
    </header>
  );
}
