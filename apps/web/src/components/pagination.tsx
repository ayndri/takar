import Link from "next/link";

/**
 * Satu tombol halaman.
 *
 * Bentuknya menyesuaikan: tombol kalau halamannya diganti di tempat, tautan
 * kalau berpindah alamat. Didefinisikan di tingkat modul, bukan di dalam
 * Pagination — komponen yang dibuat ulang tiap render membuat React
 * membongkar-pasang seluruh isinya dan fokus papan ketik ikut hilang.
 */
function Ke({
  ke,
  rel,
  ariaCurrent,
  className,
  buatTautan,
  onPilih,
  children,
}: {
  ke: number;
  rel?: string;
  ariaCurrent?: "page";
  className: string;
  buatTautan: (halaman: number) => string;
  onPilih?: (halaman: number) => void;
  children: React.ReactNode;
}) {
  if (onPilih) {
    return (
      <button
        type="button"
        onClick={() => onPilih(ke)}
        aria-current={ariaCurrent}
        className={className}
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      href={buatTautan(ke)}
      rel={rel}
      aria-current={ariaCurrent}
      className={className}
    >
      {children}
    </Link>
  );
}

/**
 * Navigasi halaman katalog.
 *
 * Nomor halaman dipangkas di sekitar halaman aktif, jadi delapan halaman
 * tampil utuh sementara tiga puluh halaman tidak memenuhi layar.
 *
 * Dua mode, satu logika. Kalau `onPilih` diberikan, nomornya jadi tombol yang
 * mengganti isi halaman tanpa pindah alamat; kalau tidak, jadi tautan biasa
 * yang tetap berfungsi tanpa JavaScript.
 */
export function Pagination({
  page,
  pages,
  buatTautan,
  onPilih,
}: {
  page: number;
  pages: number;
  buatTautan: (halaman: number) => string;
  onPilih?: (halaman: number) => void;
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
        <Ke
          ke={page - 1}
          buatTautan={buatTautan}
          onPilih={onPilih}
          rel="prev"
          className={`${tombol} border-border bg-surface hover:border-accent`}
        >
          Sebelumnya
        </Ke>
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
          <Ke
            key={n}
            ke={n}
            buatTautan={buatTautan}
            onPilih={onPilih}
            ariaCurrent={n === page ? "page" : undefined}
            className={`${tombol} ${
              n === page
                ? "border-accent bg-accent font-medium text-white"
                : "border-border bg-surface hover:border-accent"
            }`}
          >
            {n}
          </Ke>
        ),
      )}

      {page < pages ? (
        <Ke
          ke={page + 1}
          buatTautan={buatTautan}
          onPilih={onPilih}
          rel="next"
          className={`${tombol} border-border bg-surface hover:border-accent`}
        >
          Berikutnya
        </Ke>
      ) : (
        <span className={`${tombol} border-border text-muted opacity-50`}>
          Berikutnya
        </span>
      )}
    </nav>
  );
}
