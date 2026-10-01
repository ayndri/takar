import { Decimal } from 'decimal.js'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { AppError } from '../../lib/errors.js'
import {
  kosongkanDatabase,
  periksaCacheCocokLedger,
  siapkanKafe,
  stokCache,
  stokLedger,
  type Kafe,
} from '../../test/fixtures.js'
import { simpanSettings } from '../settings/settings.service.js'
import { cancelOrder, confirmOrder, createOrder } from './orders.service.js'

/**
 * Alur pesanan, diuji terhadap Postgres sungguhan.
 *
 * Yang tidak bisa dibuktikan tes unit ada di sini: penguncian baris,
 * pembatalan transaksi yang utuh, dan apakah cache stok masih cocok dengan
 * ledger setelah semuanya selesai.
 */

let kafe: Kafe

beforeEach(async () => {
  await kosongkanDatabase()
  kafe = await siapkanKafe()
})

afterAll(async () => {
  await prisma.$disconnect()
})

const pesan = (qty: number, extra: Record<string, unknown> = {}) =>
  createOrder({
    paymentMethod: 'CASHIER',
    items: [{ menuId: kafe.latte.id, qty }],
    ...extra,
  })

describe('membuat pesanan', () => {
  it('menyimpan harga dari database, bukan dari yang dikirim', async () => {
    const order = await pesan(2)

    expect(order.total.toString()).toBe('56000')
    expect(order.items[0]!.unitPrice.toString()).toBe('28000')
    expect(order.status).toBe('PENDING')
  })

  it('belum memotong stok sama sekali', async () => {
    await pesan(2)

    expect((await stokLedger(kafe.susu.id)).toNumber()).toBe(kafe.susuAwal)
    expect((await stokCache(kafe.susu.id)).toNumber()).toBe(kafe.susuAwal)
  })

  it('menyisihkan bahannya untuk pesanan itu', async () => {
    const order = await pesan(2)

    const sisihan = await prisma.stockReservation.findMany({
      where: { orderId: order.id },
      orderBy: { qty: 'desc' },
    })

    expect(sisihan).toHaveLength(2)
    expect(sisihan.map((s) => Number(s.qty))).toEqual([300, 2])
    expect(sisihan.every((s) => s.releasedAt === null)).toBe(true)
  })

  it('menolak pesanan yang melebihi sisa setelah penyisihan', async () => {
    await kosongkanDatabase()
    kafe = await siapkanKafe({ cup: 3 })

    await pesan(2)

    // Tinggal satu gelas yang belum disisihkan.
    await expect(pesan(2)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })

    // Yang masih muat tetap boleh lewat.
    await expect(pesan(1)).resolves.toMatchObject({ status: 'PENDING' })
  })

  it('memakai harga promo kalau menunya sedang dipotong', async () => {
    await prisma.menu.update({
      where: { id: kafe.latte.id },
      data: { promoPrice: '20000.00' },
    })

    const order = await pesan(2)

    expect(order.items[0]!.unitPrice.toString()).toBe('20000')
    expect(order.total.toString()).toBe('40000')
  })

  it('mengabaikan promo kalau modulnya dimatikan', async () => {
    await prisma.menu.update({
      where: { id: kafe.latte.id },
      data: { promoPrice: '20000.00' },
    })
    await simpanSettings({ 'modul.promo': false })

    const order = await pesan(1)

    expect(order.items[0]!.unitPrice.toString()).toBe('28000')
  })
})

describe('konfirmasi pesanan', () => {
  it('memotong stok tepat sekali dan melepas penyisihannya', async () => {
    const order = await pesan(2)
    await confirmOrder(order.id)

    expect((await stokLedger(kafe.susu.id)).toNumber()).toBe(kafe.susuAwal - 300)
    expect((await stokCache(kafe.susu.id)).toNumber()).toBe(kafe.susuAwal - 300)
    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(kafe.cupAwal - 2)

    const masihMemegang = await prisma.stockReservation.count({
      where: { orderId: order.id, releasedAt: null },
    })
    expect(masihMemegang).toBe(0)

    expect(await periksaCacheCocokLedger()).toEqual([])
  })

  it('menolak konfirmasi kedua untuk pesanan yang sama', async () => {
    const order = await pesan(1)
    await confirmOrder(order.id)

    await expect(confirmOrder(order.id)).rejects.toBeInstanceOf(AppError)

    // Yang penting bukan sekadar errornya, tapi stok tidak terpotong dua kali.
    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(kafe.cupAwal - 1)
  })

  it('tidak menyisakan potongan separuh saat satu bahan kurang', async () => {
    await kosongkanDatabase()
    kafe = await siapkanKafe({ susu: 10_000, cup: 1 })

    // Dibuat tanpa penyisihan supaya pesanannya lolos sampai meja kasir,
    // lalu baru ketahuan kurang di sana.
    await simpanSettings({ 'toko.reservasiStok': false })
    const order = await pesan(2)

    await expect(confirmOrder(order.id)).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    })

    // Susunya cukup untuk dua gelas, tapi gelasnya tidak. Kalau transaksinya
    // tidak utuh, susu sudah berkurang sementara gelasnya tidak.
    expect((await stokLedger(kafe.susu.id)).toNumber()).toBe(10_000)
    expect((await stokCache(kafe.susu.id)).toNumber()).toBe(10_000)
    expect(await periksaCacheCocokLedger()).toEqual([])
  })
})

describe('pembatalan', () => {
  it('mengembalikan stok lewat pergerakan baru, bukan dengan menghapus', async () => {
    const order = await pesan(2)
    await confirmOrder(order.id)
    await cancelOrder(order.id, 'tamu berubah pikiran')

    // Jumlahnya kembali seperti semula.
    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(kafe.cupAwal)

    // Tapi riwayatnya tetap utuh: tidak ada baris yang dihapus.
    const gerakan = await prisma.stockMovement.findMany({
      where: { refType: 'order', refId: order.id },
      select: { type: true },
    })

    expect(gerakan.map((g) => g.type).sort()).toEqual([
      'RETURN',
      'RETURN',
      'SALE',
      'SALE',
    ])
    expect(await periksaCacheCocokLedger()).toEqual([])
  })

  it('melepas penyisihan pesanan yang dibatalkan sebelum dikonfirmasi', async () => {
    const order = await pesan(2)
    await cancelOrder(order.id)

    const masihMemegang = await prisma.stockReservation.count({
      where: { orderId: order.id, releasedAt: null },
    })

    expect(masihMemegang).toBe(0)
    // Tidak pernah dikonfirmasi, jadi tidak ada pergerakan sama sekali.
    expect(
      await prisma.stockMovement.count({ where: { refType: 'order', refId: order.id } }),
    ).toBe(0)
  })
})

describe('dua pesanan merebutkan gelas terakhir', () => {
  /**
   * Inilah tes yang tidak mungkin ditulis tanpa database sungguhan.
   *
   * Penguncian baris itu perilaku Postgres, bukan perilaku kode. Satu-satunya
   * cara membuktikan `SELECT ... FOR UPDATE` benar-benar bekerja adalah
   * menjalankan dua transaksi yang saling berebut dan melihat siapa yang
   * kalah.
   */
  it('hanya satu yang lolos, dan stok tidak pernah minus', async () => {
    await kosongkanDatabase()
    kafe = await siapkanKafe({ cup: 2 })

    // Penyisihan dimatikan supaya keduanya sampai ke meja kasir, lalu
    // berebut di titik pemotongan. Dengan penyisihan menyala, yang kedua
    // sudah ditolak jauh sebelum sampai sini.
    await simpanSettings({ 'toko.reservasiStok': false })

    const a = await pesan(2)
    const b = await pesan(2)

    const hasil = await Promise.allSettled([confirmOrder(a.id), confirmOrder(b.id)])

    const lolos = hasil.filter((h) => h.status === 'fulfilled')
    const gagal = hasil.filter((h) => h.status === 'rejected')

    expect(lolos).toHaveLength(1)
    expect(gagal).toHaveLength(1)
    expect((gagal[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    })

    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(0)
    expect((await stokCache(kafe.cup.id)).toNumber()).toBe(0)
    expect(await periksaCacheCocokLedger()).toEqual([])
  })

  it('penyisihan menolak yang kedua sejak saat memesan', async () => {
    await kosongkanDatabase()
    kafe = await siapkanKafe({ cup: 2 })

    const hasil = await Promise.allSettled([pesan(2), pesan(2)])

    expect(hasil.filter((h) => h.status === 'fulfilled')).toHaveLength(1)
    expect(hasil.filter((h) => h.status === 'rejected')).toHaveLength(1)

    // Belum ada yang dipotong: yang menang baru memegang janji, bukan barang.
    expect((await stokLedger(kafe.cup.id)).toNumber()).toBe(2)

    const disisihkan = await prisma.stockReservation.aggregate({
      where: { ingredientId: kafe.cup.id, releasedAt: null },
      _sum: { qty: true },
    })
    expect(new Decimal((disisihkan._sum.qty ?? 0).toString()).toNumber()).toBe(2)
  })
})
