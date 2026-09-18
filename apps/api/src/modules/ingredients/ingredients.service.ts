import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { notFound } from '../../lib/errors.js'

export async function listIngredients() {
  const rows = await prisma.ingredient.findMany({
    where: { isActive: true },
    include: {
      stock: { select: { qty: true } },
      purchaseUnits: { select: { id: true, name: true, factor: true } },
    },
    orderBy: { name: 'asc' },
  })

  return rows.map((r) => {
    const qty = new Decimal(r.stock?.qty.toString() ?? 0)
    const minStock = new Decimal(r.minStock.toString())

    return {
      id: r.id,
      name: r.name,
      baseUnit: r.baseUnit,
      qty: qty.toString(),
      minStock: minStock.toString(),
      avgCost: r.avgCost.toString(),
      value: qty.mul(r.avgCost.toString()).toFixed(2),
      isLow: qty.lte(minStock),
      purchaseUnits: r.purchaseUnits.map((u) => ({
        id: u.id,
        name: u.name,
        factor: u.factor.toString(),
      })),
    }
  })
}

/**
 * Kartu stok: seluruh riwayat pergerakan satu bahan, plus saldo berjalan.
 *
 * Saldo dihitung maju dari movement paling lama, jadi tiap baris menunjukkan
 * stok setelah kejadian itu — persis seperti buku kas.
 */
export async function getStockCard(ingredientId: string, limit = 200) {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    include: { stock: { select: { qty: true } } },
  })

  if (!ingredient) throw notFound('Bahan tidak ditemukan')

  const movements = await prisma.stockMovement.findMany({
    where: { ingredientId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let balance = new Decimal(0)
  const rows = movements.map((m) => {
    balance = balance.plus(m.qty.toString())
    return {
      id: m.id,
      createdAt: m.createdAt,
      type: m.type,
      qty: m.qty.toString(),
      balance: balance.toString(),
      refType: m.refType,
      refId: m.refId,
      unitCost: m.unitCost?.toString() ?? null,
      note: m.note,
    }
  })

  return {
    ingredient: {
      id: ingredient.id,
      name: ingredient.name,
      baseUnit: ingredient.baseUnit,
      avgCost: ingredient.avgCost.toString(),
    },
    // Kalau dua angka ini beda, cache-nya melenceng dari ledger.
    currentQty: ingredient.stock?.qty.toString() ?? '0',
    ledgerQty: balance.toString(),
    movements: rows,
  }
}

export async function createIngredient(input: {
  name: string
  baseUnit: 'G' | 'ML' | 'PCS'
  minStock?: number
  purchaseUnits?: { name: string; factor: number }[]
}) {
  return prisma.ingredient.create({
    data: {
      name: input.name,
      baseUnit: input.baseUnit,
      minStock: new Decimal(input.minStock ?? 0).toFixed(3),
      ...(input.purchaseUnits?.length && {
        purchaseUnits: {
          create: input.purchaseUnits.map((u) => ({
            name: u.name,
            factor: new Decimal(u.factor).toFixed(4),
          })),
        },
      }),
      stock: { create: { qty: 0 } },
    },
    include: { purchaseUnits: true },
  })
}
