import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest } from '../../lib/errors.js'
import { applyMovements } from '../stock/stock.service.js'

export type WasteReason = 'SPILLED' | 'EXPIRED' | 'MISTAKE' | 'OTHER'

/**
 * Catat bahan yang terbuang.
 *
 * Inilah yang menjawab "uangnya bocor ke mana". Dipisah dari penjualan supaya
 * selisih stok punya sebab yang bisa dibaca, bukan cuma angka yang tidak cocok.
 *
 * Stok boleh jadi minus di sini — kalau barista mencatat tumpahan lebih banyak
 * dari yang tercatat sistem, itu justru tanda catatan sebelumnya yang salah,
 * dan menolaknya malah menyembunyikan masalah.
 */
export async function createWaste(input: {
  ingredientId: string
  qty: number
  reason: WasteReason
  note?: string
  userId: string
}) {
  if (input.qty <= 0) throw badRequest('Jumlah yang terbuang harus lebih dari nol')

  const ingredient = await prisma.ingredient.findUnique({
    where: { id: input.ingredientId },
    select: { id: true, avgCost: true },
  })

  if (!ingredient) throw badRequest('Bahan tidak ditemukan')

  return prisma.$transaction(async (tx) => {
    const log = await tx.wasteLog.create({
      data: {
        ingredientId: input.ingredientId,
        qty: new Decimal(input.qty).toFixed(3),
        reason: input.reason,
        note: input.note ?? null,
        userId: input.userId,
      },
      include: { ingredient: { select: { name: true, baseUnit: true } } },
    })

    await applyMovements(tx, [
      {
        ingredientId: input.ingredientId,
        qty: new Decimal(input.qty).neg(),
        type: 'WASTE',
        refType: 'waste',
        refId: log.id,
        unitCost: new Decimal(ingredient.avgCost.toString()),
        note: input.note,
      },
    ])

    return log
  })
}

export async function listWaste(params: { from?: string; to?: string; limit?: number } = {}) {
  const logs = await prisma.wasteLog.findMany({
    where: {
      createdAt: {
        ...(params.from && { gte: new Date(params.from) }),
        ...(params.to && { lte: new Date(params.to) }),
      },
    },
    include: {
      ingredient: { select: { name: true, baseUnit: true, avgCost: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: params.limit ?? 100,
  })

  return logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt,
    ingredient: l.ingredient.name,
    baseUnit: l.ingredient.baseUnit,
    qty: l.qty.toString(),
    value: new Decimal(l.qty.toString()).mul(l.ingredient.avgCost.toString()).toFixed(2),
    reason: l.reason,
    note: l.note,
    by: l.user.name,
  }))
}
