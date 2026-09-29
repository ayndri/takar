"use client";

import { useState } from "react";
import { Select } from "@/components/select";
import { JagaModul } from "@/components/ui/fitur-mati";
import { Modal } from "@/components/ui/modal";
import { SortHeader } from "@/components/ui/sort-header";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { PageHead, SearchBox, TablePager } from "@/components/ui/toolbar";
import { ApiError, formatWaktu, request } from "@/lib/client-api";
import { useTable } from "@/lib/use-table";
import { useApi } from "@/lib/use-api";
import {
  pesanKonfirmasi,
  pesanPengingat,
  pesanTolak,
  tautanWhatsapp,
} from "@/lib/whatsapp";

type Reservasi = {
  id: string;
  code: string;
  customerName: string;
  phone: string;
  /** Nomor yang sama dalam bentuk yang diterima wa.me, null kalau tidak sah. */
  waNumber: string | null;
  guestCount: number;
  startAt: string;
  endAt: string;
  tanggal: string;
  status: string;
  note: string | null;
  cancelReason: string | null;
  createdAt: string;
  table: { id: string; number: string } | null;
};

type CafeTable = { id: string; number: string };

const STATUS = {
  PENDING: { label: "Menunggu", kelas: "bg-warning/15 text-warning" },
  CONFIRMED: { label: "Dikonfirmasi", kelas: "bg-accent-soft text-accent-ink" },
  SEATED: { label: "Sudah duduk", kelas: "bg-accent-soft text-accent-ink" },
  DONE: { label: "Selesai", kelas: "bg-sunk text-muted" },
  CANCELLED: { label: "Dibatalkan", kelas: "bg-sunk text-muted" },
  NO_SHOW: { label: "Tidak datang", kelas: "bg-danger/15 text-danger" },
} as const;

/**
 * Tombol yang ditawarkan di tiap status.
 *
 * Ini cuma soal tampilan — yang benar-benar menjaga urutannya adalah
 * setReservationStatus() di server, yang menolak lompatan status walau
 * tombolnya berhasil ditekan dua kali.
 */
const AKSI: Record<string, { status: string; label: string; utama?: boolean }[]> = {
  PENDING: [
    { status: "CONFIRMED", label: "Konfirmasi", utama: true },
    { status: "CANCELLED", label: "Tolak" },
  ],
  CONFIRMED: [
    { status: "SEATED", label: "Tamu datang", utama: true },
    { status: "NO_SHOW", label: "Tidak datang" },
    { status: "CANCELLED", label: "Batalkan" },
  ],
  SEATED: [{ status: "DONE", label: "Selesai", utama: true }],
  DONE: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const jamSaja = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

/** Tanggal hari ini menurut jam dinding kafe (WIB), bukan jam browser. */
function hariIniKafe() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function ReservasiPage() {
  return (
    <JagaModul kunci="modul.reservasi">
      <IsiReservasi />
    </JagaModul>
  );
}

function IsiReservasi() {
  const [tanggal, setTanggal] = useState("");
  const [status, setStatus] = useState("");

  const kueri = new URLSearchParams();
  if (tanggal) kueri.set("tanggal", tanggal);
  if (status) kueri.set("status", status);

  const daftar = useApi<Reservasi[]>(
    `/api/admin/reservations${kueri.toString() ? `?${kueri}` : ""}`,
  );
  const meja = useApi<CafeTable[]>("/api/tables");

  const [detail, setDetail] = useState<Reservasi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  /**
   * Pesan WhatsApp yang ditawarkan setelah status diubah.
   *
   * Sengaja tidak dibuka otomatis: membuka tab baru setelah `await` hampir
   * selalu diblokir browser karena sudah lepas dari klik yang memicunya. Jadi
   * tombolnya ditampilkan, dan admin yang menekannya — sekalian memberi
   * kesempatan membaca dulu sebelum mengirim.
   */
  const [kabar, setKabar] = useState<{ label: string; pesan: string } | null>(
    null,
  );

  function bukaDetail(r: Reservasi | null) {
    setError(null);
    setKabar(null);
    setDetail(r);
  }

  const rows = daftar.data ?? [];
  const hariIni = hariIniKafe();

  const tabel = useTable(rows, {
    cari: (r) => [r.code, r.customerName, r.phone, r.table?.number, r.note],
    perHalaman: 10,
    kolom: {
      waktu: (r) => new Date(r.startAt),
      kode: (r) => r.code,
      tamu: (r) => r.customerName,
      jumlah: (r) => r.guestCount,
      meja: (r) => (r.table ? Number(r.table.number) || r.table.number : null),
      status: (r) => STATUS[r.status as keyof typeof STATUS]?.label ?? r.status,
    },
    urutanAwal: { kolom: "waktu", arah: "naik" },
  });

  const reservasiHariIni = rows.filter((r) => r.tanggal === hariIni);
  const menunggu = rows.filter((r) => r.status === "PENDING");
  const tamuHariIni = reservasiHariIni
    .filter((r) => r.status === "CONFIRMED" || r.status === "SEATED")
    .reduce((s, r) => s + r.guestCount, 0);
  const tidakDatang = rows.filter((r) => r.status === "NO_SHOW").length;

  async function ubahStatus(r: Reservasi, statusBaru: string) {
    const menolak = statusBaru === "CANCELLED" && r.status === "PENDING";
    let alasan = "";

    if (statusBaru === "CANCELLED") {
      const jawaban = window.prompt(
        menolak
          ? "Alasan penolakan (boleh dikosongkan)"
          : "Alasan pembatalan (boleh dikosongkan)",
      );

      // Menekan Batal di pop-up berarti urung, bukan lanjut tanpa alasan.
      if (jawaban === null) return;
      alasan = jawaban;
    }

    setSibuk(true);
    setError(null);
    setKabar(null);

    try {
      await request(`/api/admin/reservations/${r.id}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: statusBaru,
          ...(alasan.trim() && { reason: alasan.trim() }),
        }),
      });

      // Pop-up sengaja tidak ditutup: kabar ke tamu ditawarkan di dalamnya.
      const segar = await daftar.mutate();
      const baru = segar?.find((x) => x.id === r.id) ?? null;
      setDetail(baru);

      if (baru?.waNumber) {
        if (statusBaru === "CONFIRMED") {
          setKabar({
            label: "Sudah dikonfirmasi. Kabari tamunya:",
            pesan: pesanKonfirmasi(baru),
          });
        } else if (statusBaru === "CANCELLED") {
          setKabar({
            label: menolak
              ? "Permintaan ditolak. Kabari tamunya:"
              : "Reservasi dibatalkan. Kabari tamunya:",
            pesan: pesanTolak(baru, alasan),
          });
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mengubah status");
    } finally {
      setSibuk(false);
    }
  }

  async function pindahMeja(r: Reservasi, tableId: string) {
    setSibuk(true);
    setError(null);

    try {
      await request(`/api/admin/reservations/${r.id}/table`, {
        method: "POST",
        body: JSON.stringify({ tableId }),
      });

      const segar = await daftar.mutate();
      setDetail(segar?.find((x) => x.id === r.id) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal memindahkan meja");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div>
      <PageHead
        judul="Reservasi"
        deskripsi="Meja yang dipesan sebelum tamu datang. Satu meja tidak bisa dipesan dua kali pada jam yang bertabrakan."
      />

      <StatRow>
        <StatCard
          label="Reservasi hari ini"
          nilai={daftar.isLoading ? "…" : String(reservasiHariIni.length)}
        />
        <StatCard
          label="Menunggu konfirmasi"
          nilai={daftar.isLoading ? "…" : String(menunggu.length)}
          nada={menunggu.length > 0 ? "sorot" : "netral"}
          catatan={menunggu.length > 0 ? "perlu ditindaklanjuti" : undefined}
        />
        <StatCard
          label="Tamu diharapkan hari ini"
          nilai={daftar.isLoading ? "…" : String(tamuHariIni)}
          catatan="dari reservasi yang sudah dikonfirmasi"
        />
        <StatCard
          label="Tidak datang"
          nilai={daftar.isLoading ? "…" : String(tidakDatang)}
          nada={tidakDatang > 0 ? "rugi" : "netral"}
          catatan="dalam daftar yang tampil"
        />
      </StatRow>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchBox
          nilai={tabel.kata}
          onChange={tabel.setKata}
          placeholder="Cari kode, nama, HP, atau meja…"
        />

        <input
          type="date"
          value={tanggal}
          aria-label="Saring tanggal"
          onChange={(e) => setTanggal(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />

        <div className="w-44">
          <Select
            value={status}
            aria-label="Saring status"
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Semua status</option>
            {Object.entries(STATUS).map(([nilai, s]) => (
              <option key={nilai} value={nilai}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        {(tanggal || status) && (
          <button
            type="button"
            onClick={() => {
              setTanggal("");
              setStatus("");
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted"
          >
            Bersihkan saringan
          </button>
        )}

        <button
          type="button"
          onClick={() => setTanggal(hariIni)}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          Hari ini
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <SortHeader
                label="Waktu"
                kolom="waktu"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Kode"
                kolom="kode"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Tamu"
                kolom="tamu"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Orang"
                kolom="jumlah"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Meja"
                kolom="meja"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Status"
                kolom="status"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {daftar.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Memuat reservasi…
                </td>
              </tr>
            )}

            {!daftar.isLoading && tabel.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  {rows.length === 0
                    ? "Belum ada reservasi."
                    : "Tidak ada reservasi yang cocok."}
                </td>
              </tr>
            )}

            {tabel.items.map((r) => {
              const s = STATUS[r.status as keyof typeof STATUS];

              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="tabular-nums">{jamSaja(r.startAt)}</span>
                    <span className="ml-2 text-muted">{r.tanggal}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">
                    {r.customerName}
                    <span className="block text-xs text-muted">{r.phone}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.guestCount}
                  </td>
                  <td className="px-4 py-3">
                    {r.table ? (
                      `Meja ${r.table.number}`
                    ) : (
                      <span className="text-muted">belum ditentukan</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${s?.kelas ?? "bg-sunk text-muted"}`}
                    >
                      {s?.label ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => bukaDetail(r)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs hover:border-accent"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePager
        halaman={tabel.halaman}
        halamanTotal={tabel.halamanTotal}
        awal={tabel.awal}
        akhir={tabel.akhir}
        total={tabel.total}
        satuan="reservasi"
        onGanti={tabel.setHalaman}
      />

      {detail && (
        <Modal
          judul={`${detail.code} · ${detail.customerName}`}
          deskripsi={`${detail.tanggal} · ${jamSaja(detail.startAt)}–${jamSaja(detail.endAt)} · ${detail.guestCount} orang`}
          onClose={() => bukaDetail(null)}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted">Nomor HP</dt>
            <dd>
              {detail.phone}
              {detail.waNumber ? (
                <a
                  href={tautanWhatsapp(
                    detail.waNumber,
                    pesanPengingat(detail),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted hover:border-accent hover:text-ink"
                >
                  Ingatkan lewat WhatsApp
                </a>
              ) : (
                <span className="ml-2 text-xs text-warning">
                  nomor tidak bisa dihubungi lewat WhatsApp
                </span>
              )}
            </dd>

            <dt className="text-muted">Meja</dt>
            <dd>
              {detail.table ? `Meja ${detail.table.number}` : "belum ditentukan"}
            </dd>

            <dt className="text-muted">Status</dt>
            <dd>
              {STATUS[detail.status as keyof typeof STATUS]?.label ??
                detail.status}
            </dd>

            <dt className="text-muted">Dipesan</dt>
            <dd>{formatWaktu(detail.createdAt)}</dd>

            {detail.note && (
              <>
                <dt className="text-muted">Catatan</dt>
                <dd>{detail.note}</dd>
              </>
            )}

            {detail.cancelReason && (
              <>
                <dt className="text-muted">Alasan batal</dt>
                <dd>{detail.cancelReason}</dd>
              </>
            )}
          </dl>

          {(AKSI[detail.status]?.length ?? 0) > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-sm text-muted">Pindahkan ke meja lain</p>
              <Select
                value={detail.table?.id ?? ""}
                aria-label="Pindahkan ke meja lain"
                disabled={sibuk}
                onChange={(e) => {
                  if (e.target.value) pindahMeja(detail, e.target.value);
                }}
              >
                <option value="">Pilih meja…</option>
                {(meja.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    Meja {m.number}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          {kabar && detail.waNumber && (
            <div className="mt-5 rounded-xl border border-accent/40 bg-accent-soft/40 p-4">
              <p className="text-sm font-medium">{kabar.label}</p>
              <p className="mt-2 whitespace-pre-line rounded-lg border border-border bg-surface p-3 text-xs text-muted">
                {kabar.pesan}
              </p>
              <a
                href={tautanWhatsapp(detail.waNumber, kabar.pesan)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                Buka WhatsApp
              </a>
              <p className="mt-2 text-xs text-muted">
                Pesannya masih bisa kamu ubah di WhatsApp sebelum dikirim.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            {(AKSI[detail.status] ?? []).map((a) => (
              <button
                key={a.status}
                type="button"
                disabled={sibuk}
                onClick={() => ubahStatus(detail, a.status)}
                className={`rounded-xl px-4 py-2 text-sm disabled:opacity-50 ${
                  a.utama
                    ? "bg-accent font-medium text-white"
                    : "border border-border"
                }`}
              >
                {a.label}
              </button>
            ))}

            {(AKSI[detail.status]?.length ?? 0) === 0 && (
              <p className="text-sm text-muted">
                Reservasi ini sudah selesai — tidak ada lagi yang bisa diubah.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
