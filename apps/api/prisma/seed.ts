import bcrypt from 'bcryptjs'
import { Decimal } from 'decimal.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

/**
 * Data contoh supaya aplikasi bisa langsung dicoba setelah clone.
 *
 * Stok awal sengaja dibuat lewat pembelian + movement, bukan dengan menulis
 * angka stok langsung — polanya sama persis dengan yang dipakai service nanti.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const INGREDIENTS = [
  { key: 'kopi', name: 'Biji kopi', baseUnit: 'G', minStock: 500, unit: { name: 'kg', factor: 1000 } },
  { key: 'susu', name: 'Susu UHT', baseUnit: 'ML', minStock: 3000, unit: { name: 'karton', factor: 12000 } },
  { key: 'gula', name: 'Gula aren cair', baseUnit: 'ML', minStock: 500, unit: { name: 'botol', factor: 650 } },
  { key: 'cup', name: 'Cup plastik 16oz', baseUnit: 'PCS', minStock: 100, unit: { name: 'pak', factor: 50 } },
  { key: 'es', name: 'Es batu', baseUnit: 'G', minStock: 2000, unit: { name: 'balok', factor: 5000 } },
] as const

// Foto sementara dari Unsplash sampai kafe punya foto sendiri.
// Disimpan di kolom imageUrl supaya nanti cukup diganti lewat data,
// tanpa menyentuh kode tampilan.
const FOTO = (id: string) => `https://images.unsplash.com/${id}?w=800&q=70`

const MENUS = [
  {
    name: 'Latte',
    category: 'Kopi',
    price: 25000,
    imageUrl: FOTO('photo-1541167760496-1628856ab772'),
    recipe: { kopi: 18, susu: 150, cup: 1 },
  },
  {
    name: 'Es Kopi Susu',
    category: 'Kopi',
    price: 22000,
    imageUrl: FOTO('photo-1461023058943-07fcbe16d735'),
    recipe: { kopi: 20, susu: 100, gula: 30, cup: 1, es: 120 },
  },
  {
    name: 'Americano',
    category: 'Kopi',
    price: 18000,
    imageUrl: FOTO('photo-1509042239860-f550ce710b93'),
    recipe: { kopi: 20, cup: 1 },
  },
  {
    name: 'Susu Kurma',
    category: 'Non-kopi',
    price: 20000,
    imageUrl: FOTO('photo-1572442388796-11668a67e53d'),
    recipe: { susu: 200, gula: 20, cup: 1, es: 100 },
  },
  {
    name: 'Cokelat Panas',
    category: 'Non-kopi',
    price: 21000,
    imageUrl: FOTO('photo-1447933601403-0c6688de566e'),
    recipe: { susu: 220, gula: 25, cup: 1 },
  },
  {
    name: 'Teh Tarik',
    category: 'Non-kopi',
    price: 17000,
    imageUrl: FOTO('photo-1495474472287-4d71bcdd2085'),
    recipe: { susu: 150, gula: 20, cup: 1, es: 80 },
  },
] as const

/** Pembelian awal: [key bahan, jumlah dalam satuan beli, harga per satuan beli] */
const OPENING_PURCHASE = [
  ['kopi', 2, 220000], // 2 kg
  ['susu', 2, 180000], // 2 karton = 24.000 ml
  ['gula', 3, 45000], // 3 botol
  ['cup', 4, 35000], // 4 pak = 200 cup
  ['es', 5, 12000], // 5 balok
] as const

async function main() {
  console.log('Menghapus data lama...')
  await prisma.stockMovement.deleteMany()
  await prisma.opnameItem.deleteMany()
  await prisma.stockOpname.deleteMany()
  await prisma.wasteLog.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.purchaseItem.deleteMany()
  await prisma.purchase.deleteMany()
  await prisma.recipe.deleteMany()
  await prisma.menu.deleteMany()
  await prisma.ingredientStock.deleteMany()
  await prisma.purchaseUnit.deleteMany()
  await prisma.ingredient.deleteMany()
  await prisma.cafeTable.deleteMany()
  await prisma.user.deleteMany()

  console.log('Membuat user...')
  await prisma.user.createMany({
    data: [
      {
        email: 'owner@takar.test',
        name: 'Pemilik Kafe',
        passwordHash: await bcrypt.hash('takar1234', 10),
        role: 'OWNER',
      },
      {
        email: 'staff@takar.test',
        name: 'Barista',
        passwordHash: await bcrypt.hash('takar1234', 10),
        role: 'STAFF',
      },
    ],
  })

  console.log('Membuat meja...')
  await prisma.cafeTable.createMany({
    data: Array.from({ length: 8 }, (_, i) => ({
      number: String(i + 1),
      qrToken: `meja-${i + 1}-${Math.random().toString(36).slice(2, 10)}`,
    })),
  })

  console.log('Membuat bahan baku...')
  const ingredientIds = new Map<string, string>()
  const unitIds = new Map<string, { id: string; factor: number }>()

  for (const item of INGREDIENTS) {
    const ingredient = await prisma.ingredient.create({
      data: {
        name: item.name,
        baseUnit: item.baseUnit,
        minStock: item.minStock,
        purchaseUnits: { create: { name: item.unit.name, factor: item.unit.factor } },
      },
      include: { purchaseUnits: true },
    })

    ingredientIds.set(item.key, ingredient.id)
    unitIds.set(item.key, {
      id: ingredient.purchaseUnits[0]!.id,
      factor: item.unit.factor,
    })
  }

  console.log('Membuat menu & resep...')
  for (const menu of MENUS) {
    await prisma.menu.create({
      data: {
        name: menu.name,
        category: menu.category,
        price: menu.price,
        imageUrl: menu.imageUrl,
        recipes: {
          create: Object.entries(menu.recipe).map(([key, qty]) => ({
            ingredientId: ingredientIds.get(key)!,
            qty,
          })),
        },
      },
    })
  }

  console.log('Mencatat pembelian awal (lewat ledger)...')
  const total = OPENING_PURCHASE.reduce(
    (sum, [, qty, price]) => sum.plus(new Decimal(price).mul(qty)),
    new Decimal(0),
  )

  await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        supplier: 'Stok awal',
        total: total.toFixed(2),
        note: 'Data contoh dari seed',
      },
    })

    for (const [key, qty, unitPrice] of OPENING_PURCHASE) {
      const ingredientId = ingredientIds.get(key)!
      const unit = unitIds.get(key)!

      const baseQty = new Decimal(qty).mul(unit.factor)
      const costPerBase = new Decimal(unitPrice).div(unit.factor)

      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          ingredientId,
          purchaseUnitId: unit.id,
          qty,
          unitPrice,
          baseQty: baseQty.toFixed(3),
        },
      })

      // Ledger dulu — ini sumber kebenarannya.
      await tx.stockMovement.create({
        data: {
          ingredientId,
          qty: baseQty.toFixed(3),
          type: 'PURCHASE',
          refType: 'purchase',
          refId: purchase.id,
          unitCost: costPerBase.toFixed(4),
        },
      })

      // Cache stok + harga rata-rata, ditulis di transaksi yang sama.
      await tx.ingredientStock.create({
        data: { ingredientId, qty: baseQty.toFixed(3) },
      })

      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { avgCost: costPerBase.toFixed(4) },
      })
    }
  })

  console.log('\nSelesai.')
  console.log('  Login owner : owner@takar.test / takar1234')
  console.log('  Login staff : staff@takar.test / takar1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
