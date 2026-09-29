/**
 * Pesan WhatsApp siap kirim untuk reservasi.
 *
 * Tidak ada integrasi WhatsApp di sini, dan itu disengaja. Yang dibuat cuma
 * tautan `wa.me` berisi pesan yang sudah terisi — admin membukanya, membaca
 * sekilas, lalu menekan kirim sendiri dari nomor kafe. Yang hilang dibanding
 * WhatsApp Business API cuma pengirimannya yang otomatis; yang didapat adalah
 * nol biaya, nol pendaftaran, dan tidak ada nomor yang berisiko diblokir.
 *
 * Nomor tamunya sudah dirapikan di server (`waNumber`), jadi di sini tinggal
 * dipakai. `waNumber` bernilai null berarti nomornya tidak bisa dihubungi dan
 * pemanggil wajib mematikan tombolnya.
 */

export type ReservasiPesan = {
  code: string;
  customerName: string;
  guestCount: number;
  startAt: string;
  endAt: string;
  table: { number: string } | null;
};

const jam = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const tanggalPanjang = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

/**
 * Baris ringkasan yang muncul di semua pesan, supaya tamu tidak perlu bertanya.
 *
 * Nomor mejanya bisa dilepas, dan itu dipakai pesan penolakan: menyebut
 * "meja 5" kepada orang yang justru tidak jadi mendapat meja itu cuma bikin
 * bingung.
 */
function ringkasan(r: ReservasiPesan, { pakaiMeja = true } = {}) {
  const meja = pakaiMeja && r.table ? `, meja ${r.table.number}` : "";

  return [
    tanggalPanjang(r.startAt),
    `${jam(r.startAt)}-${jam(r.endAt)}`,
    `${r.guestCount} orang${meja}`,
  ].join("\n");
}

export function pesanKonfirmasi(r: ReservasiPesan) {
  return [
    `Halo ${r.customerName}, reservasi ${r.code} atas namamu sudah kami konfirmasi.`,
    "",
    ringkasan(r),
    "",
    "Sampai ketemu. Kalau ada perubahan, balas pesan ini saja.",
  ].join("\n");
}

export function pesanTolak(r: ReservasiPesan, alasan?: string) {
  return [
    `Halo ${r.customerName}, mohon maaf permintaan reservasi ${r.code} belum bisa kami terima.`,
    "",
    ringkasan(r, { pakaiMeja: false }),
    "",
    ...(alasan?.trim() ? [`Alasannya: ${alasan.trim()}`, ""] : []),
    "Kalau berkenan, boleh coba jam atau tanggal lain lewat halaman reservasi kami.",
  ].join("\n");
}

export function pesanPengingat(r: ReservasiPesan) {
  return [
    `Halo ${r.customerName}, mengingatkan reservasi ${r.code} atas namamu.`,
    "",
    ringkasan(r),
    "",
    "Kalau berhalangan, balas pesan ini supaya mejanya bisa kami lepas untuk tamu lain.",
  ].join("\n");
}

/** Dipakai tamu dari halaman statusnya untuk menghubungi kafe. */
export function pesanTamuKeKafe(r: ReservasiPesan) {
  return [
    `Halo, saya mau menanyakan reservasi ${r.code} atas nama ${r.customerName}.`,
    "",
    ringkasan(r),
  ].join("\n");
}

/**
 * Tautan yang membuka WhatsApp dengan pesan sudah terisi.
 *
 * `wa.me` dipilih daripada `api.whatsapp.com` karena yang pertama membuka
 * aplikasi WhatsApp langsung di HP, sementara yang kedua sering mampir dulu ke
 * halaman web di browser.
 */
export function tautanWhatsapp(nomor: string, pesan: string) {
  return `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`;
}
