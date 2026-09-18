import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  findShortages,
  maxPortions,
  menuCost,
  menuMargin,
  opnameDiff,
  opnameValue,
  requiredIngredients,
  toBaseQty,
  unitCostPerBase,
  weightedAverageCost,
  type RecipeLine,
} from './stock-calculator.js'

// Resep contoh yang dipakai berulang, sama dengan yang ada di ROADMAP.
const LATTE: RecipeLine[] = [
  { ingredientId: 'kopi', qty: 18 },
  { ingredientId: 'susu', qty: 150 },
  { ingredientId: 'cup', qty: 1 },
]

const ES_KOPI_SUSU: RecipeLine[] = [
  { ingredientId: 'kopi', qty: 20 },
  { ingredientId: 'susu', qty: 100 },
  { ingredientId: 'gula-aren', qty: 30 },
  { ingredientId: 'cup', qty: 1 },
]

const recipes = new Map([
  ['latte', LATTE],
  ['es-kopi-susu', ES_KOPI_SUSU],
])

describe('toBaseQty', () => {
  it('mengubah satuan beli ke satuan dasar', () => {
    // 2 karton susu, 1 karton = 12.000 ml
    expect(toBaseQty(2, 12000).toString()).toBe('24000')
  })

  it('tidak kehilangan presisi pada pecahan', () => {
    // 1,5 kg kopi = 1500 g — float bikin ini 1499.9999999999998
    expect(toBaseQty('1.5', 1000).toString()).toBe('1500')
  })

  it('menolak faktor nol atau negatif', () => {
    expect(() => toBaseQty(2, 0)).toThrow(/lebih besar dari nol/)
    expect(() => toBaseQty(2, -5)).toThrow(/lebih besar dari nol/)
  })
})

describe('unitCostPerBase', () => {
  it('membagi harga beli dengan faktor konversi', () => {
    // Rp 180.000 per karton 12.000 ml → Rp 15 per ml
    expect(unitCostPerBase(180000, 12000).toString()).toBe('15')
  })
})

describe('requiredIngredients', () => {
  it('menjumlahkan bahan yang dipakai beberapa menu sekaligus', () => {
    // 2 Latte + 1 Es Kopi Susu — persis contoh di ROADMAP
    const needed = requiredIngredients(
      [
        { menuId: 'latte', qty: 2 },
        { menuId: 'es-kopi-susu', qty: 1 },
      ],
      recipes,
    )

    expect(needed.get('kopi')?.toString()).toBe('56') // 18x2 + 20
    expect(needed.get('susu')?.toString()).toBe('400') // 150x2 + 100
    expect(needed.get('gula-aren')?.toString()).toBe('30')
    expect(needed.get('cup')?.toString()).toBe('3') // cup dipakai kedua menu
  })

  it('menolak menu yang belum punya resep', () => {
    expect(() =>
      requiredIngredients([{ menuId: 'croissant', qty: 1 }], recipes),
    ).toThrow(/belum punya resep/)
  })

  it('menolak jumlah pesanan yang bukan bilangan bulat positif', () => {
    expect(() => requiredIngredients([{ menuId: 'latte', qty: 0 }], recipes)).toThrow()
    expect(() => requiredIngredients([{ menuId: 'latte', qty: -1 }], recipes)).toThrow()
    expect(() => requiredIngredients([{ menuId: 'latte', qty: 1.5 }], recipes)).toThrow()
  })
})

describe('findShortages', () => {
  const needed = requiredIngredients(
    [
      { menuId: 'latte', qty: 2 },
      { menuId: 'es-kopi-susu', qty: 1 },
    ],
    recipes,
  )

  it('mengembalikan array kosong kalau semua bahan cukup', () => {
    const available = new Map<string, number>([
      ['kopi', 1000],
      ['susu', 5000],
      ['gula-aren', 500],
      ['cup', 50],
    ])

    expect(findShortages(needed, available)).toEqual([])
  })

  it('menemukan bahan yang kurang beserta jumlah kekurangannya', () => {
    // Skenario dari ROADMAP: semuanya cukup, tapi cup tinggal 2 padahal butuh 3
    const available = new Map<string, number>([
      ['kopi', 1000],
      ['susu', 5000],
      ['gula-aren', 500],
      ['cup', 2],
    ])

    const shortages = findShortages(needed, available)

    expect(shortages).toHaveLength(1)
    expect(shortages[0]?.ingredientId).toBe('cup')
    expect(shortages[0]?.short.toString()).toBe('1')
  })

  it('menganggap bahan yang tidak ada di daftar stok sebagai nol', () => {
    const shortages = findShortages(needed, new Map())
    expect(shortages).toHaveLength(4)
  })

  it('tepat pas bukan kekurangan', () => {
    const available = new Map<string, number>([
      ['kopi', 56],
      ['susu', 400],
      ['gula-aren', 30],
      ['cup', 3],
    ])

    expect(findShortages(needed, available)).toEqual([])
  })
})

describe('maxPortions', () => {
  it('dibatasi bahan yang paling sedikit', () => {
    const available = new Map<string, number>([
      ['kopi', 1000], // cukup 55 porsi
      ['susu', 1200], // cukup 8 porsi  ← pembatas
      ['cup', 50],
    ])

    expect(maxPortions(LATTE, available)).toBe(8)
  })

  it('membulatkan ke bawah — porsi setengah tidak bisa dijual', () => {
    const available = new Map<string, number>([
      ['kopi', 100], // 5,5 porsi
      ['susu', 10000],
      ['cup', 50],
    ])

    expect(maxPortions(LATTE, available)).toBe(5)
  })

  it('mengembalikan 0 saat satu bahan habis', () => {
    const available = new Map<string, number>([
      ['kopi', 1000],
      ['susu', 5000],
      ['cup', 0],
    ])

    expect(maxPortions(LATTE, available)).toBe(0)
  })

  it('mengembalikan 0 untuk menu tanpa resep', () => {
    expect(maxPortions([], new Map())).toBe(0)
  })
})

describe('weightedAverageCost', () => {
  it('menghitung rata-rata tertimbang, bukan rata-rata biasa', () => {
    // 1000 ml @ Rp 10 + 3000 ml @ Rp 20 = Rp 17,5 — bukan Rp 15
    const avg = weightedAverageCost({
      currentQty: 1000,
      currentAvgCost: 10,
      incomingQty: 3000,
      incomingUnitCost: 20,
    })

    expect(avg.toString()).toBe('17.5')
  })

  it('pembelian pertama memakai harga beli apa adanya', () => {
    const avg = weightedAverageCost({
      currentQty: 0,
      currentAvgCost: 0,
      incomingQty: 12000,
      incomingUnitCost: 15,
    })

    expect(avg.toString()).toBe('15')
  })

  it('stok negatif dianggap nol supaya harga tidak ikut rusak', () => {
    const avg = weightedAverageCost({
      currentQty: -500,
      currentAvgCost: 10,
      incomingQty: 1000,
      incomingUnitCost: 20,
    })

    expect(avg.toString()).toBe('20')
  })

  it('menolak barang masuk nol', () => {
    expect(() =>
      weightedAverageCost({
        currentQty: 100,
        currentAvgCost: 10,
        incomingQty: 0,
        incomingUnitCost: 20,
      }),
    ).toThrow(/lebih besar dari nol/)
  })
})

describe('menuCost & menuMargin', () => {
  const avgCost = new Map<string, number>([
    ['kopi', 150], // Rp 150 / g
    ['susu', 15], // Rp 15 / ml
    ['cup', 500], // Rp 500 / pcs
  ])

  it('menjumlahkan takaran x harga rata-rata tiap bahan', () => {
    // 18x150 + 150x15 + 1x500 = 2700 + 2250 + 500
    expect(menuCost(LATTE, avgCost).toString()).toBe('5450')
  })

  it('menghitung margin rupiah dan persen', () => {
    const { profit, percent } = menuMargin(25000, menuCost(LATTE, avgCost))

    expect(profit.toString()).toBe('19550')
    expect(percent.toFixed(2)).toBe('78.20')
  })

  it('menu gratis tidak bikin pembagian nol', () => {
    expect(menuMargin(0, 5450).percent.toString()).toBe('0')
  })
})

describe('opname', () => {
  it('fisik lebih sedikit dari catatan menghasilkan selisih negatif', () => {
    expect(opnameDiff(5000, 4800).toString()).toBe('-200')
  })

  it('fisik lebih banyak menghasilkan selisih positif', () => {
    expect(opnameDiff(5000, 5200).toString()).toBe('200')
  })

  it('menilai selisih dalam rupiah', () => {
    // kurang 4.200 ml susu @ Rp 15 = rugi Rp 63.000
    const diff = opnameDiff(20000, 15800)
    expect(opnameValue(diff, 15).toString()).toBe('-63000')
  })
})

describe('presisi Decimal', () => {
  it('penjumlahan berulang tidak melenceng seperti float', () => {
    // 0,1 + 0,2 x 10 kali — dengan float hasilnya 3.0000000000000004
    let total = new Decimal(0)
    for (let i = 0; i < 10; i++) {
      total = total.plus('0.1').plus('0.2')
    }

    expect(total.toString()).toBe('3')
  })
})
