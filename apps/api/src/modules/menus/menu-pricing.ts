import { Decimal } from 'decimal.js'

/**
 * Harga promo — hitungan murni, tanpa database.
 *
 * Satu aturan yang dipegang di seluruh berkas ini: **harga promo tidak pernah
 * menimpa harga aslinya.** `price` tetap harga normal, `promoPrice` cuma
 * berlaku selama rentang waktunya. Begitu rentangnya lewat, harga kembali
 * sendiri tanpa ada yang perlu mengubah data.
 *
 * Alasannya: promo yang mengubah kolom `price` langsung membuat harga normal
 * hilang. Tidak ada lagi angka yang bisa dicoret di halaman pelanggan, dan
 * mengembalikannya setelah promo selesai bergantung pada ingatan orang.
 */

export type DecimalLike = Decimal | string | number

const d = (v: DecimalLike) => new Decimal(v)

export type PromoMenu = {
  price: DecimalLike
  promoPrice?: DecimalLike | null
  promoStartsAt?: Date | null
  promoEndsAt?: Date | null
}

/**
 * Apakah promonya sedang berjalan pada saat tertentu.
 *
 * Tanggal mulai yang kosong berarti "sudah berlaku sejak kapan pun", tanggal
 * selesai yang kosong berarti "sampai dimatikan". Jadi promo tanpa dua-duanya
 * adalah promo permanen — itu sah, dan kadang memang yang diinginkan.
 *
 * Ujung akhirnya tidak termasuk: promo yang berakhir pukul 17:00 sudah tidak
 * berlaku tepat pukul 17:00, bukan sedetik sesudahnya.
 */
export function promoBerlaku(menu: PromoMenu, sekarang: Date): boolean {
  if (menu.promoPrice === null || menu.promoPrice === undefined) return false

  const harga = d(menu.promoPrice)
  if (harga.lte(0)) return false

  // Promo yang tidak lebih murah bukan promo. Menolaknya di sini membuat
  // data yang terlanjur salah tidak ikut menipu pelanggan.
  if (harga.gte(d(menu.price))) return false

  if (menu.promoStartsAt && sekarang < menu.promoStartsAt) return false
  if (menu.promoEndsAt && sekarang >= menu.promoEndsAt) return false

  return true
}

/** Harga yang benar-benar dibayar pelanggan saat ini. */
export function hargaBerlaku(menu: PromoMenu, sekarang: Date): Decimal {
  return promoBerlaku(menu, sekarang) ? d(menu.promoPrice!) : d(menu.price)
}

/**
 * Besar potongan dalam persen, dibulatkan ke bilangan bulat.
 * Dipakai untuk label "−20%" di kartu menu. null kalau tidak sedang promo.
 */
export function potonganPersen(menu: PromoMenu, sekarang: Date): number | null {
  if (!promoBerlaku(menu, sekarang)) return null

  const normal = d(menu.price)
  if (normal.lte(0)) return null

  const potongan = normal.minus(d(menu.promoPrice!)).div(normal).mul(100)

  return Math.round(potongan.toNumber())
}

/**
 * Alasan kenapa sebuah promo tidak sah, atau null kalau boleh disimpan.
 *
 * Dipakai saat pemilik menyimpan promo dari dasbor. Dikembalikan sebagai
 * kalimat siap tampil karena yang membacanya orang, bukan kode.
 */
export function alasanPromoDitolak(input: {
  price: DecimalLike
  promoPrice: DecimalLike | null
  promoStartsAt: Date | null
  promoEndsAt: Date | null
}): string | null {
  // Promo dilepas — tidak ada yang perlu diperiksa.
  if (input.promoPrice === null) return null

  const promo = d(input.promoPrice)
  const normal = d(input.price)

  if (promo.lte(0)) return 'Harga promo harus lebih dari nol'

  if (promo.gte(normal)) {
    return 'Harga promo harus lebih murah dari harga normal'
  }

  if (input.promoStartsAt && input.promoEndsAt && input.promoEndsAt <= input.promoStartsAt) {
    return 'Tanggal selesai promo harus setelah tanggal mulai'
  }

  return null
}
