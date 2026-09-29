"use client";

import { formatWaktu } from "@/lib/client-api";
import { useApi } from "@/lib/use-api";
import { usePengaturanPublik } from "@/lib/use-settings";
import { pesanTamuKeKafe, tautanWhatsapp } from "@/lib/whatsapp";

type Reservasi = {
  code: string;
  customerName: string;
  phone: string;
  guestCount: number;
  startAt: string;
  endAt: string;
  tanggal: string;
  status: "PENDING" | "CONFIRMED" | "SEATED" | "DONE" | "CANCELLED" | "NO_SHOW";
  note: string | null;
  cancelReason: string | null;
  createdAt: string;
  table: { id: string; number: string } | null;
};

/** Yang dilihat tamu. SEATED ke atas sudah tidak perlu dia pantau. */
const TAHAPAN = [
  {
    status: "PENDING",
    label: "Permintaan terkirim",
    detail: "Menunggu kafe mengonfirmasi",
  },
  {
    status: "CONFIRMED",
    label: "Meja dipesan atas namamu",
    detail: "Datang beberapa menit sebelum jamnya",
  },
  { status: "SEATED", label: "Sudah duduk", detail: "Selamat menikmati" },
  { status: "DONE", label: "Selesai", detail: "Terima kasih!" },
] as const;

const jamSaja = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

const tanggalPanjang = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

export function ReservasiStatus({ code }: { code: string }) {
  const pengaturan = usePengaturanPublik();
  // Tamu cuma memantau satu reservasi, dan kafe tidak mengonfirmasi dalam
  // hitungan detik. Setengah menit sekali sudah lebih dari cukup.
  const { data: reservasi, error } = useApi<Reservasi>(
    `/api/reservations/${code}`,
    { refreshInterval: 30000 },
  );

  if (error) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <p className="font-medium text-danger">Reservasi tidak ditemukan</p>
        <p className="mt-1 text-sm text-muted">{error.message}</p>
      </div>
    );
  }

  if (!reservasi) {
    return <p className="mt-6 text-muted">Memuat…</p>;
  }

  // Kosong berarti pemilik belum mengisi nomor WhatsApp kafe di pengaturan.
  const nomorKafe = pengaturan.teks("toko.nomorWhatsapp", "");

  const indeks = TAHAPAN.findIndex((t) => t.status === reservasi.status);
  const gagal =
    reservasi.status === "CANCELLED" || reservasi.status === "NO_SHOW";

  return (
    <div className="mt-6">
      <p className="text-sm text-muted">Kode reservasi</p>
      <h1 className="font-mono text-3xl font-semibold tracking-tight">
        {reservasi.code}
      </h1>

      <p className="mt-1 text-sm text-muted">
        {tanggalPanjang(reservasi.startAt)} · {jamSaja(reservasi.startAt)}–
        {jamSaja(reservasi.endAt)} · {reservasi.guestCount} orang
      </p>

      <div className="mt-5 rounded-xl border border-border bg-surface p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Atas nama</dt>
          <dd>{reservasi.customerName}</dd>

          <dt className="text-muted">Meja</dt>
          <dd>
            {reservasi.table
              ? `Meja ${reservasi.table.number}`
              : "ditentukan kafe saat konfirmasi"}
          </dd>

          <dt className="text-muted">Dipesan</dt>
          <dd>{formatWaktu(reservasi.createdAt)}</dd>

          {reservasi.note && (
            <>
              <dt className="text-muted">Catatan</dt>
              <dd>{reservasi.note}</dd>
            </>
          )}
        </dl>
      </div>

      {gagal ? (
        <div className="mt-5 rounded-xl border border-border bg-surface p-5">
          <p className="font-medium text-danger">
            {reservasi.status === "CANCELLED"
              ? "Reservasi dibatalkan"
              : "Tercatat tidak datang"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {reservasi.cancelReason ??
              "Kalau ini keliru, hubungi kafe supaya diperbaiki."}
          </p>
        </div>
      ) : (
        <ol className="mt-6 space-y-1">
          {TAHAPAN.map((tahap, i) => {
            const lewat = i < indeks;
            const aktif = i === indeks;

            return (
              <li key={tahap.status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1 size-2.5 rounded-full ${
                      lewat || aktif ? "bg-accent" : "bg-border"
                    }`}
                  />
                  {i < TAHAPAN.length - 1 && (
                    <span
                      className={`w-px flex-1 ${lewat ? "bg-accent" : "bg-border"}`}
                    />
                  )}
                </div>

                <div className={`pb-5 ${aktif ? "" : "opacity-60"}`}>
                  <p className="font-medium">{tahap.label}</p>
                  <p className="text-sm text-muted">{tahap.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Tamu belum punya tombol batal sendiri, jadi ini jalan keluarnya
          kalau dia berhalangan — sekaligus supaya mejanya bisa dilepas. */}
      {nomorKafe && (
        <a
          href={tautanWhatsapp(nomorKafe, pesanTamuKeKafe(reservasi))}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 block rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium hover:border-accent"
        >
          Hubungi kafe lewat WhatsApp
        </a>
      )}

      <p className="mt-4 text-xs text-muted">
        Simpan kode ini. Halaman ini memperbarui sendiri tiap setengah menit.
        {nomorKafe
          ? " Kalau berhalangan, kabari kafe supaya mejanya bisa dilepas."
          : ""}
      </p>
    </div>
  );
}
