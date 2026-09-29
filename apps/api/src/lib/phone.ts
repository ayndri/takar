/**
 * Nomor telepon untuk tautan WhatsApp.
 *
 * Orang menulis nomornya dengan bentuk yang macam-macam: `08123456789`,
 * `+62 812-3456-789`, `0812 3456 7890`. WhatsApp cuma menerima satu bentuk —
 * angka saja dengan kode negara di depan, tanpa `+`, tanpa spasi, tanpa strip.
 *
 * Yang disimpan di database tetap apa adanya seperti yang diketik tamu. Fungsi
 * ini cuma dipakai saat membuat tautannya, supaya catatan kafe tetap terbaca
 * seperti yang orang tulis sendiri.
 */

/** Panjang nomor internasional menurut E.164, dipakai sebagai saringan kasar. */
const MIN_DIGIT = 8
const MAKS_DIGIT = 15

const KODE_INDONESIA = '62'

/**
 * Ubah nomor apa adanya jadi bentuk yang diterima WhatsApp.
 * Mengembalikan null kalau nomornya tidak bisa diselamatkan — pemanggilnya
 * wajib mematikan tombol, bukan membuka WhatsApp ke nomor ngawur.
 *
 * nomorWhatsapp('0812 3456-789')  → '628123456789'
 * nomorWhatsapp('+62 812 3456 789') → '628123456789'
 * nomorWhatsapp('+65 8123 4567')  → '6581234567'   (tamu dari luar negeri)
 * nomorWhatsapp('123')            → null
 */
export function nomorWhatsapp(nomor: string): string | null {
  const mentah = nomor.trim()
  if (mentah === '') return null

  // `+` cuma bermakna kalau ada di paling depan. Yang di tengah itu salah ketik.
  const internasional = mentah.startsWith('+')
  const angka = mentah.replace(/\D/g, '')

  if (angka === '') return null

  let hasil: string

  if (internasional) {
    // Sudah ditulis lengkap dengan kode negara — dipakai apa adanya, supaya
    // tamu yang memakai nomor luar negeri tidak dipaksa jadi nomor Indonesia.
    hasil = angka
  } else if (angka.startsWith('0')) {
    // Bentuk lokal yang paling umum. Nol di depan diganti kode negara, bukan
    // dibuang: `0812…` jadi `62812…`, dan `0621…` (Binjai) jadi `62621…`.
    hasil = KODE_INDONESIA + angka.slice(1)
  } else if (angka.startsWith(KODE_INDONESIA)) {
    hasil = angka
  } else {
    // Nomor tanpa nol di depan, mis. `812…` yang disalin dari kontak.
    hasil = KODE_INDONESIA + angka
  }

  if (hasil.length < MIN_DIGIT || hasil.length > MAKS_DIGIT) return null

  return hasil
}

/** Apakah nomor ini bisa dipakai membuka WhatsApp. */
export const nomorBisaDiwhatsapp = (nomor: string) => nomorWhatsapp(nomor) !== null
