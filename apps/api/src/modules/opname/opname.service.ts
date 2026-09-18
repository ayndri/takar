import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { opnameDiff, opnameValue } from '../stock/stock-calculator.js'
import { applyMovements, lockStocks, type MovementInput } from '../stock/stock.service.js'

/**
 * Hitung fisik.
 *
 * Angka sistem TIDAK ditimpa. Selisihnya dicatat sebagai movement ADJUSTMENT,
 * jadi riwayat tetap menunjukkan berapa yang sempat tercatat dan seberapa jauh
 * melesetnya. Ini bedanya dengan "edit stok" yang menghapus jejak.
 */
export async function createOpname(input: {
  userId: string
  note?: string
  items: { ingredientId: string; physicalQty: number }[]
}) {
  if (input.items.length === 0) throw badRequest('Opname harus berisi minimal satu bahan')

  return prisma.$transaction(async (tx) => {
    const ingredientIds = [...new Set(input.items.map((i) => i.ingredientId))]
    const locked = await lockStocks(tx, ingredientIds)

    const opname = await tx.stockOpname.create({
      data: { userId: input.userId, note: input.note ?? null },
    })

    const movements: MovementInput[] = []

    for (const item of input.items) {
      const systemQty = locked.get(item.ingredientId) ?? new Decimal(0)
      const diff = opnameDiff(systemQty, item.physicalQty)

      await tx.opnameItem.create({
        data: {
          opnameId: opname.id,
          ingredientId: item.ingredientId,
          systemQty: systemQty.toFixed(3),
          physicalQty: new Decimal(item.physicalQty).toFixed(3),
          diff: diff.toFixed(3),
        },
      })

      // Cocok persis → tidak perlu movement sama sekali.
      if (!diff.isZero()) {
        movements.push({
          ingredientId: item.ingredientId,
          qty: diff,
          type: 'ADJUSTMENT',
          refType: 'opname',
          refId: opname.id,
          note: 'Penyesuaian hasil opname',
        })
      }
    }

    if (movements.length > 0) await applyMovements(tx, movements)

    return getOpnameInTx(tx, opname.id)
  })
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function getOpnameInTx(tx: Tx, id: string) {
  const opname = await tx.stockOpname.findUniqueOrThrow({
    where: { id },
    include: {
      user: { select: { name: true } },
      items: {
        include: { ingredient: { select: { name: true, baseUnit: true, avgCost: true } } },
      },
    },
  })

  return shapeOpname(opname)
}

function shapeOpname(opname: {
  id: string
  date: Date
  note: string | null
  user: { name: string }
  items: {
    ingredientId: string
    systemQty: unknown
    physicalQty: unknown
    diff: unknown
    ingredient: { name: string; baseUnit: string; avgCost: unknown }
  }[]
}) {
  let totalValue = new Decimal(0)

  const items = opname.items.map((i) => {
    const diff = new Decimal(String(i.diff))
    const value = opnameValue(diff, String(i.ingredient.avgCost))
    totalValue = totalValue.plus(value)

    return {
      ingredientId: i.ingredientId,
      name: i.ingredient.name,
      baseUnit: i.ingredient.baseUnit,
      systemQty: String(i.systemQty),
      physicalQty: String(i.physicalQty),
      diff: diff.toString(),
      value: value.toFixed(2),
    }
  })

  return {
    id: opname.id,
    date: opname.date,
    note: opname.note,
    by: opname.user.name,
    // Negatif berarti barang hilang — ini angka yang dilihat pemilik tiap bulan.
    totalValue: totalValue.toFixed(2),
    items,
  }
}

export async function getOpname(id: string) {
  const opname = await prisma.stockOpname.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      items: {
        include: { ingredient: { select: { name: true, baseUnit: true, avgCost: true } } },
      },
    },
  })

  if (!opname) throw notFound('Data opname tidak ditemukan')

  return shapeOpname(opname)
}

export async function listOpnames(limit = 30) {
  const rows = await prisma.stockOpname.findMany({
    include: {
      user: { select: { name: true } },
      items: {
        include: { ingredient: { select: { name: true, baseUnit: true, avgCost: true } } },
      },
    },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return rows.map(shapeOpname)
}

