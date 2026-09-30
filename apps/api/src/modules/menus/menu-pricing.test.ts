import { describe, expect, it } from 'vitest'
import {
  alasanPromoDitolak,
  hargaBerlaku,
  potonganPersen,
  promoBerlaku,
  type PromoMenu,
} from './menu-pricing.js'

const SEKARANG = new Date('2026-09-30T05:00:00.000Z')
const KEMARIN = new Date('2026-09-29T05:00:00.000Z')
const BESOK = new Date('2026-10-01T05:00:00.000Z')

/** Latte Rp 28.000, promo Rp 22.400 (potong 20%). */
const latte = (promo: Partial<PromoMenu> = {}): PromoMenu => ({
  price: 28000,
  promoPrice: 22400,
  promoStartsAt: null,
  promoEndsAt: null,
  ...promo,
})

describe('promoBerlaku', () => {
  it('berlaku kalau tidak ada batas tanggal sama sekali', () => {
    expect(promoBerlaku(latte(), SEKARANG)).toBe(true)
  })

  it('tidak berlaku kalau tidak ada harga promo', () => {
    expect(promoBerlaku(latte({ promoPrice: null }), SEKARANG)).toBe(false)
    expect(promoBerlaku({ price: 28000 }, SEKARANG)).toBe(false)
  })

  it('menghormati tanggal mulai', () => {
    expect(promoBerlaku(latte({ promoStartsAt: BESOK }), SEKARANG)).toBe(false)
    expect(promoBerlaku(latte({ promoStartsAt: KEMARIN }), SEKARANG)).toBe(true)
  })

  it('menghormati tanggal selesai', () => {
    expect(promoBerlaku(latte({ promoEndsAt: KEMARIN }), SEKARANG)).toBe(false)
    expect(promoBerlaku(latte({ promoEndsAt: BESOK }), SEKARANG)).toBe(true)
  })

  it('berhenti tepat di ujung akhirnya, bukan sedetik sesudahnya', () => {
    expect(promoBerlaku(latte({ promoEndsAt: SEKARANG }), SEKARANG)).toBe(false)
  })

  it('sudah berlaku tepat di ujung awalnya', () => {
    expect(promoBerlaku(latte({ promoStartsAt: SEKARANG }), SEKARANG)).toBe(true)
  })

  it('menolak promo yang tidak lebih murah', () => {
    // Data yang terlanjur salah tidak boleh ikut menipu pelanggan dengan
    // label "promo" untuk harga yang sama atau lebih mahal.
    expect(promoBerlaku(latte({ promoPrice: 28000 }), SEKARANG)).toBe(false)
    expect(promoBerlaku(latte({ promoPrice: 30000 }), SEKARANG)).toBe(false)
  })

  it('menolak harga promo nol atau negatif', () => {
    expect(promoBerlaku(latte({ promoPrice: 0 }), SEKARANG)).toBe(false)
    expect(promoBerlaku(latte({ promoPrice: -1000 }), SEKARANG)).toBe(false)
  })
})

describe('hargaBerlaku', () => {
  it('memakai harga promo selama promonya jalan', () => {
    expect(hargaBerlaku(latte(), SEKARANG).toString()).toBe('22400')
  })

  it('kembali ke harga normal begitu promonya lewat', () => {
    expect(hargaBerlaku(latte({ promoEndsAt: KEMARIN }), SEKARANG).toString()).toBe('28000')
  })

  it('harga normal tidak pernah ikut berubah', () => {
    const menu = latte()
    hargaBerlaku(menu, SEKARANG)
    expect(menu.price).toBe(28000)
  })

  it('tidak kehilangan ketelitian pada angka yang tidak bulat', () => {
    const menu: PromoMenu = { price: '28000.00', promoPrice: '18666.67' }
    expect(hargaBerlaku(menu, SEKARANG).toString()).toBe('18666.67')
  })
})

describe('potonganPersen', () => {
  it('menghitung potongan dan membulatkannya', () => {
    expect(potonganPersen(latte(), SEKARANG)).toBe(20)
    expect(potonganPersen(latte({ promoPrice: 14000 }), SEKARANG)).toBe(50)
  })

  it('membulatkan potongan yang tidak bulat', () => {
    // 28000 → 19000 itu 32,14%
    expect(potonganPersen(latte({ promoPrice: 19000 }), SEKARANG)).toBe(32)
  })

  it('null kalau tidak sedang promo', () => {
    expect(potonganPersen(latte({ promoPrice: null }), SEKARANG)).toBeNull()
    expect(potonganPersen(latte({ promoEndsAt: KEMARIN }), SEKARANG)).toBeNull()
  })

  it('null kalau harga normalnya nol', () => {
    expect(potonganPersen({ price: 0, promoPrice: 0 }, SEKARANG)).toBeNull()
  })
})

describe('alasanPromoDitolak', () => {
  const dasar = { price: 28000, promoStartsAt: null, promoEndsAt: null }

  it('meloloskan promo yang wajar', () => {
    expect(alasanPromoDitolak({ ...dasar, promoPrice: 22400 })).toBeNull()
  })

  it('meloloskan pelepasan promo', () => {
    expect(alasanPromoDitolak({ ...dasar, promoPrice: null })).toBeNull()
  })

  it('menolak harga promo yang tidak lebih murah', () => {
    expect(alasanPromoDitolak({ ...dasar, promoPrice: 28000 })).toMatch(/lebih murah/)
    expect(alasanPromoDitolak({ ...dasar, promoPrice: 35000 })).toMatch(/lebih murah/)
  })

  it('menolak harga promo nol atau negatif', () => {
    expect(alasanPromoDitolak({ ...dasar, promoPrice: 0 })).toMatch(/lebih dari nol/)
    expect(alasanPromoDitolak({ ...dasar, promoPrice: -5000 })).toMatch(/lebih dari nol/)
  })

  it('menolak tanggal selesai yang mendahului tanggal mulai', () => {
    expect(
      alasanPromoDitolak({
        ...dasar,
        promoPrice: 22400,
        promoStartsAt: BESOK,
        promoEndsAt: KEMARIN,
      }),
    ).toMatch(/setelah tanggal mulai/)
  })

  it('membolehkan promo yang dijadwalkan untuk nanti', () => {
    expect(
      alasanPromoDitolak({
        ...dasar,
        promoPrice: 22400,
        promoStartsAt: BESOK,
        promoEndsAt: new Date('2026-10-05T05:00:00.000Z'),
      }),
    ).toBeNull()
  })
})
