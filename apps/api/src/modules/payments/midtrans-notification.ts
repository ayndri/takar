import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Penerjemah notifikasi Midtrans — tanpa jaringan, tanpa database.
 *
 * Dipisah supaya bisa diuji tanpa menyentuh apa pun: notifikasi pembayaran
 * adalah satu-satunya tempat di aplikasi ini yang menerima perintah dari luar
 * tanpa login, dan satu-satunya yang menentukan apakah uang sudah masuk.
 * Keliru sedikit di sini berarti stok terpotong untuk pesanan yang tidak
 * pernah dibayar, atau sebaliknya.
 */

export type StatusPembayaran =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

/** Bentuk notifikasi Midtrans, hanya bagian yang dipakai. */
export type NotifikasiMidtrans = {
  order_id?: unknown
  status_code?: unknown
  gross_amount?: unknown
  signature_key?: unknown
  transaction_status?: unknown
  fraud_status?: unknown
  payment_type?: unknown
  transaction_time?: unknown
}

const teks = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * Tanda tangan yang seharusnya, menurut rumus Midtrans:
 * SHA512(order_id + status_code + gross_amount + server_key).
 *
 * `gross_amount` harus dipakai persis seperti yang dikirim Midtrans,
 * termasuk dua angka di belakang koma. Membulatkannya atau mengubahnya jadi
 * angka lebih dulu membuat tanda tangannya tidak akan pernah cocok.
 */
export function tandaTanganSeharusnya(
  n: NotifikasiMidtrans,
  serverKey: string,
): string {
  const bahan =
    teks(n.order_id) + teks(n.status_code) + teks(n.gross_amount) + serverKey

  return createHash('sha512').update(bahan).digest('hex')
}

/**
 * Apakah notifikasi ini benar-benar datang dari Midtrans.
 *
 * Dibandingkan dengan timingSafeEqual, bukan `===`. Perbandingan biasa
 * berhenti di huruf pertama yang berbeda, dan selisih waktunya — walau
 * sepersejuta detik — bisa dipakai menebak tanda tangan yang benar satu
 * huruf demi satu huruf.
 */
export function tandaTanganSah(
  n: NotifikasiMidtrans,
  serverKey: string,
): boolean {
  const dikirim = teks(n.signature_key)
  if (dikirim === '') return false

  const seharusnya = tandaTanganSeharusnya(n, serverKey)

  // Panjang yang berbeda membuat timingSafeEqual melempar, jadi disaring
  // lebih dulu. Panjangnya sendiri bukan rahasia.
  if (dikirim.length !== seharusnya.length) return false

  return timingSafeEqual(Buffer.from(dikirim), Buffer.from(seharusnya))
}

/**
 * Terjemahkan `transaction_status` Midtrans jadi status kita.
 *
 * `capture` perlu perhatian khusus: itu status kartu kredit yang uangnya
 * sudah ditahan tapi belum tentu lolos pemeriksaan penipuan. Dianggap lunas
 * hanya kalau `fraud_status` sudah `accept`. Kalau masih `challenge`,
 * Midtrans menunggu keputusan manual — dan menganggapnya lunas berarti
 * menyerahkan kopi untuk transaksi yang mungkin dibatalkan.
 */
export function statusDariNotifikasi(n: NotifikasiMidtrans): StatusPembayaran {
  const status = teks(n.transaction_status)
  const fraud = teks(n.fraud_status)

  switch (status) {
    case 'capture':
      return fraud === 'accept' ? 'PAID' : 'PENDING'

    case 'settlement':
      return 'PAID'

    case 'pending':
      return 'PENDING'

    case 'deny':
    case 'failure':
      return 'FAILED'

    case 'expire':
      return 'EXPIRED'

    case 'cancel':
      return 'CANCELLED'

    default:
      // Status yang tidak dikenal tidak boleh diam-diam dianggap lunas.
      return 'PENDING'
  }
}

/**
 * Apakah jumlah yang dikonfirmasi Midtrans sama dengan yang kita tagihkan.
 *
 * Midtrans mengirim `gross_amount` sebagai teks seperti "38000.00".
 * Dibandingkan sebagai angka supaya "38000" dan "38000.00" dianggap sama,
 * tapi tetap harus sama persis nilainya — pesanan 38.000 yang dibayar 1.000
 * bukan pembayaran sebagian, itu tanda ada yang salah.
 */
export function jumlahCocok(n: NotifikasiMidtrans, seharusnya: string): boolean {
  const dibayar = Number(teks(n.gross_amount))
  const ditagih = Number(seharusnya)

  if (!Number.isFinite(dibayar) || !Number.isFinite(ditagih)) return false

  // Rupiah tidak punya pecahan yang berarti; selisih di bawah satu rupiah
  // adalah pembulatan, bukan perbedaan.
  return Math.abs(dibayar - ditagih) < 1
}

/**
 * Rupiah bulat untuk dikirim ke Midtrans.
 *
 * Midtrans menolak `gross_amount` berpecahan untuk IDR. Dibulatkan ke atas,
 * bukan ke bawah: membulatkan ke bawah berarti kafe menanggung selisihnya
 * tiap transaksi, dan itu kebocoran yang tidak pernah tercatat di mana pun.
 */
export function rupiahBulat(jumlah: string | number): number {
  return Math.ceil(Number(jumlah))
}
