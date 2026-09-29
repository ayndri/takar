"use client";

import { useState } from "react";
import { PageHead } from "@/components/ui/toolbar";
import { ApiError, request } from "@/lib/client-api";
import { useSession } from "@/lib/session";
import {
  usePengaturan,
  type SettingGrup,
  type SettingItem,
  type SettingsResponse,
} from "@/lib/use-settings";

const URUTAN_GRUP: SettingGrup[] = ["modul", "toko", "reservasi"];

/** Sakelar hidup/mati. Tombolnya sendiri, bukan checkbox bawaan. */
function Sakelar({
  nyala,
  matiPaksa,
  onUbah,
  label,
}: {
  nyala: boolean;
  matiPaksa: boolean;
  onUbah: (nilai: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={nyala && !matiPaksa}
      aria-label={label}
      disabled={matiPaksa}
      onClick={() => onUbah(!nyala)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
        nyala && !matiPaksa ? "bg-accent" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-surface transition-all ${
          nyala && !matiPaksa ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function PengaturanPage() {
  const session = useSession();
  const pemilik = session?.user?.role === "OWNER";

  const { data, isLoading, mutate } = usePengaturan();

  /** Perubahan yang belum disimpan, ditumpuk dulu supaya bisa satu kali kirim. */
  const [draf, setDraf] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const items = data?.items ?? [];
  const nilaiSekarang = (item: SettingItem) => draf[item.kunci] ?? item.nilai;

  const induk = (item: SettingItem) =>
    item.butuh ? items.find((i) => i.kunci === item.butuh) : undefined;

  /**
   * Apakah induknya sedang mati menurut layar ini — termasuk perubahan yang
   * belum disimpan. Dihitung dari draf, bukan dari jawaban server, supaya
   * mematikan "Meja & QR" langsung meredupkan "Wajib pilih meja" tanpa perlu
   * menyimpan dulu.
   */
  const indukMati = (item: SettingItem) => {
    const atas = induk(item);
    return atas !== undefined && nilaiSekarang(atas) !== "true";
  };

  function ubah(kunci: string, nilai: string) {
    setPesan(null);
    setDraf((lama) => {
      const asli = items.find((i) => i.kunci === kunci)?.nilai;
      const berikut = { ...lama, [kunci]: nilai };

      // Dikembalikan ke nilai semula berarti bukan perubahan lagi.
      if (asli === nilai) delete berikut[kunci];
      return berikut;
    });
  }

  async function simpan() {
    setSaving(true);
    setError(null);
    setPesan(null);

    try {
      const hasil = await request<SettingsResponse>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(draf),
      });

      await mutate(hasil, { revalidate: false });
      setDraf({});
      setPesan("Pengaturan tersimpan.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  }

  const jumlahUbahan = Object.keys(draf).length;

  if (!pemilik) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold">Halaman khusus pemilik</h1>
        <p className="mt-2 text-sm text-muted">
          Mematikan modul mengubah apa yang bisa dikerjakan semua orang di
          kafe, jadi yang boleh menyentuhnya hanya pemilik.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        judul="Pengaturan"
        deskripsi="Matikan yang tidak dipakai. Modul yang dimatikan hilang dari menu dan endpoint-nya ikut ditolak — datanya tetap utuh."
      />

      {isLoading && <p className="text-muted">Memuat pengaturan…</p>}

      <div className="space-y-6">
        {URUTAN_GRUP.map((grup) => {
          const isi = items.filter((i) => i.grup === grup);
          if (isi.length === 0) return null;

          const judul = data?.grup[grup];

          return (
            <section
              key={grup}
              className="rounded-xl border border-border bg-surface"
            >
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold">{judul?.judul ?? grup}</h2>
                {judul?.keterangan && (
                  <p className="mt-1 text-sm text-muted">{judul.keterangan}</p>
                )}
              </div>

              <ul>
                {isi.map((item) => {
                  const terkunci = indukMati(item);
                  const nilai = nilaiSekarang(item);
                  const berubah = draf[item.kunci] !== undefined;

                  return (
                    <li
                      key={item.kunci}
                      className={`flex items-start gap-4 border-b border-border px-5 py-4 last:border-0 ${
                        terkunci ? "opacity-60" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {item.label}
                          {berubah && (
                            <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-normal text-accent-ink">
                              belum disimpan
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-sm text-muted">
                          {item.keterangan}
                        </p>
                        {terkunci && (
                          <p className="mt-1 text-xs text-warning">
                            Tidak berlaku selama{" "}
                            {induk(item)?.label ?? "modul induknya"} dimatikan.
                          </p>
                        )}
                      </div>

                      {item.tipe === "boolean" ? (
                        <Sakelar
                          label={item.label}
                          nyala={nilai === "true"}
                          matiPaksa={terkunci}
                          onUbah={(v) => ubah(item.kunci, String(v))}
                        />
                      ) : item.tipe === "teks" ? (
                        <input
                          type="text"
                          value={nilai}
                          disabled={terkunci}
                          aria-label={item.label}
                          placeholder={item.contoh}
                          onChange={(e) => ubah(item.kunci, e.target.value)}
                          className="w-44 shrink-0 rounded-xl border border-border bg-paper px-3 py-2 text-sm disabled:opacity-40"
                        />
                      ) : item.tipe === "jam" ? (
                        <input
                          type="time"
                          value={nilai}
                          disabled={terkunci}
                          aria-label={item.label}
                          onChange={(e) => ubah(item.kunci, e.target.value)}
                          className="w-28 shrink-0 rounded-xl border border-border bg-paper px-3 py-2 text-sm disabled:opacity-40"
                        />
                      ) : (
                        <input
                          type="number"
                          value={nilai}
                          min={item.min}
                          max={item.maks}
                          disabled={terkunci}
                          aria-label={item.label}
                          onChange={(e) => ubah(item.kunci, e.target.value)}
                          className="w-24 shrink-0 rounded-xl border border-border bg-paper px-3 py-2 text-sm tabular-nums disabled:opacity-40"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {pesan && <p className="mt-4 text-sm text-muted">{pesan}</p>}

      {/* Menempel di bawah supaya tidak perlu menggulir balik setelah mengubah
          sakelar yang jauh di bawah. */}
      {jumlahUbahan > 0 && (
        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-surface p-4 shadow-lg">
          <p className="text-sm">
            {jumlahUbahan} pengaturan diubah tapi belum disimpan.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraf({});
                setError(null);
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              Batalkan
            </button>
            <button
              type="button"
              onClick={simpan}
              disabled={saving}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
