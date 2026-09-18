"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { ApiError, request } from "@/lib/client-api";
import { useOrigin } from "@/lib/origin";
import { useApi } from "@/lib/use-api";

type Meja = {
  id: string;
  number: string;
  qrToken: string;
  isActive: boolean;
  path: string;
};

export default function MejaPage() {
  const { data, error, mutate } = useApi<Meja[]>("/api/admin/tables");
  const [qr, setQr] = useState<Record<string, string>>({});
  const [nomorBaru, setNomorBaru] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const asal = useOrigin();
  const tables = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    if (!asal || tables.length === 0) return;

    let aktif = true;

    Promise.all(
      tables.map(async (t) => {
        const url = `${asal}${t.path}`;
        const gambar = await QRCode.toDataURL(url, {
          width: 512,
          margin: 1,
          color: { dark: "#1c1917", light: "#ffffff" },
        });
        return [t.id, gambar] as const;
      }),
    ).then((hasil) => {
      if (aktif) setQr(Object.fromEntries(hasil));
    });

    return () => {
      aktif = false;
    };
  }, [asal, tables]);

  async function jalankan(id: string, jalur: () => Promise<unknown>, sukses: string) {
    setSibuk(id);
    setPesan(null);

    try {
      await jalur();
      await mutate();
      setPesan(sukses);
    } catch (e) {
      setPesan(e instanceof ApiError ? e.message : "Gagal menjalankan aksi");
    } finally {
      setSibuk(null);
    }
  }

  async function tambahMeja(e: React.FormEvent) {
    e.preventDefault();
    setPesan(null);

    try {
      await request("/api/admin/tables", {
        method: "POST",
        body: JSON.stringify({ number: nomorBaru.trim() }),
      });
      setNomorBaru("");
      await mutate();
      setPesan(`Meja ${nomorBaru.trim()} ditambahkan`);
    } catch (e) {
      setPesan(e instanceof ApiError ? e.message : "Gagal menambah meja");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meja & QR</h1>
          <p className="mt-1 text-sm text-muted">
            Cetak kode ini dan tempel di mejanya. Pelanggan yang memindainya
            langsung terisi nomor mejanya tanpa memilih manual.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-ink"
        >
          Cetak semua
        </button>
      </div>

      <form
        onSubmit={tambahMeja}
        className="mb-6 flex flex-wrap gap-2 print:hidden"
      >
        <input
          value={nomorBaru}
          onChange={(e) => setNomorBaru(e.target.value)}
          required
          placeholder="Nomor meja baru"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          Tambah meja
        </button>
      </form>

      {(error || pesan) && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm print:hidden">
          {pesan ?? error?.message}
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tables.map((t) => (
          <li
            key={t.id}
            className={`rounded-xl border border-border bg-surface p-4 text-center ${
              t.isActive ? "" : "opacity-60"
            }`}
          >
            <p className="font-display text-xl font-semibold">Meja {t.number}</p>

            <div className="mx-auto mt-3 aspect-square w-full max-w-[180px] rounded-lg bg-white p-2">
              {qr[t.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr[t.id]}
                  alt={`Kode QR meja ${t.number}`}
                  className="size-full"
                />
              ) : (
                <div className="grid size-full place-items-center text-xs text-muted">
                  Menyiapkan kode…
                </div>
              )}
            </div>

            <p className="mt-3 text-xs break-all text-muted">
              {asal}
              {t.path}
            </p>

            {!t.isActive && (
              <p className="mt-2 text-xs text-danger">Meja dinonaktifkan</p>
            )}

            <div className="mt-3 flex flex-wrap justify-center gap-2 print:hidden">
              <button
                type="button"
                disabled={sibuk === t.id}
                onClick={() =>
                  jalankan(
                    t.id,
                    () =>
                      request(`/api/admin/tables/${t.id}/regenerate`, {
                        method: "POST",
                      }),
                    `Kode meja ${t.number} diganti. Stiker lama sudah tidak berlaku.`,
                  )
                }
                className="rounded-lg border border-border px-2.5 py-1 text-xs disabled:opacity-50"
              >
                Ganti kode
              </button>

              <button
                type="button"
                disabled={sibuk === t.id}
                onClick={() =>
                  jalankan(
                    t.id,
                    () =>
                      request(`/api/admin/tables/${t.id}/toggle`, {
                        method: "POST",
                      }),
                    `Meja ${t.number} ${t.isActive ? "dinonaktifkan" : "diaktifkan"}`,
                  )
                }
                className="rounded-lg border border-border px-2.5 py-1 text-xs disabled:opacity-50"
              >
                {t.isActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-muted print:hidden">
        Kalau stiker sebuah meja terlanjur difoto orang dan dipakai memesan dari
        luar, tekan <strong>Ganti kode</strong>. Kode lama langsung mati, dan
        stikernya perlu dicetak ulang.
      </p>
    </div>
  );
}
