import { randomBytes } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { AppError, badRequest, conflict, notFound } from '../../lib/errors.js'
import { env, midtransSiap } from '../../config/env.js'
import { flagNyala } from '../settings/settings.service.js'
import { confirmOrder } from '../orders/orders.service.js'
import {
  jumlahCocok,
  rupiahBulat,
  statusDariNotifikasi,
  tandaTanganSah,
  type NotifikasiMidtrans,
  type StatusPembayaran,
} from './midtrans-notification.js'

/**
 * Hanya cara bayar yang selesai dalam hitungan detik.
 *
 * Virtual account dan transfer bank sengaja tidak diaktifkan. Keduanya bisa
 * dibayar berjam-jam kemudian, dan selama itu stok belum terpotong — kalau
 * bahannya habis di tengah jalan, kafe sudah terlanjur menerima uang untuk
 * sesuatu yang tidak bisa dibuat. Dengan QRIS dan e-wallet, jeda antara
 * "tamu menekan bayar" dan "stok terpotong" tinggal beberapa detik.
 */
const CARA_BAYAR = ['qris', 'other_qris', 'gopay', 'shopeepay', 'credit_card']

/** Pendek, karena semua cara bayar di atas memang selesai dalam hitungan detik. */
const KEDALUWARSA_MENIT = 15

const urlSnap = () =>
  env.MIDTRANS_IS_PRODUCTION
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

const urlStatus = (reference: string) =>
  env.MIDTRANS_IS_PRODUCTION
    ? `https://api.midtrans.com/v2/${reference}/status`
    : `https://api.sandbox.midtrans.com/v2/${reference}/status`

/** Midtrans memakai Basic auth dengan server key sebagai nama pengguna. */
const kepalaAuth = () => ({
  Authorization: `Basic ${Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString('base64')}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
})

async function pastikanBisa() {
  if (!midtransSiap) {
    throw new AppError(
      503,
      'Pembayaran online belum disiapkan di server ini',
      'PAYMENT_NOT_CONFIGURED',
    )
  }

  if (!(await flagNyala('toko.pembayaranOnline'))) {
    throw conflict('Kafe sedang tidak menerima pembayaran online')
  }
}

/**
 * Acuan unik untuk satu percobaan bayar.
 *
 * Midtrans menolak order_id yang sudah pernah dipakai, jadi kode pesanan saja
 * tidak cukup — tamu yang percobaan pertamanya kedaluwarsa harus bisa mencoba
 * lagi. Kode pesanannya tetap di depan supaya mudah dicocokkan saat menengok
 * dashboard Midtrans.
 */
const buatReference = (kodePesanan: string) =>
  `${kodePesanan}-${randomBytes(3).toString('hex').toUpperCase()}`

function rapikan(p: {
  id: string
  reference: string
  amount: { toString(): string }
  status: string
  snapToken: string | null
  channel: string | null
  paidAt: Date | null
  createdAt: Date
}) {
  return {
    id: p.id,
    reference: p.reference,
    amount: p.amount.toString(),
    status: p.status,
    snapToken: p.snapToken,
    channel: p.channel,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  }
}

/**
 * Mulai pembayaran untuk sebuah pesanan, kembalikan token Snap.
 *
 * Percobaan yang masih menggantung dipakai ulang kalau tokennya belum
 * kedaluwarsa. Tanpa itu, tamu yang menutup popup lalu menekan bayar lagi
 * meninggalkan tumpukan percobaan yang tidak pernah selesai di dashboard
 * Midtrans, dan kafe tidak bisa lagi membedakan mana yang benar-benar macet.
 */
export async function mulaiPembayaran(kodePesanan: string) {
  await pastikanBisa()

  const order = await prisma.order.findUnique({
    where: { code: kodePesanan.toUpperCase() },
    include: { items: { include: { menu: { select: { name: true } } } } },
  })

  if (!order) throw notFound('Pesanan tidak ditemukan')

  if (order.status !== 'PENDING') {
    throw conflict(`Pesanan sudah berstatus ${order.status} dan tidak bisa dibayar lagi`)
  }

  const lunas = await prisma.payment.findFirst({
    where: { orderId: order.id, status: 'PAID' },
  })

  if (lunas) throw conflict('Pesanan ini sudah dibayar')

  const batas = new Date(Date.now() - KEDALUWARSA_MENIT * 60_000)

  const menggantung = await prisma.payment.findFirst({
    where: { orderId: order.id, status: 'PENDING', createdAt: { gt: batas } },
    orderBy: { createdAt: 'desc' },
  })

  if (menggantung?.snapToken) {
    return {
      ...rapikan(menggantung),
      clientKey: env.MIDTRANS_CLIENT_KEY,
      produksi: env.MIDTRANS_IS_PRODUCTION,
    }
  }

  const reference = buatReference(order.code)
  const jumlah = rupiahBulat(order.total.toString())

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      reference,
      amount: jumlah,
      status: 'PENDING',
    },
  })

  const jawaban = await fetch(urlSnap(), {
    method: 'POST',
    headers: kepalaAuth(),
    body: JSON.stringify({
      transaction_details: { order_id: reference, gross_amount: jumlah },
      // Rincian dikirim supaya tamu melihat isi pesanannya di halaman bayar,
      // bukan cuma satu angka total tanpa penjelasan.
      item_details: order.items.map((i) => ({
        id: i.menuId,
        name: i.menu.name.slice(0, 50),
        price: rupiahBulat(i.unitPrice.toString()),
        quantity: i.qty,
      })),
      customer_details: {
        first_name: order.customerName ?? 'Tamu',
      },
      enabled_payments: CARA_BAYAR,
      expiry: { unit: 'minute', duration: KEDALUWARSA_MENIT },
    }),
  })

  const isi = (await jawaban.json().catch(() => ({}))) as {
    token?: string
    error_messages?: string[]
  }

  if (!jawaban.ok || !isi.token) {
    // Percobaan yang gagal dibuat ditandai, bukan dihapus — kalau Midtrans
    // ternyata sempat membuatnya di sisi sana, acuannya harus tetap ada.
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', lastNotification: isi as object },
    })

    throw badRequest(
      isi.error_messages?.join(', ') ?? 'Midtrans menolak permintaan pembayaran',
    )
  }

  const segar = await prisma.payment.update({
    where: { id: payment.id },
    data: { snapToken: isi.token },
  })

  return {
    ...rapikan(segar),
    clientKey: env.MIDTRANS_CLIENT_KEY,
    produksi: env.MIDTRANS_IS_PRODUCTION,
  }
}

/**
 * Terapkan hasil pembayaran ke pesanan.
 *
 * Inilah titik tersulit di seluruh fitur ini. Uang sudah masuk, dan sekarang
 * stok harus dipotong — tapi bisa saja bahannya sudah habis diambil pesanan
 * lain beberapa detik sebelumnya.
 *
 * Kalau itu terjadi, pembayarannya TIDAK dianggap gagal (uangnya memang sudah
 * ada) dan pesanannya TIDAK diam-diam dibiarkan. Statusnya jadi REFUND_NEEDED
 * supaya muncul menyala di papan kasir. Lebih baik kafe tahu ada satu orang
 * yang harus diuruskan uangnya daripada pesanannya hilang tanpa jejak.
 */
async function terapkanLunas(paymentId: string, orderId: string) {
  try {
    await confirmOrder(orderId)

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'PAID', paidAt: new Date() },
    })

    return 'PAID' as const
  } catch (e) {
    const stokKurang = e instanceof AppError && e.code === 'INSUFFICIENT_STOCK'

    // Pesanan yang sudah dikonfirmasi lewat jalur lain bukan kegagalan —
    // notifikasi Midtrans memang bisa datang dua kali.
    const sudahJalan = e instanceof AppError && e.code === 'CONFLICT'

    if (sudahJalan) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'PAID', paidAt: new Date() },
      })
      return 'PAID' as const
    }

    if (!stokKurang) throw e

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUND_NEEDED' },
    })

    return 'REFUND_NEEDED' as const
  }
}

/**
 * Perbarui satu percobaan bayar ke status baru.
 *
 * Aman dipanggil berulang untuk notifikasi yang sama. Midtrans mengirim ulang
 * notifikasinya kalau server kita lambat menjawab, dan tanpa penjagaan ini
 * stok bisa terpotong dua kali untuk satu pesanan.
 */
async function perbarui(
  payment: { id: string; orderId: string; status: string },
  status: StatusPembayaran,
  isi: NotifikasiMidtrans,
) {
  const sudahSelesai = payment.status === 'PAID' || payment.status === 'REFUND_NEEDED'

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      channel: typeof isi.payment_type === 'string' ? isi.payment_type : null,
      lastNotification: isi as object,
    },
  })

  if (sudahSelesai) return payment.status

  if (status === 'PAID') return terapkanLunas(payment.id, payment.orderId)

  await prisma.payment.update({ where: { id: payment.id }, data: { status } })

  return status
}

/**
 * Notifikasi dari Midtrans.
 *
 * Endpoint ini terbuka tanpa login — Midtrans tidak bisa membawa token kita.
 * Yang menggantikannya tanda tangan SHA512 yang cuma bisa dibuat oleh pihak
 * yang tahu server key. Tanpa pemeriksaan itu, siapa pun yang tahu alamatnya
 * bisa menyatakan pesanan orang lain sudah lunas.
 */
export async function terimaNotifikasi(isi: NotifikasiMidtrans) {
  if (!midtransSiap) {
    throw new AppError(503, 'Pembayaran online belum disiapkan', 'PAYMENT_NOT_CONFIGURED')
  }

  if (!tandaTanganSah(isi, env.MIDTRANS_SERVER_KEY)) {
    // Sengaja tidak menjelaskan bagian mana yang salah.
    throw new AppError(403, 'Tanda tangan notifikasi tidak sah', 'FORBIDDEN')
  }

  const reference = typeof isi.order_id === 'string' ? isi.order_id : ''

  const payment = await prisma.payment.findUnique({ where: { reference } })
  if (!payment) throw notFound('Pembayaran tidak ditemukan')

  if (!jumlahCocok(isi, payment.amount.toString())) {
    // Tanda tangannya sah tapi jumlahnya beda — ini tidak boleh terjadi, dan
    // kalau terjadi jangan sekali-kali dianggap lunas.
    console.error(
      `Jumlah pembayaran ${reference} tidak cocok: ditagih ${payment.amount}, ` +
        `notifikasi ${String(isi.gross_amount)}`,
    )
    throw badRequest('Jumlah pembayaran tidak cocok dengan tagihan')
  }

  const status = await perbarui(payment, statusDariNotifikasi(isi), isi)

  return { reference, status }
}

/**
 * Tanya langsung ke Midtrans bagaimana keadaan pembayarannya.
 *
 * Cadangan untuk notifikasi yang tidak pernah sampai — webhook bisa hilang di
 * jaringan, dan saat mengembangkan di laptop Midtrans memang tidak bisa
 * memanggil localhost sama sekali. Dipanggil saat tamu membuka halaman
 * statusnya, jadi pesanan tidak bisa macet selamanya hanya karena satu pesan
 * yang tercecer.
 */
export async function segarkanDariMidtrans(kodePesanan: string) {
  if (!midtransSiap) return null

  const order = await prisma.order.findUnique({
    where: { code: kodePesanan.toUpperCase() },
    select: { id: true },
  })

  if (!order) return null

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })

  if (!payment) return null

  const jawaban = await fetch(urlStatus(payment.reference), {
    headers: kepalaAuth(),
  }).catch(() => null)

  if (!jawaban?.ok) return null

  const isi = (await jawaban.json().catch(() => ({}))) as NotifikasiMidtrans

  // Jawaban endpoint status tidak selalu bertanda tangan, jadi yang
  // dipercaya di sini adalah sumbernya: permintaan ini kita sendiri yang
  // membuatnya, ke alamat Midtrans, dengan server key kita.
  if (!jumlahCocok(isi, payment.amount.toString())) return null

  const status = await perbarui(payment, statusDariNotifikasi(isi), isi)

  return { reference: payment.reference, status }
}

/** Riwayat percobaan bayar sebuah pesanan. */
export async function pembayaranPesanan(orderId: string) {
  const rows = await prisma.payment.findMany({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map(rapikan)
}
