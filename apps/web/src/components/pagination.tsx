import Link from "next/link";

/**
 * Navigasi halaman katalog.
 *
 * Nomor halaman dipangkas di sekitar halaman aktif, jadi delapan halaman
 * tampil utuh sementara tiga puluh halaman tidak memenuhi layar.
 */
export function Pagination({
  page,
  pages,
  buatTautan,
}: {
  page: number;
  pages: number;
  buatTautan: (halaman: number) => string;
}) {
  if (pages <= 1) return null;

  const nomor: (number | "…")[] = [];
  const tampilkan = new Set([1, pages, page, page - 1, page + 1]);

  // Halaman pertama dan terakhir selalu ada, plus tetangga halaman aktif.
  for (let i = 1; i <= pages; i++) {
    if (tampilkan.has(i)) {
      if (nomor.length > 0 && i - (nomor.at(-1) as number) > 1) nomor.push("…");
      nomor.push(i);
    }
  }

  const tombol =
    "grid h-10 min-w-10 place-items-center rounded-xl border px-3 text-sm";

  return (
    <nav
      aria-label="Halaman menu"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      {page > 1 ? (
        <Link
          href={buatTautan(page - 1)}
          rel="prev"
          className={`${tombol} border-border bg-surface hover:border-accent`}
        >
          Sebelumnya
        </Link>
      ) : (
        <span className={`${tombol} border-border text-muted opacity-50`}>
          Sebelumnya
        </span>
      )}

      {nomor.map((n, i) =>
        n === "…" ? (
          <span key={`sela-${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={buatTautan(n)}
            aria-current={n === page ? "page" : undefined}
            className={`${tombol} ${
              n === page
                ? "border-accent bg-accent font-medium text-white"
                : "border-border bg-surface hover:border-accent"
            }`}
          >
            {n}
          </Link>
        ),
      )}

      {page < pages ? (
        <Link
          href={buatTautan(page + 1)}
          rel="next"
          className={`${tombol} border-border bg-surface hover:border-accent`}
        >
          Berikutnya
        </Link>
      ) : (
        <span className={`${tombol} border-border text-muted opacity-50`}>
          Berikutnya
        </span>
      )}
    </nav>
  );
}
