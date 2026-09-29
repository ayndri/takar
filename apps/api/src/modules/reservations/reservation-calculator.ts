/**
 * Hitungan jadwal reservasi — tanpa database, tanpa Express.
 * Semua fungsi di sini murni, supaya bisa diuji tanpa menyiapkan apa pun.
 *
 * Satu hal yang perlu dipegang: jam di sini selalu jam dinding kafe, bukan
 * jam server. Server bisa jalan di UTC dan Neon menyimpan UTC, tapi "buka
 * jam sembilan" yang dimaksud pemilik adalah jam sembilan di kafenya. Kalau
 * dibiarkan memakai zona waktu server, jam buka di produksi bergeser tujuh
 * jam tanpa ada yang mengubah apa pun.
 *
 * Karena itu tiap fungsi yang menyentuh jam menerima `zonaMenit`, dan semua
 * Date yang keluar-masuk tetap berupa titik waktu UTC.
 */

/** WIB. Satu angka, bukan nama zona, supaya tidak bergantung basis data zona sistem. */
export const ZONA_KAFE_MENIT = 7 * 60

const SEHARI_MENIT = 24 * 60
const MENIT_MS = 60_000

/** "09:30" → 570. Melempar kalau bentuknya bukan HH:MM. */
export function menitJam(jam: string): number {
  const cocok = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(jam)
  if (!cocok) throw new Error(`Jam harus berformat HH:MM, dapat "${jam}"`)

  return Number(cocok[1]) * 60 + Number(cocok[2])
}

/** 570 → "09:30". */
export function jamMenit(menit: number): string {
  const m = ((menit % SEHARI_MENIT) + SEHARI_MENIT) % SEHARI_MENIT
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Gabungkan tanggal dan jam kafe jadi satu titik waktu UTC.
 * buatWaktu('2026-09-20', '19:00', 420) → 2026-09-20T12:00:00Z
 */
export function buatWaktu(tanggal: string, jam: string, zonaMenit = ZONA_KAFE_MENIT): Date {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal)
  if (!cocok) throw new Error(`Tanggal harus berformat YYYY-MM-DD, dapat "${tanggal}"`)

  const utc = Date.UTC(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]))
  return new Date(utc + (menitJam(jam) - zonaMenit) * MENIT_MS)
}

/** Menit sejak tengah malam menurut jam dinding kafe. */
export function menitLokal(waktu: Date, zonaMenit = ZONA_KAFE_MENIT): number {
  const geser = new Date(waktu.getTime() + zonaMenit * MENIT_MS)
  return geser.getUTCHours() * 60 + geser.getUTCMinutes()
}

/** Tanggal menurut jam dinding kafe, "YYYY-MM-DD". */
export function tanggalLokal(waktu: Date, zonaMenit = ZONA_KAFE_MENIT): string {
  return new Date(waktu.getTime() + zonaMenit * MENIT_MS).toISOString().slice(0, 10)
}

export function akhirReservasi(mulai: Date, durasiMenit: number): Date {
  if (durasiMenit <= 0) throw new Error('Durasi reservasi harus lebih dari nol')
  return new Date(mulai.getTime() + durasiMenit * MENIT_MS)
}

/**
 * Apakah dua rentang waktu bertabrakan.
 *
 * Ujungnya sengaja tidak dihitung bertabrakan: reservasi 17:00–18:30 dan
 * 18:30–20:00 boleh berdampingan di meja yang sama. Kalau `>=` yang dipakai,
 * meja jadi kosong satu slot tanpa alasan.
 */
export function bertumpuk(aMulai: Date, aSelesai: Date, bMulai: Date, bSelesai: Date): boolean {
  return aMulai < bSelesai && aSelesai > bMulai
}

/**
 * Jam-jam mulai yang bisa dipilih tamu pada satu hari.
 *
 * Yang dipakai sebagai batas adalah jam selesainya, bukan jam mulainya:
 * kafe tutup 21:00 dengan durasi 90 menit berarti slot terakhir 19:30, bukan
 * 21:00. Tanpa ini tamu terakhir baru mau duduk saat lampu dimatikan.
 */
export function slotHarian(opsi: {
  jamBuka: string
  jamTutup: string
  durasiMenit: number
  /** Jarak antar pilihan jam. Bawaannya tiap setengah jam. */
  langkahMenit?: number
}): string[] {
  const buka = menitJam(opsi.jamBuka)
  const tutup = menitJam(opsi.jamTutup)
  const langkah = opsi.langkahMenit ?? 30

  if (langkah <= 0) throw new Error('Langkah slot harus lebih dari nol')
  if (opsi.durasiMenit <= 0) throw new Error('Durasi reservasi harus lebih dari nol')

  const slot: string[] = []
  for (let m = buka; m + opsi.durasiMenit <= tutup; m += langkah) {
    slot.push(jamMenit(m))
  }

  return slot
}

/**
 * Alasan kenapa sebuah waktu tidak bisa dipesan, atau null kalau boleh.
 *
 * Dikembalikan sebagai kalimat siap tampil, bukan kode, karena satu-satunya
 * yang membacanya adalah tamu yang salah pilih jam.
 */
export function alasanWaktuDitolak(opsi: {
  mulai: Date
  durasiMenit: number
  jamBuka: string
  jamTutup: string
  maksHariKeDepan: number
  sekarang: Date
  zonaMenit?: number
}): string | null {
  const zona = opsi.zonaMenit ?? ZONA_KAFE_MENIT
  const selesai = akhirReservasi(opsi.mulai, opsi.durasiMenit)

  if (opsi.mulai <= opsi.sekarang) {
    return 'Jam yang dipilih sudah lewat'
  }

  const buka = menitJam(opsi.jamBuka)
  const tutup = menitJam(opsi.jamTutup)
  const mulaiMenit = menitLokal(opsi.mulai, zona)

  if (mulaiMenit < buka) {
    return `Kafe baru buka jam ${opsi.jamBuka}`
  }

  // Dibandingkan sebagai menit sejak tengah malam hari mulai, supaya
  // reservasi yang melewati tengah malam ikut ketahuan lewat jam tutup.
  const selesaiMenit =
    mulaiMenit +
    Math.round((selesai.getTime() - opsi.mulai.getTime()) / MENIT_MS)

  if (selesaiMenit > tutup) {
    return `Reservasi harus selesai sebelum jam ${opsi.jamTutup}, jadi jam mulai paling akhir ${jamMenit(tutup - opsi.durasiMenit)}`
  }

  const batas = new Date(opsi.sekarang.getTime() + opsi.maksHariKeDepan * SEHARI_MENIT * MENIT_MS)
  if (opsi.mulai > batas) {
    return `Reservasi paling jauh ${opsi.maksHariKeDepan} hari dari sekarang`
  }

  return null
}

export type MejaKandidat = { id: string; number: string; capacity: number }

/**
 * Meja terbaik untuk sejumlah tamu.
 *
 * Yang dipilih adalah meja terkecil yang masih muat. Memberi rombongan dua
 * orang meja delapan memang tidak salah secara aturan, tapi meja besarnya
 * jadi tidak tersedia untuk rombongan besar yang datang kemudian.
 */
export function pilihMejaTerbaik(
  kandidat: MejaKandidat[],
  jumlahTamu: number,
): MejaKandidat | null {
  const muat = kandidat.filter((m) => m.capacity >= jumlahTamu)
  if (muat.length === 0) return null

  return muat.reduce((terbaik, m) =>
    m.capacity < terbaik.capacity ||
    (m.capacity === terbaik.capacity && m.number.localeCompare(terbaik.number, 'id') < 0)
      ? m
      : terbaik,
  )
}
