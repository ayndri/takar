import { createHash } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { env } from '../../config/env.js'
import { prisma } from '../../lib/prisma.js'
import {
  kosongkanDatabase,
  periksaCacheCocokLedger,
  siapkanKafe,
  stokLedger,
  type Kafe,
} from '../../test/fixtures.js'
import { createOrder } from '../orders/orders.service.js'

/**
 * Pembayaran, diuji lewat HTTP sungguhan.
 *
 * Yang diuji di sini bukan hitungannya (itu sudah ada di tes unit), tapi
 * jalurnya: apakah notifikasi bertanda tangan sah benar-benar memotong stok,
 * apakah yang palsu benar-benar ditolak sebelum menyentuh apa pun, dan
 * apakah notifikasi yang sama dikirim dua kali tetap memotong sekali.
 *
 * Lewat supertest, bukan memanggil service langsung, karena tanda tangannya
 * dihitung dari isi permintaan HTTP. Memanggil service langsung akan
 * melewati persis bagian yang paling perlu dibuktikan.
 */

const app = createApp()

let kafe: Kafe

beforeEach(async () => {
  await kosongkanDatabase()
  kafe = await siapkanKafe()
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Notifikasi seperti yang dikirim Midtrans, lengkap dengan tanda tangannya. */
function notifikasi(reference: string, jumlah: string, status = 'settlement') {
  const statusCode = '200'

  return {
    order_id: reference,
    status_code: statusCode,
    gross_amount: jumlah,
    transaction_status: status,
    payment_type: 'qris',
    fraud_status: 'accept',
    signature_key: createHash('sha512')
      .update(reference + statusCode + jumlah + env.MIDTRANS_SERVER_KEY)
      .digest('hex'),
  }
}

/** Buat pesanan online beserta satu percobaan bayar yang menunggu. */
async function pesananMenungguBayar(qty = 2) {
  const order = await createOrder({
    paymentMethod: 'ONLINE',
    items: [{ menuId: kafe.latte.id, qty }],
  })

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      reference: `${order.code}-UJI`,
      amount: order.total,
      status: 'PENDING',
    },
  })

  return { order, payment }
}

const kirim = (isi: Record<string, unknown>) =>
  request(app).post('/api/payments/midtrans/notification').send(isi)

describe('notifikasi pembayaran', () => {
  it('menolak tanda tangan palsu tanpa menyentuh apa pun', async () => {
    const { order, payment } = await pesananMenungguBayar()

    const res = await kirim({
      ...notifikasi(payment.reference, order.total.toString()),
      signature_key: '0'.repeat(128),
    })

    expect(res.status).toBe(403)

    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))!.status).toBe(
      'PENDING',
    )
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.status).toBe(
      'PENDING',
    )
    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(kafe.cupAwal)
  })

  it('menolak jumlah yang tidak cocok dengan tagihannya', async () => {
    const { payment } = await pesananMenungguBayar()

    const res = await kirim(notifikasi(payment.reference, '1000.00'))

    expect(res.status).toBe(400)
    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))!.status).toBe(
      'PENDING',
    )
  })

  it('menolak acuan pembayaran yang tidak dikenal', async () => {
    const res = await kirim(notifikasi('TKR-TIDAK-ADA', '56000.00'))
    expect(res.status).toBe(404)
  })

  it('notifikasi sah memotong stok dan mengonfirmasi pesanannya', async () => {
    const { order, payment } = await pesananMenungguBayar(2)

    const res = await kirim(notifikasi(payment.reference, order.total.toString()))

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'PAID' })

    const segar = await prisma.order.findUnique({ where: { id: order.id } })
    expect(segar!.status).toBe('CONFIRMED')
    expect(segar!.confirmedAt).not.toBeNull()

    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(kafe.cupAwal - 2)
    expect((await stokLedger(kafe.susu.id)).toNumber()).toBe(kafe.susuAwal - 300)
    expect(await periksaCacheCocokLedger()).toEqual([])

    // Penyisihannya dilepas, kalau tidak bahan yang sama terhitung dua kali.
    expect(
      await prisma.stockReservation.count({
        where: { orderId: order.id, releasedAt: null },
      }),
    ).toBe(0)
  })

  it('notifikasi yang sama dikirim dua kali tetap memotong sekali', async () => {
    const { order, payment } = await pesananMenungguBayar(2)
    const isi = notifikasi(payment.reference, order.total.toString())

    await kirim(isi).expect(200)
    await kirim(isi).expect(200)

    const gerakan = await prisma.stockMovement.count({
      where: { refType: 'order', refId: order.id, type: 'SALE' },
    })

    // Dua bahan, satu pergerakan masing-masing. Bukan empat.
    expect(gerakan).toBe(2)
    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(kafe.cupAwal - 2)
    expect(await periksaCacheCocokLedger()).toEqual([])
  })

  it('dua notifikasi bersamaan juga tetap memotong sekali', async () => {
    const { order, payment } = await pesananMenungguBayar(2)
    const isi = notifikasi(payment.reference, order.total.toString())

    await Promise.allSettled([kirim(isi), kirim(isi)])

    expect(
      await prisma.stockMovement.count({
        where: { refType: 'order', refId: order.id, type: 'SALE' },
      }),
    ).toBe(2)
    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(kafe.cupAwal - 2)
  })

  it('status yang belum lunas tidak memotong apa pun', async () => {
    const { order, payment } = await pesananMenungguBayar()

    await kirim(
      notifikasi(payment.reference, order.total.toString(), 'pending'),
    ).expect(200)

    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))!.status).toBe(
      'PENDING',
    )
    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(kafe.cupAwal)
  })

  it('pembayaran yang kedaluwarsa tidak mengonfirmasi pesanannya', async () => {
    const { order, payment } = await pesananMenungguBayar()

    await kirim(
      notifikasi(payment.reference, order.total.toString(), 'expire'),
    ).expect(200)

    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))!.status).toBe(
      'EXPIRED',
    )
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.status).toBe(
      'PENDING',
    )
  })
})

describe('sudah dibayar tapi bahannya keburu habis', () => {
  /**
   * Kasus yang paling sulit di seluruh fitur pembayaran, dan satu-satunya
   * yang menyangkut uang orang. Diuji di sini karena tidak ada cara
   * membuktikannya tanpa database: yang harus terjadi adalah pesanan TIDAK
   * dikonfirmasi, stok TIDAK dipaksa minus, dan pembayarannya TIDAK dianggap
   * gagal.
   */
  it('ditandai perlu dikembalikan, bukan dianggap gagal', async () => {
    await kosongkanDatabase()
    kafe = await siapkanKafe({ cup: 2 })

    const { order, payment } = await pesananMenungguBayar(2)

    // Gelasnya habis diambil pesanan lain yang keburu dikonfirmasi.
    await prisma.ingredientStock.update({
      where: { ingredientId: kafe.cup.id },
      data: { qty: '0.000' },
    })
    await prisma.stockMovement.create({
      data: {
        ingredientId: kafe.cup.id,
        qty: '-2.000',
        type: 'SALE',
        note: 'diambil pesanan lain',
      },
    })

    const res = await kirim(notifikasi(payment.reference, order.total.toString()))

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'REFUND_NEEDED' })

    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.status).toBe(
      'PENDING',
    )
    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(0)
    expect(
      await prisma.stockMovement.count({
        where: { refType: 'order', refId: order.id },
      }),
    ).toBe(0)
    expect(await periksaCacheCocokLedger()).toEqual([])
  })
})
