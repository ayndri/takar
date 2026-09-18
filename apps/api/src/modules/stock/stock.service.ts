import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'

/** Prisma dalam transaksi punya tipe yang sedikit berbeda dari client biasa. */
type Db = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Stok semua bahan saat ini, dibaca dari tabel cache.
 *
 * Untuk katalog dan laporan ini cukup. Untuk memotong stok, JANGAN pakai ini —
 * pakai lockStocks() supaya dua pesanan bersamaan tidak sama-sama lolos.
 */
export async function getStockMap(db: Db = prisma): Promise<Map<string, Decimal>> {
  const rows = await db.ingredientStock.findMany({
    select: { ingredientId: true, qty: true },
  })

  return new Map(rows.map((r) => [r.ingredientId, new Decimal(r.qty.toString())]))
}

/** Harga rata-rata tertimbang tiap bahan — dasar perhitungan HPP. */
export async function getAvgCostMap(db: Db = prisma): Promise<Map<string, Decimal>> {
  const rows = await db.ingredient.findMany({
    select: { id: true, avgCost: true },
  })

  return new Map(rows.map((r) => [r.id, new Decimal(r.avgCost.toString())]))
}

/**
 * Kunci baris stok bahan tertentu di dalam transaksi, lalu kembalikan nilainya.
 *
 * `FOR UPDATE` membuat transaksi lain yang menyentuh bahan yang sama menunggu
 * sampai transaksi ini selesai. Tanpa ini, dua pesanan yang masuk bersamaan
 * bisa sama-sama membaca "cup tersisa 2" lalu sama-sama lolos.
 *
 * Bahan diurutkan supaya dua transaksi selalu mengunci dengan urutan yang sama —
 * kalau tidak, A menunggu B sementara B menunggu A (deadlock).
 */
export async function lockStocks(
  tx: Db,
  ingredientIds: string[],
): Promise<Map<string, Decimal>> {
  if (ingredientIds.length === 0) return new Map()

  const sorted = [...new Set(ingredientIds)].sort()

  const rows = await tx.$queryRawUnsafe<{ ingredient_id: string; qty: string }[]>(
    `select ingredient_id, qty::text
       from ingredient_stocks
      where ingredient_id = any($1::uuid[])
      order by ingredient_id
        for update`,
    sorted,
  )

  return new Map(rows.map((r) => [r.ingredient_id, new Decimal(r.qty)]))
}

export type MovementInput = {
  ingredientId: string
  /** Positif = masuk, negatif = keluar. Satuan dasar. */
  qty: Decimal
  type: 'PURCHASE' | 'SALE' | 'WASTE' | 'ADJUSTMENT' | 'RETURN' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  refType?: string
  refId?: string
  unitCost?: Decimal
  note?: string
}

/**
 * Tulis pergerakan stok ke ledger dan perbarui cache-nya.
 *
 * Wajib dipanggil di dalam transaksi: ledger dan cache harus berubah bersama,
 * atau tidak sama sekali.
 */
export async function applyMovements(tx: Db, movements: MovementInput[]) {
  for (const m of movements) {
    await tx.stockMovement.create({
      data: {
        ingredientId: m.ingredientId,
        qty: m.qty.toFixed(3),
        type: m.type,
        refType: m.refType ?? null,
        refId: m.refId ?? null,
        unitCost: m.unitCost ? m.unitCost.toFixed(4) : null,
        note: m.note ?? null,
      },
    })

    await tx.ingredientStock.upsert({
      where: { ingredientId: m.ingredientId },
      create: { ingredientId: m.ingredientId, qty: m.qty.toFixed(3) },
      update: { qty: { increment: m.qty.toFixed(3) } },
    })
  }
}

/**
 * Hitung ulang cache stok dari ledger. Jaring pengaman kalau cache dan
 * ledger sempat tidak sinkron — ledger selalu yang menang.
 */
export async function recalculateStockCache(ingredientId?: string) {
  const grouped = await prisma.stockMovement.groupBy({
    by: ['ingredientId'],
    _sum: { qty: true },
    ...(ingredientId && { where: { ingredientId } }),
  })

  for (const row of grouped) {
    const qty = (row._sum.qty ?? 0).toString()
    await prisma.ingredientStock.upsert({
      where: { ingredientId: row.ingredientId },
      create: { ingredientId: row.ingredientId, qty },
      update: { qty },
    })
  }

  return grouped.length
}
