"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, request } from "@/lib/client-api";
import { useApi } from "@/lib/use-api";
import { usePengaturanPublik } from "@/lib/use-settings";

type Slot = {
  jam: string;
  sisaMeja: number;
  bisa: boolean;
  alasan: string | null;
};

type Ketersediaan = {
  tanggal: string;
  durasiMenit: number;
  jamBuka: string;
  jamTutup: string;
  maksHariKeDepan: number;
  kapasitasTerbesar: number;
  slot: Slot[];
};

/** Tanggal menurut jam dinding kafe (WIB), bukan jam browser tamu. */
function tanggalKafe(tambahHari = 0) {
  return new Date(Date.now() + (7 * 60 + tambahHari * 24 * 60) * 60_000)
    .toISOString()
    .slice(0, 10);
}

export default function BuatReservasiPage() {
  const router = useRouter();
  const pengaturan = usePengaturanPublik();

  const [tanggal, setTanggal] = useState(() => tanggalKafe());
  const [jumlahTamu, setJumlahTamu] = useState(2);
  const [jam, setJam] = useState("");
  const [nama, setNama] = useState("");
  const [hp, setHp] = useState("");
  const [catatan, setCatatan] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ketersediaan = useApi<Ketersediaan>(
    `/api/reservations/availability?tanggal=${tanggal}&guestCount=${jumlahTamu}`,
  );

  const data = ketersediaan.data;
  const slot = data?.slot ?? [];
  const adaYangKosong = slot.some((s) => s.bisa);

  // Jam yang sudah dipilih bisa jadi tidak berlaku lagi setelah tanggal atau
  // jumlah tamunya diubah, jadi validitasnya diperiksa ulang tiap render.
  const jamTerpilih = slot.find((s) => s.jam === jam && s.bisa) ? jam : "";

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setMengirim(true);
    setError(null);

    try {
      const hasil = await request<{ code: string }>("/api/reservations", {
        method: "POST",
        body: JSON.stringify({
          tanggal,
          jam: jamTerpilih,
          guestCount: jumlahTamu,
          customerName: nama.trim(),
          phone: hp.trim(),
          ...(catatan.trim() && { note: catatan.trim() }),
        }),
      });

      router.push(`/reservasi/${hasil.code}`);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Gagal mengirim permintaan reservasi",
      );
      setMengirim(false);
    }
  }

  // Kalau reservasi dimatikan pemilik, halamannya tetap ada tapi tidak
  // menawarkan apa pun — lebih baik daripada 404 untuk tautan yang mungkin
  // sudah terlanjur dibagikan.
  if (pengaturan.siap && !pengaturan.nyala("modul.reservasi")) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Reservasi sedang ditutup
        </h1>
        <p className="mt-2 text-sm text-muted">
          Kafe ini belum menerima pemesanan meja. Datang langsung saja — atau
          pesan dari meja begitu sampai.
        </p>
        <Link
          href="/menu"
          className="mt-6 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white"
        >
          Lihat menu
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Pesan meja
      </h1>
      <p className="mt-2 text-sm text-muted">
        {data
          ? `Kafe buka ${data.jamBuka}–${data.jamTutup}. Satu reservasi berlaku ${data.durasiMenit} menit.`
          : "Pilih tanggal, jumlah orang, lalu jamnya."}
      </p>

      <form onSubmit={kirim} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Tanggal</span>
            <input
              type="date"
              value={tanggal}
              min={tanggalKafe()}
              max={tanggalKafe(data?.maksHariKeDepan ?? 30)}
              required
              onChange={(e) => setTanggal(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Berapa orang</span>
            <input
              type="number"
              min={1}
              max={data?.kapasitasTerbesar || 50}
              value={jumlahTamu}
              required
              onChange={(e) => setJumlahTamu(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm tabular-nums"
            />
            {data !== undefined && data.kapasitasTerbesar > 0 && (
              <span className="mt-1 block text-xs text-muted">
                Meja terbesar di sini muat {data.kapasitasTerbesar} orang.
              </span>
            )}
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Jam mulai</legend>

          {ketersediaan.isLoading && (
            <p className="mt-2 text-sm text-muted">Mencari jam yang kosong…</p>
          )}

          {!ketersediaan.isLoading && slot.length === 0 && (
            <p className="mt-2 text-sm text-muted">
              Tidak ada jam yang bisa dipesan pada tanggal ini.
            </p>
          )}

          {!ketersediaan.isLoading && slot.length > 0 && !adaYangKosong && (
            <p className="mt-2 text-sm text-warning">
              Semua jam pada tanggal ini sudah penuh untuk {jumlahTamu} orang.
              Coba tanggal lain atau kurangi jumlah orangnya.
            </p>
          )}

          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slot.map((s) => {
              const dipilih = s.jam === jamTerpilih;

              return (
                <button
                  key={s.jam}
                  type="button"
                  disabled={!s.bisa}
                  title={s.alasan ?? `${s.sisaMeja} meja kosong`}
                  onClick={() => setJam(s.jam)}
                  className={`rounded-xl border px-2 py-2 text-sm tabular-nums transition disabled:cursor-not-allowed disabled:opacity-35 ${
                    dipilih
                      ? "border-accent bg-accent font-medium text-white"
                      : "border-border bg-surface hover:border-accent"
                  }`}
                >
                  {s.jam}
                  {s.bisa && s.sisaMeja <= 2 && !dipilih && (
                    <span className="block text-[11px] text-warning">
                      sisa {s.sisaMeja}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-sm font-medium">Nama</span>
          <input
            value={nama}
            required
            minLength={2}
            maxLength={60}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama yang dipanggil saat datang"
            className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Nomor HP</span>
          <input
            value={hp}
            required
            inputMode="tel"
            minLength={8}
            maxLength={20}
            onChange={(e) => setHp(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            Dipakai kafe kalau ada perubahan mendadak.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Catatan <span className="font-normal text-muted">(opsional)</span>
          </span>
          <input
            value={catatan}
            maxLength={200}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Ulang tahun, butuh kursi bayi, dan sebagainya"
            className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={mengirim || !jamTerpilih}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {mengirim
            ? "Mengirim…"
            : jamTerpilih
              ? `Pesan meja jam ${jamTerpilih}`
              : "Pilih jam dulu"}
        </button>

        <p className="text-center text-xs text-muted">
          Mejanya langsung disisihkan begitu permintaan ini masuk, jadi tidak
          bisa diambil orang lain sambil menunggu kafe mengonfirmasi. Kamu akan
          dapat kode untuk memantau statusnya.
        </p>
      </form>
    </main>
  );
}
