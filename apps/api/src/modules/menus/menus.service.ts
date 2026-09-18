import { Decimal } from 'decimal.js'
import { prisma } from '../../lib/prisma.js'
import { notFound } from '../../lib/errors.js'
import { maxPortions, menuCost, menuMargin, type RecipeLine } from '../stock/stock-calculator.js'
import { getAvgCostMap, getStockMap } from '../stock/stock.service.js'

/**
 * Katalog untuk halaman pelanggan.
 *
 * Ketersediaan dihitung sekali untuk semua menu, bukan per menu — satu query
 * stok, bukan satu query per kartu menu.
 */
export async function listPublicMenus() {
  const [menus, stock] = await Promise.all([
    prisma.menu.findMany({
      where: { isActive: true },
      include: { recipes: { select: { ingredientId: true, qty: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    getStockMap(),
  ])

  return menus.map((menu) => {
    const recipe: RecipeLine[] = menu.recipes.map((r) => ({
      ingredientId: r.ingredientId,
      qty: r.qty.toString(),
    }))

    const portions = maxPortions(recipe, stock)

    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      price: menu.price.toString(),
      imageUrl: menu.imageUrl,
      available: portions > 0,
      // Ditampilkan sebagai "tinggal 3 porsi" saat menipis.
      remainingPortions: portions,
    }
  })
}

/** Versi untuk dashboard: ikut membawa HPP dan margin. */
export async function listMenusForOwner() {
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
    const { profit, percent } = menuMargin(menu.price.toString(), cost)

    return {
      id: menu.id,
      name: menu.name,
      category: menu.category,
      price: menu.price.toString(),
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
  const recipe: RecipeLine[] = menu.recipes.map((r) => ({
    ingredientId: r.ingredientId,
    qty: r.qty.toString(),
  }))

  return {
    id: menu.id,
    name: menu.name,
    category: menu.category,
    price: menu.price.toString(),
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
