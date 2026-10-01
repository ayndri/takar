import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { angka, flagNyala } from '../settings/settings.service.js'

/** Prisma dalam transaksi punya tipe yang sedikit berbeda dari client biasa. */
type Db = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Penyisihan bahan untuk pesanan yang belum dikonfirmasi.
 *
 * Masalah yang diselesaikan: pelanggan mengirim pesanan, kasir belum sempat
 * menekan konfirmasi, dan dalam jeda itu pesanan lain menghabiskan bahan
 * terakhir. Yang pertama baru ditolak saat kasir menekan tombolnya, padahal
 * orangnya sudah menunggu dan mungkin sudah membayar.
 *
 * Reservasi tidak menyentuh ledger sama sekali. Ia cuma mengurangi angka yang
 * boleh dijanjikan ke orang berikutnya. Yang memotong stok tetap satu-satunya
 * tempat yang sama seperti sebelumnya: konfirmasi kasir.
 */

/**
 * Berapa banyak tiap bahan yang sedang disisihkan.
 *
 * `expiresAt` ikut disaring, bukan cuma `releasedAt`. Dengan begitu stok
 * tidak pernah terkunci selamanya hanya karena penyapunya belum sempat
 * jalan: reservasi yang kedaluwarsa berhenti dihitung pada detik itu juga,
 * walau barisnya masih menunggu dibereskan.
 */
export async function reservasiAktif(
  db: Db = prisma,
  opsi: { kecualiOrderId?: string; ingredientIds?: string[] } = {},
): Promise<Map<string, Decimal>> {
  const rows = await db.stockReservation.groupBy({
    by: ['ingredientId'],
    _sum: { qty: true },
    where: {
      releasedAt: null,
      expiresAt: { gt: new Date() },
      ...(opsi.kecualiOrderId && { orderId: { not: opsi.kecualiOrderId } }),
      ...(opsi.ingredientIds && { ingredientId: { in: opsi.ingredientIds } }),
    },
  })

  return new Map(
    rows.map((r) => [r.ingredientId, new Decimal((r._sum.qty ?? 0).toString())]),
  )
}

/** Apakah fitur ini sedang dipakai, dan berapa lama penyisihannya berlaku. */
export async function aturanReservasiStok() {
  const [nyala, menit] = await Promise.all([
    flagNyala('toko.reservasiStok'),
    angka('toko.reservasiStokMenit'),
  ])

  return { nyala, menit }
}

/**
 * Sisihkan bahan untuk satu pesanan.
 *
 * Wajib dipanggil di dalam transaksi yang sudah mengunci baris stoknya
 * dengan lockStocks(). Tanpa kunci itu, dua pesanan bersamaan sama-sama
 * membaca sisa yang sama lalu sama-sama membuat reservasi, dan masalah yang
 * mau diselesaikan justru berpindah tempat.
 */
export async function buatReservasi(
  tx: Db,
  orderId: string,
  kebutuhan: Map<string, Decimal>,
  menit: number,
) {
  if (kebutuhan.size === 0) return

  const expiresAt = new Date(Date.now() + menit * 60_000)

  await tx.stockReservation.createMany({
    data: [...kebutuhan].map(([ingredientId, qty]) => ({
      orderId,
      ingredientId,
      qty: qty.toFixed(3),
      expiresAt,
    })),
  })
}

/**
 * Lepaskan semua penyisihan milik satu pesanan.
 *
 * Dipakai saat pesanannya dikonfirmasi (bahannya sudah benar-benar dipotong,
 * jadi menyisihkannya lagi berarti menghitung dua kali) dan saat dibatalkan.
 */
export async function lepasReservasi(tx: Db, orderId: string) {
  await tx.stockReservation.updateMany({
    where: { orderId, releasedAt: null },
    data: { releasedAt: new Date() },
  })
}

/**
 * Bereskan penyisihan yang sudah lewat waktunya.
 *
 * Secara hitungan ini tidak mengubah apa pun: yang kedaluwarsa memang sudah
 * berhenti dihitung di reservasiAktif(). Gunanya menjaga tabelnya tetap
 * ringkas dan bisa dibaca orang, dan supaya indeksnya tidak menumpuk baris
 * mati.
 *
 * Seperti penyapu reservasi meja, ini menumpang permintaan yang memang sudah
 * terjadi. Tidak ada setInterval: backend ini jalan sebagai fungsi
 * serverless, dan timer apa pun mati bersama request yang membuatnya.
 */
const JEDA_SAPU_MS = 60_000
let terakhirDisapu = 0

export async function sapuReservasiStok({ paksa = false } = {}) {
  if (!paksa && Date.now() - terakhirDisapu < JEDA_SAPU_MS) return null
  terakhirDisapu = Date.now()

  const hasil = await prisma.stockReservation.updateMany({
    where: { releasedAt: null, expiresAt: { lte: new Date() } },
    data: { releasedAt: new Date() },
  })

  return hasil.count
}
