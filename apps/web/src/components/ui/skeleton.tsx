/**
 * Rangka isi yang belum datang.
 *
 * Dipakai menggantikan tulisan "Memuat…" di tempat yang bentuk akhirnya sudah
 * bisa ditebak. Bedanya bukan soal enak dilihat: tulisan satu baris lalu
 * berganti jadi tabel dua belas baris membuat halaman melompat, dan yang
 * sedang membaca kehilangan tempatnya. Rangka yang seukuran isinya membuat
 * tata letaknya tidak bergeser sama sekali saat datanya masuk.
 *
 * Kedipannya dimatikan untuk yang menyalakan "kurangi gerakan" di sistemnya —
 * animasi berdenyut termasuk yang memicu rasa mual pada sebagian orang.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded bg-sunk motion-safe:animate-pulse ${className}`}
    />
  );
}

/**
 * Pembungkus yang memberi tahu pembaca layar bahwa isinya sedang dimuat.
 *
 * Rangkanya sendiri disembunyikan dari pembaca layar — membacakan dua belas
 * kotak kosong tidak membantu siapa pun. Yang dibacakan satu kalimat.
 */
export function SkeletonArea({
  label = "Memuat…",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Baris-baris kosong seukuran baris tabel dasbor. */
export function SkeletonTabel({
  baris = 5,
  kolom = 5,
}: {
  baris?: number;
  kolom?: number;
}) {
  return (
    <>
      {Array.from({ length: baris }, (_, i) => (
        <tr key={i} className="border-b border-border last:border-0">
          {Array.from({ length: kolom }, (_, k) => (
            <td key={k} className="px-4 py-3.5">
              {/* Lebarnya dibuat tidak seragam supaya terbaca sebagai teks
                  yang akan datang, bukan sebagai kotak-kotak hiasan. */}
              <Skeleton
                className={`h-3.5 ${k === 0 ? "w-32" : k % 3 === 0 ? "w-16" : "w-24"}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Kartu ringkasan di kepala halaman dasbor. */
export function SkeletonStat({ jumlah = 4 }: { jumlah?: number }) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: jumlah }, (_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-2.5 h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Kartu menu di katalog dan beranda. */
export function SkeletonKartuMenu({
  jumlah = 12,
  ringkas = false,
}: {
  jumlah?: number;
  ringkas?: boolean;
}) {
  return (
    <>
      {Array.from({ length: jumlah }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <Skeleton
            className={`rounded-none ${ringkas ? "aspect-16/10" : "aspect-4/3"}`}
          />
          <div className={ringkas ? "p-3.5" : "p-4"}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-5 w-32" />
            <div className="mt-4 flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/** Judul dan keterangan di kepala halaman. */
export function SkeletonJudul() {
  return (
    <div className="mb-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
    </div>
  );
}

/** Daftar baris pendek di dalam panel ringkasan. */
export function SkeletonBaris({ jumlah = 4 }: { jumlah?: number }) {
  return (
    <ul className="space-y-2.5">
      {Array.from({ length: jumlah }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-3">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3.5 w-16" />
        </li>
      ))}
    </ul>
  );
}

/** Papan kanban pesanan dapur: empat kolom berisi beberapa kartu. */
export function SkeletonPapan() {
  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, k) => (
        <div key={k} className="rounded-xl border border-border bg-surface p-3">
          <Skeleton className="h-4 w-24" />
          <div className="mt-3 space-y-2">
            {/* Kolom pertama biasanya paling panjang; sisanya dibuat makin
                pendek supaya rangkanya tidak terbaca sebagai tabel kosong. */}
            {Array.from({ length: 3 - Math.min(k, 2) + 1 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Baris pengaturan: keterangan di kiri, sakelar di kanan. */
export function SkeletonSakelar({ jumlah = 6 }: { jumlah?: number }) {
  return (
    <div className="mb-6 rounded-xl border border-border bg-surface">
      {Array.from({ length: jumlah }, (_, i) => (
        <div
          key={i}
          className="flex items-start gap-4 border-b border-border px-5 py-4 last:border-0"
        >
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3.5 w-full max-w-md" />
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
