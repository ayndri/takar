import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { menuCost, menuMargin, type RecipeLine } from '../stock/stock-calculator.js'
import { getAvgCostMap } from '../stock/stock.service.js'

type Range = { from?: string; to?: string }

const rangeFilter = (range: Range) => ({
  ...(range.from && { gte: new Date(range.from) }),
  ...(range.to && { lte: new Date(range.to) }),
})

/** Nilai persediaan sekarang: stok x harga rata-rata, per bahan dan totalnya. */
export async function inventoryValue() {
  const rows = await prisma.ingredient.findMany({
    where: { isActive: true },
    include: { stock: { select: { qty: true } } },
    orderBy: { name: 'asc' },
  })

  let total = new Decimal(0)

  const items = rows.map((r) => {
    const qty = new Decimal(r.stock?.qty.toString() ?? 0)
    const value = qty.mul(r.avgCost.toString())
    total = total.plus(value)

    return {
      id: r.id,
      name: r.name,
      baseUnit: r.baseUnit,
      qty: qty.toString(),
      avgCost: r.avgCost.toString(),
      value: value.toFixed(2),
      minStock: r.minStock.toString(),
      isLow: qty.lte(r.minStock.toString()),
    }
  })

  return {
    total: total.toFixed(2),
    lowCount: items.filter((i) => i.isLow).length,
    items,
  }
}

/** Bahan yang stoknya sudah di bawah ambang — yang perlu dibeli minggu ini. */
export async function lowStock() {
  const { items } = await inventoryValue()
  return items.filter((i) => i.isLow)
}

/**
 * Rekap pembuangan: total rupiah, pecahan per alasan, dan bahan paling boros.
 * Inilah jawaban untuk "uangnya bocor ke mana".
 */
export async function wasteSummary(range: Range = {}) {
  const logs = await prisma.wasteLog.findMany({
    where: { createdAt: rangeFilter(range) },
    include: { ingredient: { select: { name: true, baseUnit: true, avgCost: true } } },
  })

  let total = new Decimal(0)
  const byReason = new Map<string, Decimal>()
  const byIngredient = new Map<string, { name: string; baseUnit: string; qty: Decimal; value: Decimal }>()

  for (const log of logs) {
    const qty = new Decimal(log.qty.toString())
    const value = qty.mul(log.ingredient.avgCost.toString())

    total = total.plus(value)
    byReason.set(log.reason, (byReason.get(log.reason) ?? new Decimal(0)).plus(value))

    const current = byIngredient.get(log.ingredientId) ?? {
      name: log.ingredient.name,
      baseUnit: log.ingredient.baseUnit,
      qty: new Decimal(0),
      value: new Decimal(0),
    }

    byIngredient.set(log.ingredientId, {
      ...current,
      qty: current.qty.plus(qty),
      value: current.value.plus(value),
    })
  }

  return {
    total: total.toFixed(2),
    count: logs.length,
    byReason: [...byReason]
      .map(([reason, value]) => ({ reason, value: value.toFixed(2) }))
      .sort((a, b) => Number(b.value) - Number(a.value)),
    topIngredients: [...byIngredient]
      .map(([id, v]) => ({
        ingredientId: id,
        name: v.name,
        baseUnit: v.baseUnit,
        qty: v.qty.toString(),
        value: v.value.toFixed(2),
      }))
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 10),
  }
}

/**
 * Rekap penjualan.
 *
 * HPP dihitung dari movement SALE yang benar-benar tercatat — bukan dari harga
 * rata-rata hari ini. Jadi laba bulan lalu tidak ikut berubah saat harga
 * supplier naik bulan ini.
 */
export async function salesSummary(range: Range = {}) {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'DONE'] },
      confirmedAt: { not: null, ...rangeFilter(range) },
    },
    include: { items: { include: { menu: { select: { name: true } } } } },
  })

  const orderIds = orders.map((o) => o.id)

  const saleMovements = await prisma.stockMovement.findMany({
    where: { refType: 'order', refId: { in: orderIds }, type: 'SALE' },
    select: { qty: true, unitCost: true },
  })

  const cogs = saleMovements.reduce((sum, m) => {
    if (!m.unitCost) return sum
    // qty movement SALE bernilai negatif — dibalik supaya HPP positif.
    return sum.plus(new Decimal(m.qty.toString()).neg().mul(m.unitCost.toString()))
  }, new Decimal(0))

  let revenue = new Decimal(0)
  const byMenu = new Map<string, { name: string; qty: number; revenue: Decimal }>()

  for (const order of orders) {
    for (const item of order.items) {
      const lineRevenue = new Decimal(item.unitPrice.toString()).mul(item.qty)
      revenue = revenue.plus(lineRevenue)

      const current = byMenu.get(item.menuId) ?? {
        name: item.menu.name,
        qty: 0,
        revenue: new Decimal(0),
      }

      byMenu.set(item.menuId, {
        ...current,
        qty: current.qty + item.qty,
        revenue: current.revenue.plus(lineRevenue),
      })
    }
  }

  const grossProfit = revenue.minus(cogs)

  return {
    orderCount: orders.length,
    revenue: revenue.toFixed(2),
    cogs: cogs.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
    marginPercent: revenue.lte(0) ? '0.0' : grossProfit.div(revenue).mul(100).toFixed(1),
    topMenus: [...byMenu]
      .map(([id, v]) => ({
        menuId: id,
        name: v.name,
        qty: v.qty,
        revenue: v.revenue.toFixed(2),
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10),
  }
}

/** Pemakaian bahan per hari — untuk grafik tren. */
export async function usageTrend(range: Range = {}) {
  const movements = await prisma.stockMovement.findMany({
    where: { type: 'SALE', createdAt: rangeFilter(range) },
    select: { ingredientId: true, qty: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const byDay = new Map<string, Map<string, Decimal>>()

  for (const m of movements) {
    const day = m.createdAt.toISOString().slice(0, 10)
    const perIngredient = byDay.get(day) ?? new Map<string, Decimal>()
    const used = new Decimal(m.qty.toString()).neg()

    perIngredient.set(
      m.ingredientId,
      (perIngredient.get(m.ingredientId) ?? new Decimal(0)).plus(used),
    )
    byDay.set(day, perIngredient)
  }

  const names = await prisma.ingredient.findMany({ select: { id: true, name: true } })
  const nameById = new Map(names.map((n) => [n.id, n.name]))

  return [...byDay]
    .map(([date, perIngredient]) => ({
      date,
      items: [...perIngredient].map(([id, qty]) => ({
        ingredientId: id,
        name: nameById.get(id) ?? id,
        qty: qty.toString(),
      })),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** HPP dan margin tiap menu dengan harga bahan terkini. */
export async function menuMargins() {
  const [menus, avgCost] = await Promise.all([
    prisma.menu.findMany({
      where: { isActive: true },
      include: { recipes: { select: { ingredientId: true, qty: true } } },
      orderBy: { name: 'asc' },
    }),
    getAvgCostMap(),
  ])

  return menus
    .map((menu) => {
      const recipe: RecipeLine[] = menu.recipes.map((r) => ({
        ingredientId: r.ingredientId,
        qty: r.qty.toString(),
      }))

      const cost = menuCost(recipe, avgCost)
      const { profit, percent } = menuMargin(menu.price.toString(), cost)

      return {
        menuId: menu.id,
        name: menu.name,
        category: menu.category,
        price: menu.price.toString(),
        cost: cost.toFixed(2),
        profit: profit.toFixed(2),
        marginPercent: percent.toFixed(1),
      }
    })
    .sort((a, b) => Number(a.marginPercent) - Number(b.marginPercent))
}
