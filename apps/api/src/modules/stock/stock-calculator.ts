import { Decimal } from 'decimal.js'

/**
 * Hitungan stok yang berdiri sendiri — tanpa database, tanpa Express.
 * Semua fungsi di sini murni, supaya bisa diuji tanpa menyiapkan apa pun.
 *
 * Satu aturan: tidak ada `number` untuk qty maupun uang. Float bikin
 * 18 g x 3 jadi 53.99999999, dan selisih sekecil itu menumpuk di ledger.
 */

export type DecimalLike = Decimal | string | number

const d = (v: DecimalLike) => new Decimal(v)

// ─────────────────── konversi satuan ───────────────────

/**
 * Ubah jumlah dalam satuan beli ke satuan dasar.
 * Contoh: 2 karton susu, faktor 12000 ml/karton → 24000 ml.
 */
export function toBaseQty(qty: DecimalLike, factor: DecimalLike): Decimal {
  const f = d(factor)
  if (f.lte(0)) {
    throw new Error('Faktor konversi harus lebih besar dari nol')
  }
  return d(qty).mul(f)
}

/**
 * Harga per satuan dasar, dari harga per satuan beli.
 * Contoh: Rp 180.000 per karton 12000 ml → Rp 15 per ml.
 */
export function unitCostPerBase(
  purchasePrice: DecimalLike,
  factor: DecimalLike,
): Decimal {
  const f = d(factor)
  if (f.lte(0)) {
    throw new Error('Faktor konversi harus lebih besar dari nol')
  }
  return d(purchasePrice).div(f)
}

// ─────────────────── kebutuhan bahan dari resep ───────────────────

export type RecipeLine = { ingredientId: string; qty: DecimalLike }
export type OrderLine = { menuId: string; qty: number }

/**
 * Berapa banyak tiap bahan yang dibutuhkan satu pesanan.
 *
 * Satu bahan bisa muncul di beberapa menu (cup dipakai semua minuman),
 * jadi hasilnya dijumlahkan per bahan — bukan per baris pesanan.
 */
export function requiredIngredients(
  orderLines: OrderLine[],
  recipesByMenu: Map<string, RecipeLine[]>,
): Map<string, Decimal> {
  const needed = new Map<string, Decimal>()

  for (const line of orderLines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new Error(`Jumlah pesanan untuk menu ${line.menuId} harus bilangan bulat positif`)
    }

    const recipe = recipesByMenu.get(line.menuId)
    if (!recipe) {
      throw new Error(`Menu ${line.menuId} belum punya resep`)
    }

    for (const item of recipe) {
      const add = d(item.qty).mul(line.qty)
      const current = needed.get(item.ingredientId) ?? new Decimal(0)
      needed.set(item.ingredientId, current.plus(add))
    }
  }

  return needed
}

export type Shortage = {
  ingredientId: string
  needed: Decimal
  available: Decimal
  short: Decimal
}

/**
 * Bahan apa saja yang kurang. Array kosong berarti pesanan bisa dilayani.
 *
 * Dipanggil DI DALAM transaksi, setelah baris stok dikunci — dipanggil di
 * luar transaksi hasilnya bisa basi begitu ada pesanan lain yang masuk.
 */
export function findShortages(
  needed: Map<string, Decimal>,
  available: Map<string, DecimalLike>,
): Shortage[] {
  const shortages: Shortage[] = []

  for (const [ingredientId, need] of needed) {
    const have = d(available.get(ingredientId) ?? 0)
    if (have.lt(need)) {
      shortages.push({
        ingredientId,
        needed: need,
        available: have,
        short: need.minus(have),
      })
    }
  }

  return shortages
}

/**
 * Berapa porsi menu ini yang masih bisa dibuat dengan stok sekarang.
 * Dipakai untuk menandai menu "Habis" di katalog pelanggan.
 *
 * Resep kosong → 0, bukan tak terhingga: menu tanpa resep belum siap dijual.
 */
export function maxPortions(
  recipe: RecipeLine[],
  available: Map<string, DecimalLike>,
): number {
  if (recipe.length === 0) return 0

  let limit = Infinity

  for (const item of recipe) {
    const per = d(item.qty)
    if (per.lte(0)) continue // bahan dengan takaran nol tidak membatasi apa pun

    const have = d(available.get(item.ingredientId) ?? 0)
    const portions = have.div(per).floor().toNumber()
    if (portions < limit) limit = portions
  }

  return limit === Infinity ? 0 : Math.max(0, limit)
}

// ─────────────────── harga rata-rata tertimbang ───────────────────

/**
 * Harga rata-rata baru setelah barang masuk.
 *
 *   (stok lama x harga lama + stok masuk x harga masuk) / total stok
 *
 * Stok lama negatif (pernah kejual lebih banyak dari yang tercatat) dianggap
 * nol, supaya harga rata-rata tidak ikut jadi ngawur gara-gara data yang rusak.
 */
export function weightedAverageCost(params: {
  currentQty: DecimalLike
  currentAvgCost: DecimalLike
  incomingQty: DecimalLike
  incomingUnitCost: DecimalLike
}): Decimal {
  const currentQty = Decimal.max(d(params.currentQty), 0)
  const incomingQty = d(params.incomingQty)

  if (incomingQty.lte(0)) {
    throw new Error('Jumlah barang masuk harus lebih besar dari nol')
  }

  const totalQty = currentQty.plus(incomingQty)
  const totalValue = currentQty
    .mul(d(params.currentAvgCost))
    .plus(incomingQty.mul(d(params.incomingUnitCost)))

  return totalValue.div(totalQty)
}

/**
 * Harga pokok satu porsi menu = jumlah (takaran x harga rata-rata bahan).
 */
export function menuCost(
  recipe: RecipeLine[],
  avgCostByIngredient: Map<string, DecimalLike>,
): Decimal {
  return recipe.reduce((total, item) => {
    const cost = d(avgCostByIngredient.get(item.ingredientId) ?? 0)
    return total.plus(d(item.qty).mul(cost))
  }, new Decimal(0))
}

/** Margin dalam rupiah dan persen, dari harga jual dan HPP. */
export function menuMargin(price: DecimalLike, cost: DecimalLike) {
  const p = d(price)
  const c = d(cost)
  const profit = p.minus(c)
  return {
    profit,
    percent: p.lte(0) ? new Decimal(0) : profit.div(p).mul(100),
  }
}

// ─────────────────── stock opname ───────────────────

/**
 * Selisih hasil hitung fisik. Positif = fisik lebih banyak dari catatan.
 * Angka inilah yang jadi movement ADJUSTMENT — catatan lama tidak ditimpa.
 */
export function opnameDiff(systemQty: DecimalLike, physicalQty: DecimalLike): Decimal {
  return d(physicalQty).minus(d(systemQty))
}

/** Nilai rupiah dari selisih opname, untuk laporan bulanan. */
export function opnameValue(diff: DecimalLike, avgCost: DecimalLike): Decimal {
  return d(diff).mul(d(avgCost))
}
