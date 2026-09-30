import Link from "next/link";
import { IconPromo } from "@/components/icons";
import type { Pengumuman } from "@/lib/api";

/**
 * Banner pengumuman di atas beranda.
 *
 * Satu saja yang tampil, dan itu disengaja: dua banner bertumpuk membuat
 * dua-duanya tidak terbaca. Kalau kafe punya beberapa pengumuman, yang
 * terbaru yang menang — mengganti pengumuman cukup dengan membuat yang baru.
 *
 * Bentuknya sengaja tidak menutup layar dan tidak bisa ditutup. Yang bisa
 * ditutup akan ditutup tanpa dibaca, dan pengumuman yang perlu dibaca sekali
 * tidak layak merebut seluruh halaman depan untuk itu.
 */
export function BannerPengumuman({ pengumuman }: { pengumuman: Pengumuman }) {
  const adaTautan = pengumuman.linkHref && pengumuman.linkLabel;

  return (
    <aside
      aria-label="Pengumuman kafe"
      className="border-b border-accent/20 bg-accent-soft"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <IconPromo
          className="size-5 shrink-0 text-accent-ink"
          aria-hidden="true"
        />

        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium text-accent-ink">
            {pengumuman.title}
          </span>
          <span className="text-muted"> — {pengumuman.body}</span>
        </p>

        {adaTautan && (
          <Link
            href={pengumuman.linkHref!}
            className="shrink-0 rounded-lg border border-accent/40 bg-surface px-3 py-1.5 text-sm font-medium text-accent-ink hover:border-accent"
          >
            {pengumuman.linkLabel}
          </Link>
        )}
      </div>
    </aside>
  );
}
