"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconMeja } from "@/components/icons";
import { formatRupiah, formatWaktu } from "@/lib/client-api";
import { useRiwayatPesanan } from "@/lib/last-order";
import { useTokenMeja } from "@/lib/meja";
import { useApi } from "@/lib/use-api";

type RingkasPesanan = {
  code: string;
  status: "PENDING" | "CONFIRMED" | "PREPARING" | "READY";
  total: string;
  customerName: string | null;
  createdAt: string;
  itemCount: number;
};

const LABEL: Record<string, string> = {
  PENDING: "Diterima",
  CONFIRMED: "Masuk antrean",
  PREPARING: "Sedang dibuat",
  READY: "Siap diambil",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

/** Satu baris pesanan yang bisa diklik. Dipakai dua daftar di halaman ini. */
function BarisPesanan({
  code,
  kanan,
  bawah,
}: {
  code: string;
  kanan?: string;
  bawah?: string;
}) {
  return (
    <li>
      <Link
        href={`/pesanan/${code}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-accent"
      >
        <span className="min-w-0">
          <span className="block font-mono font-medium">{code}</span>
          {bawah && (
            <span className="block truncate text-xs text-muted">{bawah}</span>
          )}
        </span>
        {kanan && (
          <span className="shrink-0 text-sm text-muted tabular-nums">
            {kanan}
          </span>
        )}
      </Link>
    </li>
  );
}

export default function LacakPesananPage() {
  const router = useRouter();
  const [kode, setKode] = useState("");

  const riwayat = useRiwayatPesanan();
  const token = useTokenMeja();

  /**
   * Pesanan yang sedang berjalan di meja yang terakhir dipindai.
   *
   * Kuncinya token QR, bukan nomor meja: nomor meja tercetak di mejanya dan
   * terlihat seisi ruangan, jadi kalau nomor yang jadi kunci, siapa pun bisa
   * memanen nama dan pesanan semua tamu. Token tidak bisa ditebak, dan yang
   * memindainya memang sedang duduk di sana.
   */
  const meja = useApi<{
    table: { number: string };
    orders: RingkasPesanan[];
  }>(token ? `/api/tables/by-token/${encodeURIComponent(token)}/orders` : null, {
    refreshInterval: 15000,
  });

  const diMeja = meja.data?.orders ?? [];

  // Yang sudah tampil di daftar meja tidak perlu diulang di riwayat perangkat.
  const kodeDiMeja = new Set(diMeja.map((o) => o.code));
  const riwayatLain = riwayat.filter((r) => !kodeDiMeja.has(r.code));

  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Lacak pesanan
      </h1>

      {diMeja.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            <IconMeja className="size-4 text-accent" aria-hidden="true" />
            Sedang berjalan di meja {meja.data?.table.number}
          </h2>

          <ul className="mt-2 space-y-2">
            {diMeja.map((o) => (
              <BarisPesanan
                key={o.code}
                code={o.code}
                kanan={formatRupiah(o.total)}
                bawah={`${LABEL[o.status] ?? o.status} · ${o.itemCount} menu${
                  o.customerName ? ` · ${o.customerName}` : ""
                }`}
              />
            ))}
          </ul>
        </section>
      )}

      {riwayatLain.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium">Dari perangkat ini</h2>
          <ul className="mt-2 space-y-2">
            {riwayatLain.map((r) => (
              <BarisPesanan
                key={r.code}
                code={r.code}
                bawah={formatWaktu(new Date(r.at).toISOString())}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-medium">
          {diMeja.length > 0 || riwayatLain.length > 0
            ? "Punya kode lain?"
            : "Masukkan kode pesanan"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Kodenya muncul setelah kamu mengirim pesanan. Bentuknya seperti{" "}
          <span className="font-mono text-ink">TKR-7F2A</span>.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const bersih = kode.trim().toUpperCase();
            if (bersih) router.push(`/pesanan/${bersih}`);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            placeholder="TKR-0000"
            aria-label="Kode pesanan"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 font-mono tracking-wide uppercase"
          />
          <button
            type="submit"
            disabled={kode.trim().length < 4}
            className="rounded-xl bg-accent px-5 py-3 font-medium text-white hover:bg-accent-ink disabled:opacity-50"
          >
            Cari
          </button>
        </form>
      </section>

      {!token && (
        <p className="mt-6 text-sm text-muted">
          Kehilangan kodenya? Pindai lagi kode QR di mejamu — pesanan yang
          sedang berjalan di meja itu akan muncul di sini.
        </p>
      )}
    </main>
  );
}
