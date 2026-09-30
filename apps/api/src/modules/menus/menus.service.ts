import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from '../../lib/errors.js'
import { maxPortions, menuCost, menuMargin, type RecipeLine } from '../stock/stock-calculator.js'
import { getAvgCostMap, getStockMap } from '../stock/stock.service.js'
import { flagNyala } from '../settings/settings.service.js'
import {
  alasanPromoDitolak,
  hargaBerlaku,
  potonganPersen,
  type PromoMenu,
} from './menu-pricing.js'

/** Status pesanan yang benar-benar terjadi — dipakai menghitung penjualan. */
const STATUS_TERJUAL = ['CONFIRMED', 'PREPARING', 'READY', 'DONE'] as const

/**
 * Tiga menu terlaris minggu ini.
 *
 * Dihitung terpisah dari angka penjualan per halaman katalog, dan memang
 * harus begitu: "terlaris" itu peringkat terhadap **seluruh** menu, bukan
 * terhadap dua belas yang kebetulan tampil di halaman yang sedang dibuka.
 * Kalau dihitung per halaman, tiap halaman punya juaranya sendiri dan
 * tandanya kehilangan arti.
 */
async function idTerlaris(sejak: Date, berapa = 3): Promise<Set<string>> {
  const rows = await prisma.orderItem.groupBy({
    by: ['menuId'],
    _sum: { qty: true },
    where: {
      order: { status: { in: [...STATUS_TERJUAL] }, confirmedAt: { gte: sejak } },
    },
    orderBy: { _sum: { qty: 'desc' } },
    take: berapa,
  })

  return new Set(rows.map((r) => r.menuId))
}

/**
 * Bagian harga yang dilihat pelanggan.
 *
 * `price` selalu harga yang benar-benar dibayar saat ini, jadi keranjang dan
 * total pesanan tidak perlu tahu-menahu soal promo. `normalPrice` cuma diisi
 * saat sedang promo — itu angka yang dicoret di kartu menu.
 */
function bagianHarga(menu: PromoMenu, promoNyala: boolean, sekarang: Date) {
  const dipakai = promoNyala ? menu : { price: menu.price }
  const potongan = potonganPersen(dipakai, sekarang)

  return {
    price: hargaBerlaku(dipakai, sekarang).toFixed(2),
    normalPrice: potongan === null ? null : new Decimal(menu.price.toString()).toFixed(2),
    discountPercent: potongan,
  }
}

/**
 * Katalog untuk halaman pelanggan.
 *
 * Ketersediaan dihitung sekali untuk semua menu, bukan per menu — satu query
 * stok, bukan satu query per kartu menu.
 */
export type ListMenuParams = {
  q?: string
  category?: string
  page?: number
  pageSize?: number
}

/**
 * Katalog untuk halaman pelanggan.
 *
 * Penyaringan dan pemotongan halaman dilakukan di sini, bukan di browser:
 * dengan hampir seratus menu, mengirim semuanya lalu membuang sebagian besar
 * di layar itu pemborosan yang akan terasa di koneksi ponsel.
 *
 * Ketersediaan tetap dihitung sekali untuk halaman yang diminta, dengan satu
 * query stok, bukan satu query per kartu menu.
 */
export async function listPublicMenus(params: ListMenuParams = {}) {
  const semingguLalu = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(96, Math.max(1, params.pageSize ?? 12))

  const where = {
    isActive: true,
    ...(params.category && { category: params.category }),
    ...(params.q && {
      OR: [
        { name: { contains: params.q, mode: 'insensitive' as const } },
        { category: { contains: params.q, mode: 'insensitive' as const } },
      ],
    }),
  }

  /**
   * Kalau menu habis disembunyikan, halamannya tidak bisa dipotong di
   * database: "habis" baru ketahuan setelah stok bahan dibandingkan dengan
   * resep, dan itu terjadi di sini. Memotong lebih dulu menghasilkan halaman
   * berisi tujuh menu padahal satu halaman muat dua belas.
   *
   * Jadi saat pengaturan itu menyala, seluruh menu yang cocok diambil dulu
   * lalu dipotong di memori. Katalognya puluhan menu, bukan puluhan ribu.
   */
  const sembunyikanHabis = await flagNyala('toko.sembunyikanMenuHabis')
  const promoNyala = await flagNyala('modul.promo')
  const terlaris = await idTerlaris(semingguLalu)
  const sekarang = new Date()

  const total = await prisma.menu.count({ where })
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const halaman = Math.min(page, pages)

  const [menus, stock, terjual] = await Promise.all([
    prisma.menu.findMany({
      where,
      include: { recipes: { select: { ingredientId: true, qty: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      ...(sembunyikanHabis
        ? {}
        : { skip: (halaman - 1) * pageSize, take: pageSize }),
    }),
    getStockMap(),
    // Dipakai untuk menandai menu terlaris. Hanya pesanan yang benar-benar
    // dikonfirmasi yang dihitung, jadi angkanya tidak bisa dinaikkan dengan
    // mengirim pesanan lalu membatalkannya.
    prisma.orderItem.groupBy({
      by: ['menuId'],
      _sum: { qty: true },
      where: {
        order: {
          status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'DONE'] },
          confirmedAt: { gte: semingguLalu },
        },
      },
    }),
  ])

  const terjualPerMenu = new Map(
    terjual.map((row) => [row.menuId, row._sum.qty ?? 0]),
  )

  const items = menus.map((menu) => {
    const recipe: RecipeLine[] = menu.recipes.map((r) => ({
      ingredientId: r.ingredientId,
      qty: r.qty.toString(),
    }))

    const portions = maxPortions(recipe, stock)

    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      ...bagianHarga(menu, promoNyala, sekarang),
      imageUrl: menu.imageUrl,
      available: portions > 0,
      // Ditampilkan sebagai "tinggal 3 porsi" saat menipis.
      remainingPortions: portions,
      soldThisWeek: terjualPerMenu.get(menu.id) ?? 0,
      isBestSeller: terlaris.has(menu.id),
      ingredientCount: menu.recipes.length,
    }
  })

  if (!sembunyikanHabis) {
    return { items, total, page: halaman, pageSize, pages }
  }

  const tersedia = items.filter((m) => m.available)
  const pagesTersedia = Math.max(1, Math.ceil(tersedia.length / pageSize))
  const halamanTersedia = Math.min(page, pagesTersedia)

  return {
    items: tersedia.slice((halamanTersedia - 1) * pageSize, halamanTersedia * pageSize),
    total: tersedia.length,
    page: halamanTersedia,
    pageSize,
    pages: pagesTersedia,
  }
}

/**
 * Ringkasan untuk beranda.
 *
 * Beranda tidak perlu seluruh katalog: yang dibutuhkan hanya daftar kategori
 * beserta jumlahnya, menu terlaris, dan yang stoknya menipis. Dipisah supaya
 * membuka beranda tidak berarti mengunduh sembilan puluh enam menu.
 */
export async function getHighlights() {
  const semingguLalu = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [menus, stock, terjual, perKategori] = await Promise.all([
    prisma.menu.findMany({
      where: { isActive: true },
      include: { recipes: { select: { ingredientId: true, qty: true } } },
    }),
    getStockMap(),
    prisma.orderItem.groupBy({
      by: ['menuId'],
      _sum: { qty: true },
      where: {
        order: {
          status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'DONE'] },
          confirmedAt: { gte: semingguLalu },
        },
      },
    }),
    prisma.menu.groupBy({
      by: ['category'],
      _count: { _all: true },
      where: { isActive: true },
    }),
  ])

  const terjualPerMenu = new Map(
    terjual.map((row) => [row.menuId, row._sum.qty ?? 0]),
  )

  const promoNyala = await flagNyala('modul.promo')
  const terlaris = await idTerlaris(semingguLalu)
  const sekarang = new Date()

  const lengkap = menus.map((menu) => {
    const recipe: RecipeLine[] = menu.recipes.map((r) => ({
      ingredientId: r.ingredientId,
      qty: r.qty.toString(),
    }))
    const portions = maxPortions(recipe, stock)

    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      ...bagianHarga(menu, promoNyala, sekarang),
      imageUrl: menu.imageUrl,
      available: portions > 0,
      remainingPortions: portions,
      soldThisWeek: terjualPerMenu.get(menu.id) ?? 0,
      isBestSeller: terlaris.has(menu.id),
      ingredientCount: menu.recipes.length,
    }
  })

  const tersedia = lengkap.filter((m) => m.available)

  return {
    stats: {
      total: lengkap.length,
      available: tersedia.length,
      categories: perKategori.length,
      soldThisWeek: [...terjualPerMenu.values()].reduce((a, b) => a + b, 0),
    },
    categories: perKategori
      .map((c) => ({ name: c.category, count: c._count._all }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    topSellers: [...tersedia]
      .sort((a, b) => b.soldThisWeek - a.soldThisWeek)
      .slice(0, 12),
    lowStock: tersedia
      .filter((m) => m.remainingPortions <= 5)
      .sort((a, b) => a.remainingPortions - b.remainingPortions)
      .slice(0, 5),
    /** Menu yang sedang potong harga, potongan terbesar lebih dulu. */
    promos: tersedia
      .filter((m) => m.discountPercent !== null)
      .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0))
      .slice(0, 8),
  }
}

/** Versi untuk dashboard: ikut membawa HPP dan margin. */
export async function listMenusForOwner() {
  const promoNyala = await flagNyala('modul.promo')
  const sekarang = new Date()

  const [menus, stock, avgCost] = await Promise.all([
    prisma.menu.findMany({
      include: {
        recipes: {
          select: {
            ingredientId: true,
            qty: true,
            ingredient: { select: { name: true, baseUnit: true } },
          },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    getStockMap(),
    getAvgCostMap(),
  ])

  return menus.map((menu) => {
    const recipe: RecipeLine[] = menu.recipes.map((r) => ({
      ingredientId: r.ingredientId,
      qty: r.qty.toString(),
    }))

    const cost = menuCost(recipe, avgCost)

    // Margin dihitung terhadap harga yang benar-benar berlaku hari ini.
    // Menampilkan margin harga normal saat menunya sedang dipotong 30% itu
    // angka yang enak dilihat tapi bukan yang sedang terjadi.
    const efektif = hargaBerlaku(promoNyala ? menu : { price: menu.price }, sekarang)
    const { profit, percent } = menuMargin(efektif.toString(), cost)

    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      price: menu.price.toString(),
      promoPrice: menu.promoPrice?.toString() ?? null,
      promoStartsAt: menu.promoStartsAt,
      promoEndsAt: menu.promoEndsAt,
      /** Harga yang dibayar pelanggan hari ini — sama dengan price kalau tidak promo. */
      effectivePrice: efektif.toFixed(2),
      imageUrl: menu.imageUrl,
      isActive: menu.isActive,
      remainingPortions: maxPortions(recipe, stock),
      cost: cost.toFixed(2),
      profit: profit.toFixed(2),
      marginPercent: percent.toFixed(1),
      recipes: menu.recipes.map((r) => ({
        ingredientId: r.ingredientId,
        name: r.ingredient.name,
        baseUnit: r.ingredient.baseUnit,
        qty: r.qty.toString(),
      })),
    }
  })
}

/**
 * Detail menu untuk halaman pelanggan.
 *
 * Nama bahan ditampilkan (berguna untuk yang menghindari susu), tapi TAKARANNYA
 * tidak: resep itu isi dapur, dan endpoint ini terbuka tanpa login.
 */
export async function getMenu(id: string) {
  const menu = await prisma.menu.findUnique({
    where: { id },
    include: {
      recipes: {
        select: {
          ingredientId: true,
          qty: true,
          ingredient: { select: { name: true, baseUnit: true } },
        },
      },
    },
  })

  if (!menu) throw notFound('Menu tidak ditemukan')

  const stock = await getStockMap()
  const promoNyala = await flagNyala('modul.promo')
  const recipe: RecipeLine[] = menu.recipes.map((r) => ({
    ingredientId: r.ingredientId,
    qty: r.qty.toString(),
  }))

  return {
    id: menu.id,
    name: menu.name,
    category: menu.category,
    ...bagianHarga(menu, promoNyala, new Date()),
    imageUrl: menu.imageUrl,
    isActive: menu.isActive,
    remainingPortions: maxPortions(recipe, stock),
    ingredients: menu.recipes.map((r) => r.ingredient.name),
  }
}

export async function createMenu(input: {
  name: string
  category: string
  price: number
  imageUrl?: string
  recipes: { ingredientId: string; qty: number }[]
}) {
  return prisma.menu.create({
    data: {
      name: input.name,
      category: input.category,
      price: new Decimal(input.price).toFixed(2),
      imageUrl: input.imageUrl ?? null,
      recipes: {
        create: input.recipes.map((r) => ({
          ingredientId: r.ingredientId,
          qty: new Decimal(r.qty).toFixed(3),
        })),
      },
    },
    include: { recipes: true },
  })
}

export async function updateMenu(
  id: string,
  input: {
    name?: string
    category?: string
    price?: number
    imageUrl?: string | null
    isActive?: boolean
    recipes?: { ingredientId: string; qty: number }[]
  },
) {
  const exists = await prisma.menu.findUnique({ where: { id }, select: { id: true } })
  if (!exists) throw notFound('Menu tidak ditemukan')

  return prisma.$transaction(async (tx) => {
    // Resep diganti utuh, bukan ditambal satu per satu — lebih mudah dipahami
    // daripada menebak baris mana yang dihapus di form.
    if (input.recipes) {
      await tx.recipe.deleteMany({ where: { menuId: id } })
      await tx.recipe.createMany({
        data: input.recipes.map((r) => ({
          menuId: id,
          ingredientId: r.ingredientId,
          qty: new Decimal(r.qty).toFixed(3),
        })),
      })
    }

    return tx.menu.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.price !== undefined && { price: new Decimal(input.price).toFixed(2) }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: { recipes: true },
    })
  })
}

/**
 * Pasang atau lepas promo sebuah menu.
 *
 * Harga normalnya tidak disentuh sama sekali — yang diubah cuma kolom promo,
 * jadi begitu rentangnya lewat atau promonya dilepas, harga kembali sendiri.
 */
export async function setPromo(
  id: string,
  input: {
    promoPrice: number | null
    promoStartsAt?: string | null
    promoEndsAt?: string | null
  },
) {
  const menu = await prisma.menu.findUnique({
    where: { id },
    select: { id: true, price: true },
  })

  if (!menu) throw notFound('Menu tidak ditemukan')

  const mulai = input.promoStartsAt ? new Date(input.promoStartsAt) : null
  const selesai = input.promoEndsAt ? new Date(input.promoEndsAt) : null

  const ditolak = alasanPromoDitolak({
    price: menu.price.toString(),
    promoPrice: input.promoPrice,
    promoStartsAt: mulai,
    promoEndsAt: selesai,
  })

  if (ditolak) throw badRequest(ditolak)

  const lepas = input.promoPrice === null

  const hasil = await prisma.menu.update({
    where: { id },
    data: {
      promoPrice: lepas ? null : new Decimal(input.promoPrice!).toFixed(2),
      // Tanggalnya ikut dibersihkan saat promo dilepas, supaya tidak ada
      // sisa jadwal yang membingungkan saat promo berikutnya dipasang.
      promoStartsAt: lepas ? null : mulai,
      promoEndsAt: lepas ? null : selesai,
    },
    select: {
      id: true,
      name: true,
      price: true,
      promoPrice: true,
      promoStartsAt: true,
      promoEndsAt: true,
    },
  })

  const sekarang = new Date()

  return {
    id: hasil.id,
    name: hasil.name,
    price: hasil.price.toString(),
    promoPrice: hasil.promoPrice?.toString() ?? null,
    promoStartsAt: hasil.promoStartsAt,
    promoEndsAt: hasil.promoEndsAt,
    effectivePrice: hargaBerlaku(hasil, sekarang).toFixed(2),
    discountPercent: potonganPersen(hasil, sekarang),
  }
}
