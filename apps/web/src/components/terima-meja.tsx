"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { IconMeja } from "@/components/icons";
import { useMeja } from "@/lib/meja";
import { useApi } from "@/lib/use-api";

type Meja = { id: string; number: string };

/**
 * Menukar token QR jadi nomor meja, lalu pindah ke daftar menu.
 *
 * Penyimpanan meja dilakukan di efek, bukan saat render, karena localStorage
 * hanya ada di browser. Penanda `sudah` menjaga supaya perpindahan halaman
 * cuma dipicu sekali walau komponen dirender ulang.
 */
export function TerimaMeja({ token }: { token: string }) {
  const router = useRouter();
  const meja = useMeja();
  const sudah = useRef(false);

  const { data, error, isLoading } = useApi<Meja>(
    `/api/tables/by-token/${encodeURIComponent(token)}`,
  );

  useEffect(() => {
    if (!data || sudah.current) return;

    sudah.current = true;
    meja.pilih(data.id);
    router.replace("/menu?meja=terpasang");
  }, [data, meja, router]);

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="font-display text-xl font-semibold">
          Kode meja tidak dikenali
        </p>
        <p className="mt-2 text-sm text-muted">
          Stikernya mungkin sudah diganti. Pesan saja lewat daftar menu, lalu
          pilih nomor mejanya sendiri.
        </p>
        <Link
          href="/menu"
          className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-ink"
        >
          Buka daftar menu
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <IconMeja className="mx-auto size-8 text-accent" />

      {isLoading || !data ? (
        <p className="mt-3 text-muted">Membaca kode meja…</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">Kamu duduk di</p>
          <p className="font-display text-3xl font-semibold">
            Meja {data.number}
          </p>
          <p className="mt-2 text-sm text-muted">
            Nomor ini sudah terpasang di pesanan kamu. Membuka daftar menu…
          </p>
        </>
      )}
    </div>
  );
}
