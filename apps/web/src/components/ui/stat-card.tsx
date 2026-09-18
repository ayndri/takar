import Link from "next/link";

/**
 * Kartu angka di kepala halaman dasbor.
 *
 * Nadanya dibedakan supaya yang perlu ditindaklanjuti terbaca berbeda dari
 * yang sekadar informasi: kuning untuk yang menunggu tindakan, merah untuk
 * kerugian, dan netral untuk sisanya.
 */
export function StatCard({
  label,
  nilai,
  catatan,
  href,
  nada = "netral",
}: {
  label: string;
  nilai: string;
  catatan?: string;
  href?: string;
  nada?: "netral" | "sorot" | "rugi";
}) {
  const warnaNilai =
    nada === "rugi" ? "text-danger" : nada === "sorot" ? "text-warning" : "";
  const warnaTepi = nada === "sorot" ? "border-warning/40" : "border-border";

  const isi = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warnaNilai}`}>
        {nilai}
      </p>
      {catatan && <p className="mt-0.5 text-xs text-muted">{catatan}</p>}
    </>
  );

  const kelas = `block rounded-xl border bg-surface p-4 ${warnaTepi}`;

  return href ? (
    <Link href={href} className={`${kelas} transition hover:border-accent`}>
      {isi}
    </Link>
  ) : (
    <div className={kelas}>{isi}</div>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}
