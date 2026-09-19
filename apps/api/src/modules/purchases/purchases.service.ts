import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { toBaseQty, unitCostPerBase, weightedAverageCost } from '../stock/stock-calculator.js'
import { applyMovements, lockStocks, type MovementInput } from '../stock/stock.service.js'
import { hitungBukti, kaitkan } from '../attachments/attachments.service.js'

export type CreatePurchaseInput = {
  supplier: string
  date?: string
  note?: string
  /** Id berkas bukti yang sudah diunggah lebih dulu. Wajib minimal satu. */
  attachmentIds: string[]
  items: {
    ingredientId: string
    purchaseUnitId?: string
    qty: number
    unitPrice: number
  }[]
}

/**
 * Catat barang masuk.
 *
 * Tiga hal terjadi bersamaan dan harus berhasil semua:
 *   - nota pembelian tersimpan
 *   - stok bertambah lewat movement PURCHASE
 *   - harga rata-rata tertimbang tiap bahan dihitung ulang
 *
 * Harga rata-rata butuh stok sebelum penambahan, jadi barisnya dikunci dulu
 * supaya pembelian yang masuk bersamaan tidak sama-sama memakai angka lama.
 */
export async function createPurchase(input: CreatePurchaseInput) {
  if (input.items.length === 0) throw badRequest('Nota harus berisi minimal satu bahan')

  // Ini satu-satunya tempat uang keluar ke pihak luar. Tanpa foto notanya,
  // tidak ada yang bisa mencocokkan angka di sini dengan kenyataan.
  if (input.attachmentIds.length === 0) {
    throw badRequest('Nota pembelian harus disertai foto bukti')
  }

  return prisma.$transaction(async (tx) => {
    const ingredientIds = [...new Set(input.items.map((i) => i.ingredientId))]

    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: ingredientIds } },
      include: { purchaseUnits: true },
    })

    if (ingredients.length !== ingredientIds.length) {
      throw badRequest('Ada bahan yang tidak ditemukan')
    }

    const ingredientById = new Map(ingredients.map((i) => [i.id, i]))
    const locked = await lockStocks(tx, ingredientIds)

    let total = new Decimal(0)
    const movements: MovementInput[] = []
    const purchaseItems: {
      ingredientId: string
      purchaseUnitId: string | null
      qty: string
      unitPrice: string
      baseQty: string
    }[] = []

    // Beberapa baris nota bisa menyebut bahan yang sama (dua merek susu, misalnya),
    // jadi stok berjalan dilacak per bahan selama perulangan.
    const runningQty = new Map<string, Decimal>()
    const runningCost = new Map<string, Decimal>()

    for (const item of input.items) {
      const ingredient = ingredientById.get(item.ingredientId)!

      // Tanpa satuan beli, jumlah dianggap sudah dalam satuan dasar.
      let factor = new Decimal(1)
      if (item.purchaseUnitId) {
        const unit = ingredient.purchaseUnits.find((u) => u.id === item.purchaseUnitId)
        if (!unit) {
          throw badRequest(`Satuan beli tidak cocok dengan bahan ${ingredient.name}`)
        }
        factor = new Decimal(unit.factor.toString())
      }

      const baseQty = toBaseQty(item.qty, factor)
      const costPerBase = unitCostPerBase(item.unitPrice, factor)

      const currentQty =
        runningQty.get(item.ingredientId) ??
        locked.get(item.ingredientId) ??
        new Decimal(0)
      const currentAvg =
        runningCost.get(item.ingredientId) ?? new Decimal(ingredient.avgCost.toString())

      const newAvg = weightedAverageCost({
        currentQty,
        currentAvgCost: currentAvg,
        incomingQty: baseQty,
        incomingUnitCost: costPerBase,
      })

      runningQty.set(item.ingredientId, currentQty.plus(baseQty))
      runningCost.set(item.ingredientId, newAvg)

      total = total.plus(new Decimal(item.unitPrice).mul(item.qty))

      purchaseItems.push({
        ingredientId: item.ingredientId,
        purchaseUnitId: item.purchaseUnitId ?? null,
        qty: new Decimal(item.qty).toFixed(3),
        unitPrice: new Decimal(item.unitPrice).toFixed(2),
        baseQty: baseQty.toFixed(3),
      })

      movements.push({
        ingredientId: item.ingredientId,
        qty: baseQty,
        type: 'PURCHASE',
        unitCost: costPerBase,
      })
    }

    const purchase = await tx.purchase.create({
      data: {
        supplier: input.supplier,
        date: input.date ? new Date(input.date) : new Date(),
        note: input.note ?? null,
        total: total.toFixed(2),
        items: { create: purchaseItems },
      },
      include: { items: true },
    })

    // Dikaitkan di dalam transaksi yang sama: kalau nota gagal disimpan,
    // buktinya juga tidak jadi menempel ke dokumen mana pun.
    await kaitkan(tx, input.attachmentIds, 'purchase', purchase.id)

    await applyMovements(
      tx,
      movements.map((m) => ({ ...m, refType: 'purchase', refId: purchase.id })),
    )

    for (const [ingredientId, avg] of runningCost) {
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { avgCost: avg.toFixed(4) },
      })
    }

    return purchase
  })
}

export async function listPurchases(limit = 50) {
  const rows = await prisma.purchase.findMany({
    include: {
      items: {
        include: {
          ingredient: { select: { name: true, baseUnit: true } },
          purchaseUnit: { select: { name: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
    take: limit,
  })

  // Nota lama dari sebelum bukti diwajibkan tetap ada, jadi daftarnya perlu
  // menunjukkan mana yang belum punya bukti.
  const jumlahBukti = await hitungBukti(
    'purchase',
    rows.map((r) => r.id),
  )

  return rows.map((r) => ({ ...r, buktiCount: jumlahBukti.get(r.id) ?? 0 }))
}

export async function getPurchase(id: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          ingredient: { select: { name: true, baseUnit: true } },
          purchaseUnit: { select: { name: true } },
        },
      },
    },
  })

  if (!purchase) throw notFound('Nota pembelian tidak ditemukan')

  return purchase
}
