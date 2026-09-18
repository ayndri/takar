import { randomBytes } from 'node:crypto'
import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, insufficientStock, notFound } from '../../lib/errors.js'
import { requiredIngredients, type RecipeLine } from '../stock/stock-calculator.js'
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
  const menuIds = [...new Set(input.items.map((i) => i.menuId))]

  const menus = await prisma.menu.findMany({
    where: { id: { in: menuIds }, isActive: true },
    include: { recipes: { select: { ingredientId: true, qty: true } } },
  })

  if (menus.length !== menuIds.length) {
    throw badRequest('Ada menu yang tidak tersedia atau sudah tidak aktif')
  }

  const menuById = new Map(menus.map((m) => [m.id, m]))

  // Harga disalin dari database, bukan dari yang dikirim browser.
  const total = input.items.reduce((sum, item) => {
    const menu = menuById.get(item.menuId)!
    return sum.plus(new Decimal(menu.price.toString()).mul(item.qty))
  }, new Decimal(0))

  const order = await prisma.order.create({
    data: {
      code: generateCode(),
      tableId: input.tableId ?? null,
      customerName: input.customerName ?? null,
      note: input.note ?? null,
      total: total.toFixed(2),
      items: {
        create: input.items.map((item) => ({
          menuId: item.menuId,
          qty: item.qty,
          unitPrice: menuById.get(item.menuId)!.price,
          note: item.note ?? null,
        })),
      },
    },
    include: ORDER_INCLUDE,
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
  return prisma.order.findMany({
    where: params.status ? { status: params.status as never } : undefined,
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: params.limit,
  })
}
