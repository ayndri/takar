"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { PageHead, SearchBox } from "@/components/ui/toolbar";
import { ApiError, request } from "@/lib/client-api";
import { useOrigin } from "@/lib/origin";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/use-api";

type Meja = {
  id: string;
  number: string;
  qrToken: string;
  isActive: boolean;
  path: string;
};

export default function MejaPage() {
  const session = useSession();
  const pemilik = session?.user?.role === "OWNER";

  const { data, error, isLoading, mutate } = useApi<Meja[]>("/api/admin/tables");
  const [qr, setQr] = useState<Record<string, string>>({});
  const [kata, setKata] = useState("");
  const [nomorBaru, setNomorBaru] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [formTerbuka, setFormTerbuka] = useState(false);

  const asal = useOrigin();
  const tables = useMemo(() => data ?? [], [data]);

  const tersaring = tables.filter((t) =>
    `meja ${t.number}`.includes(kata.trim().toLowerCase()),
  );

  const dibuka = tables.find((t) => t.id === openId);

  useEffect(() => {
    if (!asal || tables.length === 0) return;

    let aktif = true;

    Promise.all(
      tables.map(async (t) => {
        const gambar = await QRCode.toDataURL(`${asal}${t.path}`, {
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

  async function jalankan(
    id: string,
    jalur: () => Promise<unknown>,
    sukses: string,
  ) {
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
      setFormTerbuka(false);
      await mutate();
      setPesan(`Meja ${nomorBaru.trim()} ditambahkan`);
    } catch (e) {
      setPesan(e instanceof ApiError ? e.message : "Gagal menambah meja");
    }
  }

  const aktif = tables.filter((t) => t.isActive);

  return (
    <div>
      <div className="print:hidden">
        <PageHead
          judul="Meja & QR"
          deskripsi="Cetak kode ini dan tempel di mejanya. Yang memindainya langsung terisi nomor mejanya."
          aksi={
            <div className="flex gap-2">
              {pemilik && (
                <button
                  type="button"
                  onClick={() => setFormTerbuka(true)}
                  className="rounded-lg border border-border px-4 py-2 text-sm"
                >
                  Tambah meja
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-ink"
              >
                Cetak semua
              </button>
            </div>
          }
        />

        <StatRow>
          <StatCard
            label="Jumlah meja"
            nilai={isLoading ? "…" : String(tables.length)}
          />
          <StatCard
            label="Meja aktif"
            nilai={isLoading ? "…" : String(aktif.length)}
            catatan={`${tables.length - aktif.length} dinonaktifkan`}
          />
          <StatCard
            label="Kode siap cetak"
            nilai={String(Object.keys(qr).length)}
            catatan="dibuat di perangkat ini"
          />
        </StatRow>

        <div className="mb-4">
          <SearchBox
            nilai={kata}
            onChange={setKata}
            placeholder="Cari nomor meja…"
          />
        </div>

        {(error || pesan) && (
          <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm">
            {pesan ?? error?.message}
          </p>
        )}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tersaring.map((t) => (
          <li
            key={t.id}
            className={`rounded-xl border border-border bg-surface p-4 text-center ${
              t.isActive ? "" : "opacity-60"
            }`}
          >
            <p className="font-display text-xl font-semibold">Meja {t.number}</p>

            <button
              type="button"
              onClick={() => setOpenId(t.id)}
              className="mx-auto mt-3 block aspect-square w-full max-w-[180px] rounded-lg bg-white p-2 print:pointer-events-none"
              title={`Perbesar kode QR meja ${t.number}`}
            >
              {qr[t.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr[t.id]}
                  alt={`Kode QR meja ${t.number}`}
                  className="size-full"
                />
              ) : (
                <span className="grid size-full place-items-center text-xs text-muted">
                  Menyiapkan kode…
                </span>
              )}
            </button>

            <p className="mt-3 text-xs break-all text-muted">
              {asal}
              {t.path}
            </p>

            {!t.isActive && (
              <p className="mt-2 text-xs text-danger">Meja dinonaktifkan</p>
            )}
          </li>
        ))}
      </ul>

      {!isLoading && tersaring.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted print:hidden">
          Tidak ada meja yang cocok.
        </p>
      )}

      {dibuka && (
        <Modal
          judul={`Meja ${dibuka.number}`}
          deskripsi="Pelanggan yang memindai kode ini langsung terisi nomor mejanya."
          onClose={() => setOpenId(null)}
        >
          <div className="mx-auto aspect-square w-full max-w-xs rounded-lg bg-white p-3">
            {qr[dibuka.id] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr[dibuka.id]}
                alt={`Kode QR meja ${dibuka.number}`}
                className="size-full"
              />
            )}
          </div>

          <p className="mt-4 text-center text-sm break-all text-muted">
            {asal}
            {dibuka.path}
          </p>

          {pemilik && (
            <div className="mt-5 space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Ganti kode</p>
                  <p className="text-sm text-muted">
                    Untuk stiker yang terlanjur difoto orang. Kode lama langsung
                    mati.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={sibuk === dibuka.id}
                  onClick={() =>
                    jalankan(
                      dibuka.id,
                      () =>
                        request(`/api/admin/tables/${dibuka.id}/regenerate`, {
                          method: "POST",
                        }),
                      `Kode meja ${dibuka.number} diganti. Stiker lama tidak berlaku lagi.`,
                    )
                  }
                  className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Ganti kode
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {dibuka.isActive ? "Nonaktifkan meja" : "Aktifkan meja"}
                  </p>
                  <p className="text-sm text-muted">
                    Meja nonaktif tidak muncul di pilihan pelanggan.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={sibuk === dibuka.id}
                  onClick={() =>
                    jalankan(
                      dibuka.id,
                      () =>
                        request(`/api/admin/tables/${dibuka.id}/toggle`, {
                          method: "POST",
                        }),
                      `Meja ${dibuka.number} ${
                        dibuka.isActive ? "dinonaktifkan" : "diaktifkan"
                      }`,
                    )
                  }
                  className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {dibuka.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {formTerbuka && (
        <Modal
          judul="Tambah meja"
          deskripsi="Nomor bebas: boleh angka, boleh seperti A1 atau Teras 2."
          onClose={() => setFormTerbuka(false)}
        >
          <form onSubmit={tambahMeja} className="flex flex-wrap gap-2">
            <input
              value={nomorBaru}
              onChange={(e) => setNomorBaru(e.target.value)}
              required
              autoFocus
              placeholder="Nomor meja"
              className="min-w-0 flex-1 rounded-xl border border-border bg-paper px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white"
            >
              Tambah
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
