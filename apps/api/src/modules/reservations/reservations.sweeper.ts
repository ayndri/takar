import { prisma } from '../../lib/prisma.js'
import { angka } from '../settings/settings.service.js'

/**
 * Pembersih reservasi yang menggantung.
 *
 * Dua hal yang dikerjakan:
 *
 *  1. Permintaan yang tidak pernah dikonfirmasi sampai mendekati jam mulainya
 *     digugurkan. Tanpa ini, satu permintaan iseng yang tidak pernah disentuh
 *     memblokir mejanya sampai jamnya lewat — dan tidak ada yang tahu kenapa
 *     meja itu hilang dari pilihan.
 *
 *  2. Reservasi yang sudah dikonfirmasi tapi tamunya tidak kunjung datang
 *     ditandai tidak datang, dan mejanya dilepas untuk orang lain.
 *
 * **Kenapa bukan setInterval.** Backend ini jalan sebagai fungsi serverless:
 * tidak ada proses yang hidup terus, jadi timer apa pun mati bersama request
 * yang membuatnya. Penyapu ini dipanggil menumpang permintaan yang memang
 * sudah terjadi — saat seseorang melihat jam yang tersedia, atau saat kafe
 * membuka papan reservasi. Kalau tidak ada yang melihat, tidak ada juga yang
 * dirugikan oleh data yang belum tersapu.
 *
 * Ada jeda minimum supaya satu halaman yang memuat tiga endpoint sekaligus
 * tidak menjalankan sapuan yang sama tiga kali.
 */

const JEDA_MINIMUM_MS = 60_000

let terakhirDisapu = 0

export type HasilSapuan = { gugur: number; tidakDatang: number }

export async function sapuReservasi(
  { paksa = false }: { paksa?: boolean } = {},
): Promise<HasilSapuan | null> {
  if (!paksa && Date.now() - terakhirDisapu < JEDA_MINIMUM_MS) return null

  // Ditandai sebelum dikerjakan, bukan sesudah: kalau sapuannya gagal di
  // tengah jalan, yang berikutnya tetap menunggu jeda alih-alih mencoba
  // berulang-ulang pada tiap permintaan yang masuk.
  terakhirDisapu = Date.now()

  const [batasKonfirmasi, toleransi] = await Promise.all([
    angka('reservasi.batasKonfirmasiMenit'),
    angka('reservasi.toleransiNoShowMenit'),
  ])

  const sekarang = new Date()

  const gugur = await prisma.reservation.updateMany({
    where: {
      status: 'PENDING',
      // Sudah terlalu dekat dengan jam mulainya untuk sempat dikonfirmasi.
      startAt: { lt: new Date(sekarang.getTime() + batasKonfirmasi * 60_000) },
    },
    data: {
      status: 'CANCELLED',
      cancelledAt: sekarang,
      cancelReason: 'Tidak dikonfirmasi sampai batas waktunya',
    },
  })

  const tidakDatang = await prisma.reservation.updateMany({
    where: {
      status: 'CONFIRMED',
      startAt: { lt: new Date(sekarang.getTime() - toleransi * 60_000) },
    },
    data: { status: 'NO_SHOW' },
  })

  return { gugur: gugur.count, tidakDatang: tidakDatang.count }
}

/**
 * Reservasi yang sedang berjalan atau akan segera mulai di meja tertentu.
 *
 * Dipakai memperingatkan tamu yang memindai QR di meja yang sudah dipesan
 * orang lain, dan menandai pesanannya di papan kasir. Yang dikembalikan cuma
 * satu — yang paling dekat jamnya.
 *
 * Peringatan, bukan larangan: barista yang melihat ruangannya tahu lebih
 * banyak daripada kode yang cuma melihat baris database, dan sistem yang
 * menolak melayani tamu yang sudah telanjur duduk hanya melawan orang yang
 * mengoperasikannya.
 */
export async function reservasiMejaTerdekat(
  tableIds: string[],
  sekarang = new Date(),
): Promise<Map<string, { startAt: Date; customerName: string; guestCount: number }>> {
  if (tableIds.length === 0) return new Map()

  const jeda = await angka('reservasi.jedaWalkInMenit')
  if (jeda <= 0) return new Map()

  const rows = await prisma.reservation.findMany({
    where: {
      tableId: { in: tableIds },
      status: { in: ['PENDING', 'CONFIRMED', 'SEATED'] },
      // Yang sudah lewat jam selesainya tidak lagi memegang mejanya.
      endAt: { gt: sekarang },
      startAt: { lt: new Date(sekarang.getTime() + jeda * 60_000) },
    },
    orderBy: { startAt: 'asc' },
    select: { tableId: true, startAt: true, customerName: true, guestCount: true },
  })

  const per = new Map<
    string,
    { startAt: Date; customerName: string; guestCount: number }
  >()

  for (const r of rows) {
    if (!r.tableId || per.has(r.tableId)) continue
    per.set(r.tableId, {
      startAt: r.startAt,
      customerName: r.customerName,
      guestCount: r.guestCount,
    })
  }

  return per
}
