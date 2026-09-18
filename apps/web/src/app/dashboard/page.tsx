"use client";

import Link from "next/link";
import { formatRupiah } from "@/lib/client-api";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";

type Ringkasan = {
  hariIni: { pesanan: number; omzet?: string };
  antrean: { menungguKonfirmasi: number; sedangJalan: number };
  stok: {
    menipis: number;
    nilai?: string;
    daftarMenipis: {
      id: string;
      name: string;
      qty: string;
      baseUnit: string;
      minStock: string;
    }[];
  };
  mingguIni?: {
    omzet: string;
    hpp: string;
    laba: string;
    margin: string;
    pesanan: number;
    terbuang: string;
    menuTeratas: { menuId: string; name: string; qty: number; revenue: string }[];
  };
};

export default function RingkasanPage() {
  const session = useSession();
  const { data, error, isLoading } = useApi<Ringkasan>("/api/reports/dashboard", {
    refreshInterval: 30000,
  });

  const pemilik = session?.user?.role === "OWNER";

  if (error) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-danger">
        {error.message}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Halo, {session?.user?.name?.split(" ")[0] ?? "kamu"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {pemilik
            ? "Ringkasan hari ini dan minggu ini, dihitung langsung dari catatan stok."
            : "Yang perlu kamu urus hari ini."}
        </p>
      </div>

      {/* Yang butuh tindakan ditaruh paling atas, bukan angka-angka dulu:
          pesanan yang menunggu konfirmasi adalah pekerjaan, bukan laporan. */}
      {data && data.antrean.menungguKonfirmasi > 0 && (
        <Link
          href="/dashboard/pesanan"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft px-5 py-4"
        >
          <div>
            <p className="font-medium text-accent-ink">
              {data.antrean.menungguKonfirmasi} pesanan menunggu dikonfirmasi
            </p>
            <p className="text-sm text-accent-ink/80">
              Stok bahan baru dipotong setelah kamu konfirmasi.
            </p>
          </div>
          <span className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
            Buka papan pesanan
          </span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kartu
          label="Pesanan hari ini"
          nilai={isLoading ? "…" : String(data?.hariIni.pesanan ?? 0)}
          catatan={
            data ? `${data.antrean.sedangJalan} sedang berjalan` : undefined
          }
          href="/dashboard/pesanan"
        />

        {pemilik && (
          <Kartu
            label="Omzet hari ini"
            nilai={
              isLoading ? "…" : formatRupiah(data?.hariIni.omzet ?? 0)
            }
            catatan={
              data?.mingguIni
                ? `${data.mingguIni.pesanan} pesanan minggu ini`
                : undefined
            }
            href="/dashboard/laporan"
          />
        )}

        <Kartu
          label="Bahan menipis"
          nilai={isLoading ? "…" : String(data?.stok.menipis ?? 0)}
          catatan="di bawah stok minimum"
          href="/dashboard/bahan"
          sorot={(data?.stok.menipis ?? 0) > 0}
        />

        {pemilik && (
          <Kartu
            label="Nilai persediaan"
            nilai={isLoading ? "…" : formatRupiah(data?.stok.nilai ?? 0)}
            catatan="stok x harga rata-rata"
            href="/dashboard/laporan"
          />
        )}
      </div>

      {pemilik && data?.mingguIni && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kartu
            label="Omzet 7 hari"
            nilai={formatRupiah(data.mingguIni.omzet)}
          />
          <Kartu
            label="Laba kotor 7 hari"
            nilai={formatRupiah(data.mingguIni.laba)}
            catatan={`margin ${data.mingguIni.margin}%`}
          />
          <Kartu
            label="HPP 7 hari"
            nilai={formatRupiah(data.mingguIni.hpp)}
            catatan="dari catatan penjualan"
          />
          <Kartu
            label="Terbuang 7 hari"
            nilai={formatRupiah(data.mingguIni.terbuang)}
            href="/dashboard/waste"
            merah
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          judul="Perlu dibeli"
          aksi={{ label: "Catat pembelian", href: "/dashboard/pembelian" }}
        >
          {isLoading ? (
            <p className="text-sm text-muted">Memuat…</p>
          ) : data && data.stok.daftarMenipis.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {data.stok.daftarMenipis.map((b) => (
                <li key={b.id} className="flex justify-between gap-3">
                  <span>{b.name}</span>
                  <span className="text-warning tabular-nums">
                    {b.qty} {b.baseUnit.toLowerCase()}
                    <span className="text-muted"> / min {b.minStock}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Tidak ada bahan yang di bawah stok minimum.
            </p>
          )}
        </Panel>

        {pemilik && (
          <Panel
            judul="Menu paling laku 7 hari"
            aksi={{ label: "Lihat laporan", href: "/dashboard/laporan" }}
          >
            {isLoading ? (
              <p className="text-sm text-muted">Memuat…</p>
            ) : data?.mingguIni && data.mingguIni.menuTeratas.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {data.mingguIni.menuTeratas.map((m) => (
                  <li key={m.menuId} className="flex justify-between gap-3">
                    <span>
                      {m.name}
                      <span className="text-muted"> · {m.qty} porsi</span>
                    </span>
                    <span className="tabular-nums">
                      {formatRupiah(m.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Belum ada penjualan.</p>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function Kartu({
  label,
  nilai,
  catatan,
  href,
  merah,
  sorot,
}: {
  label: string;
  nilai: string;
  catatan?: string;
  href?: string;
  merah?: boolean;
  sorot?: boolean;
}) {
  const isi = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          merah ? "text-danger" : sorot ? "text-warning" : ""
        }`}
      >
        {nilai}
      </p>
      {catatan && <p className="mt-0.5 text-xs text-muted">{catatan}</p>}
    </>
  );

  const kelas = `block rounded-xl border bg-surface p-4 ${
    sorot ? "border-warning/40" : "border-border"
  }`;

  return href ? (
    <Link href={href} className={`${kelas} transition hover:border-accent`}>
      {isi}
    </Link>
  ) : (
    <div className={kelas}>{isi}</div>
  );
}

function Panel({
  judul,
  aksi,
  children,
}: {
  judul: string;
  aksi?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{judul}</h2>
        {aksi && (
          <Link
            href={aksi.href}
            className="text-sm font-medium text-accent-ink hover:underline"
          >
            {aksi.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
