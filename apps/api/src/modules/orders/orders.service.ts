import { randomBytes } from 'node:crypto'
import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, insufficientStock, notFound } from '../../lib/errors.js'
import { hargaBerlaku } from '../menus/menu-pricing.js'
import { reservasiMejaTerdekat } from '../reservations/reservations.sweeper.js'
import { flagNyala } from '../settings/settings.service.js'
import {
  findShortages,
  requiredIngredients,
  sisaSetelahReservasi,
  type RecipeLine,
} from '../stock/stock-calculator.js'
import {
  aturanReservasiStok,
  buatReservasi,
  lepasReservasi,
  reservasiAktif,
  sapuReservasiStok,
} from '../stock/stock-reservation.service.js'
import { applyMovements, lockStocks, type MovementInput } from '../stock/stock.service.js'
import { orderEvents } from './orders.events.js'
import type { CreateOrderInput } from './orders.schema.js'

/** Kode pendek yang gampang dibaca pelanggan di struk: TKR-7F2A. */
function generateCode() {
  return `TKR-${randomBytes(2).toString('hex').toUpperCase()}`
}

const ORDER_INCLUDE = {
  items: {
    include: { menu: { select: { name: true, category: true } } },
  },
  table: { select: { number: true } },
  /**
   * Percobaan bayar terakhir saja. Riwayat lengkapnya jarang dibutuhkan, dan
   * yang menentukan keadaan pesanan sekarang memang yang paling akhir.
   */
  payments: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      status: true,
      channel: true,
      amount: true,
      paidAt: true,
    },
  },
} as const

/**
 * Buat pesanan berstatus PENDING.
 *
 * Stok BELUM dipotong di sini — pemotongan terjadi saat kasir konfirmasi.
 * Cek ketersediaan di sini cuma saringan awal supaya pelanggan tidak
 * mengirim pesanan yang sudah pasti ditolak; keputusan sesungguhnya diambil
 * di confirmOrder() setelah baris stok dikunci.
 */
export async function createOrder(input: CreateOrderInput) {
  // Dua pengaturan toko diperiksa di sini, bukan cuma di tombolnya. Tombol
  // yang disembunyikan tetap bisa dilewati dengan memanggil endpoint-nya.
  if (!(await flagNyala('toko.pesananOnline'))) {
    throw conflict('Kafe sedang tidak menerima pesanan online')
  }

  if (!input.tableId && (await flagNyala('toko.wajibMeja'))) {
    throw badRequest('Pilih dulu nomor meja sebelum mengirim pesanan')
  }

  const menuIds = [...new Set(input.items.map((i) => i.menuId))]

  const menus = await prisma.menu.findMany({
    where: { id: { in: menuIds }, isActive: true },
    include: { recipes: { select: { ingredientId: true, qty: true } } },
  })

  if (menus.length !== menuIds.length) {
    throw badRequest('Ada menu yang tidak tersedia atau sudah tidak aktif')
  }

  const menuById = new Map(menus.map((m) => [m.id, m]))

  /**
   * Harga yang dipakai selalu diambil dari database, bukan dari yang dikirim
   * browser — dan kalau menunya sedang promo, yang berlaku harga promonya.
   *
   * Dihitung sekali di sini lalu dipakai untuk total dan untuk tiap baris,
   * supaya keduanya tidak mungkin memakai angka yang berbeda kalau promonya
   * kebetulan berakhir di tengah proses.
   */
  const promoNyala = await flagNyala('modul.promo')
  const sekarang = new Date()

  const hargaPakai = new Map(
    menus.map((m) => [m.id, hargaBerlaku(promoNyala ? m : { price: m.price }, sekarang)]),
  )

  const total = input.items.reduce((sum, item) => {
    return sum.plus(hargaPakai.get(item.menuId)!.mul(item.qty))
  }, new Decimal(0))

  const reservasiStok = await aturanReservasiStok()
  await sapuReservasiStok()

  const dataPesanan = {
    code: generateCode(),
    tableId: input.tableId ?? null,
    customerName: input.customerName ?? null,
    note: input.note ?? null,
    paymentMethod: input.paymentMethod,
    total: total.toFixed(2),
    items: {
      create: input.items.map((item) => ({
        menuId: item.menuId,
        qty: item.qty,
        unitPrice: hargaPakai.get(item.menuId)!.toFixed(2),
        note: item.note ?? null,
      })),
    },
  }

  if (!reservasiStok.nyala) {
    const order = await prisma.order.create({
      data: dataPesanan,
      include: ORDER_INCLUDE,
    })

    orderEvents.emit('changed', { type: 'created', orderId: order.id })
    return order
  }

  /**
   * Penyisihan bahan, di dalam satu transaksi dengan pembuatan pesanannya.
   *
   * Urutannya sama dengan confirmOrder dan dengan alasan yang sama: kunci
   * baris stoknya dulu, baru baca. Membaca sebelum mengunci membuat dua
   * pesanan bersamaan sama-sama melihat sisa yang sama lalu sama-sama lolos.
   *
   * Bedanya dengan confirmOrder, di sini tidak ada yang dipotong. Yang
   * dicatat cuma janji bahwa bahan sekian disisihkan untuk pesanan ini
   * selama beberapa menit ke depan.
   */
  const recipesByMenu = new Map<string, RecipeLine[]>(
    menus.map((m) => [
      m.id,
      m.recipes.map((r) => ({ ingredientId: r.ingredientId, qty: r.qty.toString() })),
    ]),
  )

  const kebutuhan = requiredIngredients(
    input.items.map((i) => ({ menuId: i.menuId, qty: i.qty })),
    recipesByMenu,
  )

  const order = await prisma.$transaction(async (tx) => {
    const terkunci = await lockStocks(tx, [...kebutuhan.keys()])
    const dipesanLain = await reservasiAktif(tx, {
      ingredientIds: [...kebutuhan.keys()],
    })

    const tersedia = sisaSetelahReservasi(terkunci, dipesanLain)
    const kurang = findShortages(kebutuhan, tersedia)

    if (kurang.length > 0) {
      const nama = await tx.ingredient.findMany({
        where: { id: { in: kurang.map((k) => k.ingredientId) } },
        select: { id: true, name: true },
      })
      const namaById = new Map(nama.map((n) => [n.id, n.name]))

      throw insufficientStock(
        kurang.map((k) => ({
          ingredient: namaById.get(k.ingredientId) ?? k.ingredientId,
          needed: k.needed.toString(),
          available: k.available.toString(),
        })),
      )
    }

    const dibuat = await tx.order.create({ data: dataPesanan, include: ORDER_INCLUDE })

    await buatReservasi(tx, dibuat.id, kebutuhan, reservasiStok.menit)

    return dibuat
  })

  orderEvents.emit('changed', { type: 'created', orderId: order.id })

  return order
}

/**
 * Konfirmasi pesanan — di sinilah stok dipotong.
 *
 * Seluruh isinya satu transaksi:
 *   1. kunci baris stok semua bahan yang terlibat (FOR UPDATE)
 *   2. hitung kebutuhan dari resep
 *   3. kalau ada yang kurang → lempar error, transaksi dibatalkan utuh
 *   4. tulis movement SALE + perbarui cache
 *   5. ubah status pesanan
 *
 * Kalau langkah 3 gagal, tidak ada satu pun bahan yang terpotong.
 */
export async function confirmOrder(orderId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })

    if (!order) throw notFound('Pesanan tidak ditemukan')
    if (order.status !== 'PENDING') {
      throw conflict(`Pesanan sudah berstatus ${order.status}, tidak bisa dikonfirmasi lagi`)
    }

    const menus = await tx.menu.findMany({
      where: { id: { in: order.items.map((i) => i.menuId) } },
      include: { recipes: { select: { ingredientId: true, qty: true } } },
    })

    const recipesByMenu = new Map<string, RecipeLine[]>(
      menus.map((m) => [
        m.id,
        m.recipes.map((r) => ({ ingredientId: r.ingredientId, qty: r.qty.toString() })),
      ]),
    )

    const needed = requiredIngredients(
      order.items.map((i) => ({ menuId: i.menuId, qty: i.qty })),
      recipesByMenu,
    )

    // Kunci dulu, baru baca. Urutannya penting: membaca sebelum mengunci
    // membuat angka yang dipakai bisa sudah basi.
    const locked = await lockStocks(tx, [...needed.keys()])

    const shortages: { ingredientId: string; needed: Decimal; available: Decimal }[] = []
    for (const [ingredientId, need] of needed) {
      const have = locked.get(ingredientId) ?? new Decimal(0)
      if (have.lt(need)) shortages.push({ ingredientId, needed: need, available: have })
    }

    if (shortages.length > 0) {
      const names = await tx.ingredient.findMany({
        where: { id: { in: shortages.map((s) => s.ingredientId) } },
        select: { id: true, name: true, baseUnit: true },
      })
      const nameById = new Map(names.map((n) => [n.id, n]))

      throw insufficientStock(
        shortages.map((s) => {
          const info = nameById.get(s.ingredientId)
          const unit = info?.baseUnit.toLowerCase() ?? ''
          return {
            ingredient: info?.name ?? s.ingredientId,
            needed: `${s.needed.toString()} ${unit}`.trim(),
            available: `${s.available.toString()} ${unit}`.trim(),
          }
        }),
      )
    }

    const avgCosts = await tx.ingredient.findMany({
      where: { id: { in: [...needed.keys()] } },
      select: { id: true, avgCost: true },
    })
    const costById = new Map(avgCosts.map((c) => [c.id, new Decimal(c.avgCost.toString())]))

    const movements: MovementInput[] = [...needed].map(([ingredientId, qty]) => ({
      ingredientId,
      qty: qty.neg(),
      type: 'SALE' as const,
      refType: 'order',
      refId: order.id,
      unitCost: costById.get(ingredientId),
    }))

    await applyMovements(tx, movements)

    /**
     * Penyisihannya dilepas setelah bahannya benar-benar dipotong.
     *
     * Kalau tidak, bahan yang sama terhitung dua kali: sekali sebagai
     * pengurangan di ledger, sekali lagi sebagai janji yang masih berdiri.
     * Stok yang tampil di katalog akan lebih kecil dari kenyataannya.
     *
     * Reservasi milik pesanan LAIN sengaja tidak disentuh. Kasir sedang
     * melayani tamu yang nyata di depannya, dan yang menentukan boleh atau
     * tidaknya adalah stok fisik, bukan janji ke orang yang belum sampai.
     */
    await lepasReservasi(tx, order.id)

    return tx.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
      include: ORDER_INCLUDE,
    })
  })

  orderEvents.emit('changed', { type: 'confirmed', orderId })

  return result
}

/**
 * Batalkan pesanan.
 *
 * Kalau stok sudah terpotong (status sudah lewat CONFIRMED), bahan dikembalikan
 * lewat movement RETURN — bukan dengan menghapus movement SALE-nya. Riwayat
 * harus tetap menunjukkan bahwa penjualan itu pernah terjadi lalu dibatalkan.
 */
export async function cancelOrder(orderId: string, reason?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })

    if (!order) throw notFound('Pesanan tidak ditemukan')
    if (order.status === 'CANCELLED') throw conflict('Pesanan sudah dibatalkan')
    if (order.status === 'DONE') throw conflict('Pesanan sudah selesai, tidak bisa dibatalkan')

    if (order.confirmedAt) {
      const sales = await tx.stockMovement.findMany({
        where: { refType: 'order', refId: order.id, type: 'SALE' },
      })

      await applyMovements(
        tx,
        sales.map((s) => ({
          ingredientId: s.ingredientId,
          qty: new Decimal(s.qty.toString()).neg(), // kebalikan dari yang dipotong
          type: 'RETURN' as const,
          refType: 'order',
          refId: order.id,
          unitCost: s.unitCost ? new Decimal(s.unitCost.toString()) : undefined,
          note: reason ?? 'Pesanan dibatalkan',
        })),
      )
    }

    // Pesanan yang batal melepaskan bahan yang sempat disisihkan untuknya,
    // baik sudah dikonfirmasi maupun belum.
    await lepasReservasi(tx, order.id)

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        note: reason ? `${order.note ? `${order.note} — ` : ''}Batal: ${reason}` : order.note,
      },
      include: ORDER_INCLUDE,
    })
  })

  orderEvents.emit('changed', { type: 'cancelled', orderId })

  return result
}

/** Urutan status yang boleh dilewati — mencegah pesanan mundur ke belakang. */
const NEXT_STATUS: Record<string, string[]> = {
  CONFIRMED: ['PREPARING', 'READY', 'DONE'],
  PREPARING: ['READY', 'DONE'],
  READY: ['DONE'],
}

export async function advanceStatus(
  orderId: string,
  status: 'PREPARING' | 'READY' | 'DONE',
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw notFound('Pesanan tidak ditemukan')

  const allowed = NEXT_STATUS[order.status] ?? []
  if (!allowed.includes(status)) {
    throw conflict(`Pesanan berstatus ${order.status} tidak bisa diubah ke ${status}`)
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: ORDER_INCLUDE,
  })

  orderEvents.emit('changed', { type: 'status', orderId })

  return updated
}

export async function getOrderByCode(code: string) {
  const order = await prisma.order.findUnique({
    where: { code: code.toUpperCase() },
    include: ORDER_INCLUDE,
  })

  if (!order) throw notFound('Pesanan dengan kode itu tidak ada')

  return order
}

export async function listOrders(params: { status?: string; limit: number }) {
  const orders = await prisma.order.findMany({
    where: params.status ? { status: params.status as never } : undefined,
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: params.limit,
  })

  /**
   * Tandai pesanan yang mejanya sudah dipesan orang lain sebentar lagi.
   *
   * Satu query untuk semua meja sekaligus, bukan satu per pesanan. Papan
   * kasir memuat puluhan pesanan dan sebagian besar berbagi meja yang sama.
   */
  const tableIds = [...new Set(orders.map((o) => o.tableId).filter(Boolean))] as string[]
  const reservasi = await reservasiMejaTerdekat(tableIds)

  return orders.map((o) => {
    const r = o.tableId ? reservasi.get(o.tableId) : undefined

    return {
      ...o,
      /**
       * Null untuk hampir semua pesanan. Yang terisi berarti baristanya perlu
       * tahu: tamu ini duduk di meja yang sudah dijanjikan ke orang lain.
       */
      tableReservation: r
        ? { startAt: r.startAt, customerName: r.customerName, guestCount: r.guestCount }
        : null,
    }
  })
}
