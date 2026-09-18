import bcrypt from 'bcryptjs'
import { Decimal } from 'decimal.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

/**
 * Data contoh untuk demo.
 *
 * Bukan sekadar beberapa baris: seed ini menjalankan 14 hari operasi kafe
 * (pembelian, penjualan, pembuangan, opname) supaya laporan dan menu terlaris
 * punya isi yang masuk akal, bukan tabel kosong.
 *
 * Seluruh pergerakan stok ditulis sebagai movement, sama seperti yang dilakukan
 * aplikasi. Angka stok dan harga rata-rata di akhir adalah hasil penjumlahan
 * riwayat itu, bukan angka yang diketik langsung.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const FOTO = (id: string, w = 800) => `https://images.unsplash.com/${id}?w=${w}&q=70`

/** Acak berulang: seed tetap, jadi demo selalu menghasilkan angka yang sama. */
let benih = 20260918
const acak = () => {
  benih = (benih * 1103515245 + 12345) % 2147483648
  return benih / 2147483648
}
const acakAntara = (min: number, max: number) =>
  Math.floor(acak() * (max - min + 1)) + min
const pilih = <T>(arr: readonly T[]): T => arr[Math.floor(acak() * arr.length)]!

// ────────────────────────── bahan baku ──────────────────────────

const BAHAN = [
  { key: 'arabika', name: 'Biji kopi arabika', unit: 'G', min: 800, beli: { name: 'kg', factor: 1000 }, harga: 220000 },
  { key: 'robusta', name: 'Biji kopi robusta', unit: 'G', min: 800, beli: { name: 'kg', factor: 1000 }, harga: 150000 },
  { key: 'susu', name: 'Susu UHT', unit: 'ML', min: 4000, beli: { name: 'karton', factor: 12000 }, harga: 180000 },
  { key: 'oat', name: 'Susu oat', unit: 'ML', min: 1500, beli: { name: 'liter', factor: 1000 }, harga: 38000 },
  { key: 'gula', name: 'Gula aren cair', unit: 'ML', min: 800, beli: { name: 'botol', factor: 650 }, harga: 45000 },
  { key: 'vanila', name: 'Sirup vanila', unit: 'ML', min: 400, beli: { name: 'botol', factor: 750 }, harga: 95000 },
  { key: 'karamel', name: 'Sirup karamel', unit: 'ML', min: 400, beli: { name: 'botol', factor: 750 }, harga: 95000 },
  { key: 'cokelatbubuk', name: 'Bubuk cokelat', unit: 'G', min: 500, beli: { name: 'kg', factor: 1000 }, harga: 165000 },
  { key: 'matcha', name: 'Bubuk matcha', unit: 'G', min: 250, beli: { name: 'pack', factor: 500 }, harga: 320000 },
  { key: 'teh', name: 'Teh hitam', unit: 'G', min: 250, beli: { name: 'pack', factor: 500 }, harga: 85000 },
  { key: 'es', name: 'Es batu', unit: 'G', min: 3000, beli: { name: 'balok', factor: 5000 }, harga: 12000 },
  { key: 'cup16', name: 'Cup plastik 16oz', unit: 'PCS', min: 150, beli: { name: 'pak', factor: 50 }, harga: 35000 },
  { key: 'cup8', name: 'Cup kertas 8oz', unit: 'PCS', min: 150, beli: { name: 'pak', factor: 50 }, harga: 28000 },
  { key: 'roti', name: 'Roti sourdough', unit: 'PCS', min: 12, beli: { name: 'loaf', factor: 12 }, harga: 65000 },
  { key: 'telur', name: 'Telur ayam', unit: 'PCS', min: 30, beli: { name: 'tray', factor: 30 }, harga: 58000 },
  { key: 'alpukat', name: 'Alpukat', unit: 'PCS', min: 10, beli: { name: 'kg', factor: 6 }, harga: 45000 },
  { key: 'keju', name: 'Keju cheddar', unit: 'G', min: 400, beli: { name: 'blok', factor: 1000 }, harga: 95000 },
  { key: 'mentega', name: 'Mentega', unit: 'G', min: 300, beli: { name: 'blok', factor: 500 }, harga: 42000 },
  { key: 'kentang', name: 'Kentang beku', unit: 'G', min: 1200, beli: { name: 'pack', factor: 1000 }, harga: 38000 },
  { key: 'ayam', name: 'Dada ayam', unit: 'G', min: 1200, beli: { name: 'kg', factor: 1000 }, harga: 48000 },
  { key: 'terigu', name: 'Tepung terigu', unit: 'G', min: 1500, beli: { name: 'kg', factor: 1000 }, harga: 14000 },
  { key: 'cokelatbatang', name: 'Cokelat batang', unit: 'G', min: 400, beli: { name: 'blok', factor: 500 }, harga: 78000 },
  { key: 'beras', name: 'Beras pulen', unit: 'G', min: 2500, beli: { name: 'kg', factor: 1000 }, harga: 16000 },
  { key: 'mie', name: 'Mie telur', unit: 'G', min: 1000, beli: { name: 'pack', factor: 500 }, harga: 12000 },
  { key: 'selada', name: 'Selada', unit: 'G', min: 300, beli: { name: 'kg', factor: 1000 }, harga: 25000 },
  { key: 'tomat', name: 'Tomat', unit: 'G', min: 400, beli: { name: 'kg', factor: 1000 }, harga: 18000 },
  { key: 'timun', name: 'Timun', unit: 'G', min: 300, beli: { name: 'kg', factor: 1000 }, harga: 12000 },
  { key: 'sapi', name: 'Daging sapi giling', unit: 'G', min: 700, beli: { name: 'kg', factor: 1000 }, harga: 135000 },
  { key: 'sosis', name: 'Sosis ayam', unit: 'PCS', min: 20, beli: { name: 'pack', factor: 10 }, harga: 32000 },
  { key: 'udang', name: 'Udang kupas', unit: 'G', min: 500, beli: { name: 'kg', factor: 1000 }, harga: 110000 },
  { key: 'jeruk', name: 'Jeruk peras', unit: 'PCS', min: 24, beli: { name: 'kg', factor: 8 }, harga: 28000 },
  { key: 'mangga', name: 'Mangga harum manis', unit: 'G', min: 500, beli: { name: 'kg', factor: 1000 }, harga: 35000 },
  { key: 'pisang', name: 'Pisang', unit: 'PCS', min: 20, beli: { name: 'sisir', factor: 12 }, harga: 24000 },
  { key: 'stroberi', name: 'Stroberi', unit: 'G', min: 300, beli: { name: 'pack', factor: 250 }, harga: 45000 },
  { key: 'yoghurt', name: 'Yoghurt plain', unit: 'ML', min: 800, beli: { name: 'botol', factor: 1000 }, harga: 42000 },
  { key: 'madu', name: 'Madu', unit: 'ML', min: 250, beli: { name: 'botol', factor: 500 }, harga: 68000 },
  { key: 'sambal', name: 'Saus sambal', unit: 'ML', min: 400, beli: { name: 'botol', factor: 500 }, harga: 22000 },
  { key: 'kecap', name: 'Kecap manis', unit: 'ML', min: 400, beli: { name: 'botol', factor: 600 }, harga: 24000 },
  { key: 'minyak', name: 'Minyak goreng', unit: 'ML', min: 1000, beli: { name: 'liter', factor: 1000 }, harga: 21000 },
  { key: 'bawang', name: 'Bawang putih', unit: 'G', min: 300, beli: { name: 'kg', factor: 1000 }, harga: 38000 },
  { key: 'santan', name: 'Santan kental', unit: 'ML', min: 600, beli: { name: 'kotak', factor: 500 }, harga: 12000 },
  { key: 'burger', name: 'Roti burger', unit: 'PCS', min: 12, beli: { name: 'pack', factor: 6 }, harga: 22000 },
  { key: 'tortilla', name: 'Kulit tortilla', unit: 'PCS', min: 12, beli: { name: 'pack', factor: 10 }, harga: 28000 },
] as const

type BahanKey = (typeof BAHAN)[number]['key']

// ────────────────────────── menu ──────────────────────────

type MenuSeed = {
  name: string
  category: string
  price: number
  foto: string
  /** Bobot popularitas: makin besar, makin sering muncul di riwayat pesanan. */
  laris: number
  recipe: Partial<Record<BahanKey, number>>
}

const MENU: MenuSeed[] = [
  // Kopi
  { name: 'Espresso', category: 'Kopi', price: 16000, foto: 'photo-1510707577719-ae7c14805e3a', laris: 4, recipe: { arabika: 18, cup8: 1 } },
  { name: 'Americano', category: 'Kopi', price: 18000, foto: 'photo-1509042239860-f550ce710b93', laris: 6, recipe: { arabika: 20, cup16: 1, es: 60 } },
  { name: 'Latte', category: 'Kopi', price: 25000, foto: 'photo-1541167760496-1628856ab772', laris: 10, recipe: { arabika: 18, susu: 150, cup16: 1 } },
  { name: 'Cappuccino', category: 'Kopi', price: 24000, foto: 'photo-1534778101976-62847782c213', laris: 7, recipe: { arabika: 18, susu: 120, cup8: 1 } },
  { name: 'Es Kopi Susu', category: 'Kopi', price: 22000, foto: 'photo-1461023058943-07fcbe16d735', laris: 12, recipe: { robusta: 20, susu: 100, gula: 30, cup16: 1, es: 120 } },
  { name: 'Kopi Karamel', category: 'Kopi', price: 28000, foto: 'photo-1497935586351-b67a49e012bf', laris: 5, recipe: { arabika: 18, susu: 150, karamel: 25, cup16: 1, es: 100 } },
  { name: 'Vanilla Latte', category: 'Kopi', price: 27000, foto: 'photo-1563805042-7684c019e1cb', laris: 5, recipe: { arabika: 18, susu: 150, vanila: 25, cup16: 1 } },
  { name: 'Oat Latte', category: 'Kopi', price: 30000, foto: 'photo-1511920170033-f8396924c348', laris: 4, recipe: { arabika: 18, oat: 150, cup16: 1 } },

  // Non-kopi
  { name: 'Cokelat Panas', category: 'Non-kopi', price: 21000, foto: 'photo-1447933601403-0c6688de566e', laris: 5, recipe: { cokelatbubuk: 25, susu: 220, cup8: 1 } },
  { name: 'Matcha Latte', category: 'Non-kopi', price: 28000, foto: 'photo-1515823064-d6e0c04616a7', laris: 6, recipe: { matcha: 8, susu: 200, gula: 20, cup16: 1, es: 100 } },
  { name: 'Teh Tarik', category: 'Non-kopi', price: 17000, foto: 'photo-1495474472287-4d71bcdd2085', laris: 4, recipe: { teh: 8, susu: 150, gula: 20, cup16: 1, es: 80 } },
  { name: 'Susu Kurma', category: 'Non-kopi', price: 20000, foto: 'photo-1572442388796-11668a67e53d', laris: 3, recipe: { susu: 200, gula: 20, cup16: 1, es: 100 } },
  { name: 'Teh Lemon Dingin', category: 'Non-kopi', price: 18000, foto: 'photo-1499636136210-6f4ee915583e', laris: 4, recipe: { teh: 8, gula: 25, cup16: 1, es: 150 } },

  // Jus & Smoothie
  { name: 'Jus Jeruk Peras', category: 'Jus & Smoothie', price: 20000, foto: 'photo-1621506289937-a8e4df240d0b', laris: 7, recipe: { jeruk: 4, es: 100, cup16: 1 } },
  { name: 'Jus Mangga', category: 'Jus & Smoothie', price: 22000, foto: 'photo-1546173159-315724a31696', laris: 6, recipe: { mangga: 200, es: 100, cup16: 1 } },
  { name: 'Smoothie Stroberi', category: 'Jus & Smoothie', price: 26000, foto: 'photo-1553530666-ba11a7da3888', laris: 5, recipe: { stroberi: 120, yoghurt: 120, madu: 15, cup16: 1 } },
  { name: 'Smoothie Pisang Madu', category: 'Jus & Smoothie', price: 24000, foto: 'photo-1502741224143-90386d7f8c82', laris: 4, recipe: { pisang: 2, susu: 150, madu: 15, cup16: 1 } },
  { name: 'Yoghurt Buah', category: 'Jus & Smoothie', price: 23000, foto: 'photo-1488477181946-6428a0291777', laris: 4, recipe: { yoghurt: 180, stroberi: 60, madu: 10, cup16: 1 } },

  // Sarapan
  { name: 'Roti Bakar Alpukat', category: 'Sarapan', price: 32000, foto: 'photo-1588137378633-dea1336ce1e2', laris: 6, recipe: { roti: 2, alpukat: 1, mentega: 10 } },
  { name: 'Telur Orak-arik Keju', category: 'Sarapan', price: 28000, foto: 'photo-1482049016688-2d3e1b311543', laris: 5, recipe: { telur: 3, keju: 40, mentega: 10 } },
  { name: 'Roti Bakar Cokelat', category: 'Sarapan', price: 24000, foto: 'photo-1587314168485-3236d6710814', laris: 4, recipe: { roti: 2, cokelatbatang: 30, mentega: 10 } },
  { name: 'Omelet Ayam', category: 'Sarapan', price: 35000, foto: 'photo-1510693206972-df098062cb71', laris: 3, recipe: { telur: 3, ayam: 80, keju: 30, mentega: 10 } },
  { name: 'Sosis Telur Panggang', category: 'Sarapan', price: 30000, foto: 'photo-1626074353765-517a681e40be', laris: 4, recipe: { sosis: 2, telur: 2, mentega: 10 } },

  // Nasi
  { name: 'Nasi Ayam Panggang', category: 'Nasi', price: 42000, foto: 'photo-1546069901-ba9599a7e63c', laris: 8, recipe: { beras: 150, ayam: 150, mentega: 10 } },
  { name: 'Nasi Telur Sambal', category: 'Nasi', price: 28000, foto: 'photo-1512058564366-18510be2db19', laris: 6, recipe: { beras: 150, telur: 2, sambal: 20, minyak: 10 } },
  { name: 'Nasi Goreng Kampung', category: 'Nasi', price: 35000, foto: 'photo-1603133872878-684f208fb84b', laris: 9, recipe: { beras: 150, telur: 1, bawang: 10, kecap: 15, minyak: 15 } },
  { name: 'Nasi Ayam Sambal Matah', category: 'Nasi', price: 45000, foto: 'photo-1565299507177-b0ac66763828', laris: 6, recipe: { beras: 150, ayam: 120, sambal: 25, minyak: 12 } },
  { name: 'Nasi Udang Saus Padang', category: 'Nasi', price: 52000, foto: 'photo-1626700051175-6818013e1d4f', laris: 4, recipe: { beras: 150, udang: 120, sambal: 30, santan: 40 } },

  // Mie
  { name: 'Mie Goreng Spesial', category: 'Mie', price: 33000, foto: 'photo-1552611052-33e04de081de', laris: 8, recipe: { mie: 150, telur: 1, bawang: 10, kecap: 15, minyak: 15 } },
  { name: 'Mie Ayam Bawang', category: 'Mie', price: 32000, foto: 'photo-1569718212165-3a8278d5f624', laris: 7, recipe: { mie: 150, ayam: 80, bawang: 10, minyak: 10 } },
  { name: 'Mie Kuah Udang', category: 'Mie', price: 38000, foto: 'photo-1623428187969-5da2dcea5ebf', laris: 5, recipe: { mie: 150, udang: 80, santan: 50, bawang: 8 } },
  { name: 'Mie Tumis Sayur', category: 'Mie', price: 28000, foto: 'photo-1585032226651-759b368d7246', laris: 4, recipe: { mie: 150, selada: 40, tomat: 40, minyak: 12 } },

  // Roti & Burger
  { name: 'Sandwich Ayam', category: 'Roti & Burger', price: 38000, foto: 'photo-1568901346375-23c9450c58cd', laris: 7, recipe: { roti: 2, ayam: 120, keju: 30, mentega: 10 } },
  { name: 'Burger Sapi Klasik', category: 'Roti & Burger', price: 45000, foto: 'photo-1568901346375-23c9450c58cd', laris: 9, recipe: { burger: 1, sapi: 120, keju: 20, selada: 20, tomat: 25 } },
  { name: 'Burger Ayam Krispi', category: 'Roti & Burger', price: 42000, foto: 'photo-1550547660-d9450f859349', laris: 7, recipe: { burger: 1, ayam: 110, selada: 20, sambal: 15 } },
  { name: 'Tortilla Ayam', category: 'Roti & Burger', price: 36000, foto: 'photo-1565299507177-b0ac66763828', laris: 5, recipe: { tortilla: 2, ayam: 100, selada: 25, tomat: 25 } },
  { name: 'Roti Panggang Keju', category: 'Roti & Burger', price: 26000, foto: 'photo-1528735602780-2552fd46c7af', laris: 4, recipe: { roti: 2, keju: 45, mentega: 12 } },

  // Camilan
  { name: 'Kentang Goreng', category: 'Camilan', price: 25000, foto: 'photo-1573080496219-bb080dd4f877', laris: 10, recipe: { kentang: 200, minyak: 20 } },
  { name: 'Kentang Keju', category: 'Camilan', price: 30000, foto: 'photo-1630384060421-cb20d0e0649d', laris: 6, recipe: { kentang: 200, keju: 40, minyak: 20 } },
  { name: 'Sosis Bakar Saus', category: 'Camilan', price: 24000, foto: 'photo-1607013251379-e6eecfffe234', laris: 5, recipe: { sosis: 3, sambal: 20 } },
  { name: 'Udang Goreng Tepung', category: 'Camilan', price: 38000, foto: 'photo-1626700051175-6818013e1d4f', laris: 4, recipe: { udang: 100, terigu: 40, minyak: 30 } },
  { name: 'Pisang Goreng Madu', category: 'Camilan', price: 22000, foto: 'photo-1587132137056-bfbf0166836e', laris: 6, recipe: { pisang: 3, terigu: 40, minyak: 25, madu: 10 } },

  // Salad
  { name: 'Salad Sayur Segar', category: 'Salad', price: 28000, foto: 'photo-1512621776951-a57141f2eefd', laris: 4, recipe: { selada: 80, tomat: 60, timun: 60 } },
  { name: 'Salad Ayam Panggang', category: 'Salad', price: 38000, foto: 'photo-1546793665-c74683f339c1', laris: 5, recipe: { selada: 70, ayam: 100, tomat: 50, timun: 40 } },
  { name: 'Salad Buah Yoghurt', category: 'Salad', price: 26000, foto: 'photo-1490474418585-ba9bad8fd0ea', laris: 3, recipe: { mangga: 80, stroberi: 60, pisang: 1, yoghurt: 100 } },

  // Manis
  { name: 'Brownies Cokelat', category: 'Manis', price: 22000, foto: 'photo-1606313564200-e75d5e30476c', laris: 6, recipe: { cokelatbatang: 40, terigu: 50, telur: 1, mentega: 30 } },
  { name: 'Kue Keju', category: 'Manis', price: 26000, foto: 'photo-1524351199678-941a58a3df50', laris: 5, recipe: { keju: 60, terigu: 40, telur: 1, mentega: 20 } },
  { name: 'Croissant Mentega', category: 'Manis', price: 20000, foto: 'photo-1555507036-ab1f4038808a', laris: 7, recipe: { terigu: 60, mentega: 40 } },
  { name: 'Cookie Cokelat', category: 'Manis', price: 15000, foto: 'photo-1499636136210-6f4ee915583e', laris: 5, recipe: { terigu: 40, cokelatbatang: 25, mentega: 20, telur: 1 } },
  { name: 'Pisang Cokelat', category: 'Manis', price: 20000, foto: 'photo-1587132137056-bfbf0166836e', laris: 4, recipe: { pisang: 2, cokelatbatang: 25, mentega: 10 } },
]

const ALASAN_WASTE = ['SPILLED', 'EXPIRED', 'MISTAKE'] as const
const NAMA_PELANGGAN = [
  'Yunda', 'Rani', 'Bagas', 'Sinta', 'Dewa', 'Nabila', 'Farhan', 'Citra',
  'Adit', 'Laras', 'Rizky', 'Mega', 'Hilmi', 'Tari', 'Galih', 'Nadia',
]
const CATATAN = [
  'es sedikit', 'gula setengah', 'tanpa gula', 'panas ya',
  'bungkus terpisah', 'susu oat kalau ada',
]

const HARI_RIWAYAT = 14

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

  console.log('Membuat user & meja...')
  const hash = await bcrypt.hash('takar1234', 10)
  const users = await Promise.all([
    prisma.user.create({
      data: { email: 'owner@takar.test', name: 'Pemilik Kafe', passwordHash: hash, role: 'OWNER' },
    }),
    prisma.user.create({
      data: { email: 'staff@takar.test', name: 'Barista Sore', passwordHash: hash, role: 'STAFF' },
    }),
  ])

  const tables = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      prisma.cafeTable.create({
        data: {
          number: String(i + 1),
          qrToken: `meja-${i + 1}-${Math.random().toString(36).slice(2, 10)}`,
        },
      }),
    ),
  )

  console.log(`Membuat ${BAHAN.length} bahan baku...`)
  const bahanId = new Map<string, string>()
  const unitId = new Map<string, { id: string; factor: number; harga: number }>()

  for (const b of BAHAN) {
    const row = await prisma.ingredient.create({
      data: {
        name: b.name,
        baseUnit: b.unit,
        minStock: b.min,
        purchaseUnits: { create: { name: b.beli.name, factor: b.beli.factor } },
      },
      include: { purchaseUnits: true },
    })

    bahanId.set(b.key, row.id)
    unitId.set(b.key, {
      id: row.purchaseUnits[0]!.id,
      factor: b.beli.factor,
      harga: b.harga,
    })
  }

  console.log(`Membuat ${MENU.length} menu & resep...`)
  const menuId = new Map<string, string>()

  for (const m of MENU) {
    const row = await prisma.menu.create({
      data: {
        name: m.name,
        category: m.category,
        price: m.price,
        imageUrl: FOTO(m.foto),
        recipes: {
          create: Object.entries(m.recipe).map(([key, qty]) => ({
            ingredientId: bahanId.get(key)!,
            qty: qty as number,
          })),
        },
      },
    })
    menuId.set(m.name, row.id)
  }

  // Semua pergerakan dikumpulkan dulu, lalu ditulis sekaligus. Stok akhir
  // dihitung dari kumpulan yang sama, jadi cache dan ledger pasti cocok.
  type Gerak = {
    ingredientId: string
    qty: Decimal
    type: 'PURCHASE' | 'SALE' | 'WASTE' | 'ADJUSTMENT' | 'RETURN'
    refType?: string
    refId?: string
    unitCost?: Decimal
    note?: string
    createdAt: Date
  }

  const gerakan: Gerak[] = []
  const stok = new Map<string, Decimal>()
  const hargaRata = new Map<string, Decimal>()

  const tambahStok = (key: BahanKey, jumlah: Decimal) => {
    const id = bahanId.get(key)!
    stok.set(id, (stok.get(id) ?? new Decimal(0)).plus(jumlah))
  }

  const stokKey = (key: BahanKey) => stok.get(bahanId.get(key)!) ?? new Decimal(0)

  /** Catat satu nota pembelian pada tanggal tertentu. */
  async function belanja(tanggal: Date, daftar: { key: BahanKey; qty: number }[], supplier: string) {
    let total = new Decimal(0)
    const items: {
      ingredientId: string
      purchaseUnitId: string
      qty: string
      unitPrice: string
      baseQty: string
    }[] = []

    for (const item of daftar) {
      const unit = unitId.get(item.key)!
      const id = bahanId.get(item.key)!
      const baseQty = new Decimal(item.qty).mul(unit.factor)
      const costPerBase = new Decimal(unit.harga).div(unit.factor)

      // Harga rata-rata tertimbang, dihitung persis seperti di aplikasi.
      const qtyLama = Decimal.max(stokKey(item.key), 0)
      const rataLama = hargaRata.get(id) ?? new Decimal(0)
      const rataBaru = qtyLama.plus(baseQty).isZero()
        ? costPerBase
        : qtyLama
            .mul(rataLama)
            .plus(baseQty.mul(costPerBase))
            .div(qtyLama.plus(baseQty))

      hargaRata.set(id, rataBaru)
      tambahStok(item.key, baseQty)
      total = total.plus(new Decimal(unit.harga).mul(item.qty))

      items.push({
        ingredientId: id,
        purchaseUnitId: unit.id,
        qty: new Decimal(item.qty).toFixed(3),
        unitPrice: new Decimal(unit.harga).toFixed(2),
        baseQty: baseQty.toFixed(3),
      })

      gerakan.push({
        ingredientId: id,
        qty: baseQty,
        type: 'PURCHASE',
        unitCost: costPerBase,
        createdAt: tanggal,
      })
    }

    const nota = await prisma.purchase.create({
      data: {
        supplier,
        date: tanggal,
        createdAt: tanggal,
        total: total.toFixed(2),
        items: { create: items },
      },
    })

    for (const g of gerakan) {
      if (!g.refId && g.type === 'PURCHASE' && g.createdAt === tanggal) {
        g.refType = 'purchase'
        g.refId = nota.id
      }
    }
  }

  const hariIni = new Date()
  hariIni.setHours(9, 0, 0, 0)

  const tanggalKe = (mundur: number, jam: number, menit: number) => {
    const d = new Date(hariIni)
    d.setDate(d.getDate() - mundur)
    d.setHours(jam, menit, 0, 0)
    return d
  }

  console.log('Belanja awal...')
  await belanja(
    tanggalKe(HARI_RIWAYAT, 7, 30),
    [
      // Bahan mahal yang perputarannya lambat sengaja dibeli sedikit, persis
      // seperti kafe kecil yang tidak mau menahan uang di gudang. Akibatnya
      // beberapa di antaranya memang menipis di akhir periode.
      { key: 'arabika', qty: 4 }, { key: 'robusta', qty: 2.5 }, { key: 'susu', qty: 4 },
      { key: 'oat', qty: 3 }, { key: 'gula', qty: 4 }, { key: 'vanila', qty: 1 },
      { key: 'karamel', qty: 1 }, { key: 'cokelatbubuk', qty: 1 }, { key: 'matcha', qty: 0.8 },
      { key: 'teh', qty: 1 }, { key: 'es', qty: 8 }, { key: 'cup16', qty: 12 },
      { key: 'cup8', qty: 8 }, { key: 'roti', qty: 6 }, { key: 'telur', qty: 4 },
      { key: 'alpukat', qty: 3 }, { key: 'keju', qty: 1.5 }, { key: 'mentega', qty: 3 },
      { key: 'kentang', qty: 5 }, { key: 'ayam', qty: 5 }, { key: 'terigu', qty: 4 },
      { key: 'cokelatbatang', qty: 2 }, { key: 'beras', qty: 6 },
      { key: 'mie', qty: 8 }, { key: 'selada', qty: 2 }, { key: 'tomat', qty: 2 },
      { key: 'timun', qty: 1.5 }, { key: 'sapi', qty: 3 }, { key: 'sosis', qty: 6 },
      { key: 'udang', qty: 2 }, { key: 'jeruk', qty: 6 }, { key: 'mangga', qty: 3 },
      { key: 'pisang', qty: 5 }, { key: 'stroberi', qty: 4 }, { key: 'yoghurt', qty: 3 },
      { key: 'madu', qty: 2 }, { key: 'sambal', qty: 3 }, { key: 'kecap', qty: 2 },
      { key: 'minyak', qty: 6 }, { key: 'bawang', qty: 1.5 }, { key: 'santan', qty: 4 },
      { key: 'burger', qty: 8 }, { key: 'tortilla', qty: 4 },
    ],
    'Grosir Bahan Sejahtera',
  )

  console.log(`Menjalankan ${HARI_RIWAYAT} hari operasi...`)

  const bobot: MenuSeed[] = MENU.flatMap((m) => Array.from({ length: m.laris }, () => m))
  let jumlahPesanan = 0
  let jumlahBatal = 0

  for (let mundur = HARI_RIWAYAT - 1; mundur >= 1; mundur--) {
    // Belanja ulang tiap tiga hari, seperti kafe kecil yang tidak punya gudang besar.
    if (mundur % 3 === 0) {
      await belanja(
        tanggalKe(mundur, 7, 15),
        [
          // Belanja rutin hanya menyentuh bahan yang cepat habis. Sirup, matcha,
          // dan susu oat tidak ikut, jadi stoknya menurun perlahan sepanjang
          // dua minggu ini.
          { key: 'susu', qty: 2 }, { key: 'arabika', qty: 1 }, { key: 'robusta', qty: 0.5 },
          { key: 'es', qty: 4 }, { key: 'cup16', qty: 5 }, { key: 'cup8', qty: 3 },
          { key: 'roti', qty: 3 }, { key: 'telur', qty: 2 }, { key: 'alpukat', qty: 1 },
          { key: 'ayam', qty: 2 }, { key: 'kentang', qty: 2 }, { key: 'beras', qty: 3 },
          { key: 'mentega', qty: 1 }, { key: 'keju', qty: 0.5 }, { key: 'terigu', qty: 1 },
          { key: 'mie', qty: 3 }, { key: 'selada', qty: 1 }, { key: 'tomat', qty: 1 },
          { key: 'sapi', qty: 1 }, { key: 'sosis', qty: 3 }, { key: 'udang', qty: 1 },
          { key: 'jeruk', qty: 3 }, { key: 'pisang', qty: 3 }, { key: 'burger', qty: 4 },
          { key: 'minyak', qty: 2 }, { key: 'bawang', qty: 0.5 },
        ],
        pilih(['Grosir Bahan Sejahtera', 'Toko Susu Pagi', 'Pasar Kopi Nusantara']),
      )
    }

    const pesananHariIni = acakAntara(6, 11)

    for (let i = 0; i < pesananHariIni; i++) {
      const jam = acakAntara(8, 20)
      const waktu = tanggalKe(mundur, jam, acakAntara(0, 59))

      const jumlahItem = acakAntara(1, 3)
      const dipilih = new Map<string, number>()
      for (let j = 0; j < jumlahItem; j++) {
        const m = pilih(bobot)
        dipilih.set(m.name, (dipilih.get(m.name) ?? 0) + acakAntara(1, 2))
      }

      // Pastikan stok cukup; kalau tidak, lewati pesanan ini.
      const butuh = new Map<BahanKey, Decimal>()
      for (const [nama, qty] of dipilih) {
        const m = MENU.find((x) => x.name === nama)!
        for (const [key, takar] of Object.entries(m.recipe)) {
          const k = key as BahanKey
          butuh.set(k, (butuh.get(k) ?? new Decimal(0)).plus(new Decimal(takar as number).mul(qty)))
        }
      }

      const cukup = [...butuh].every(([k, perlu]) => stokKey(k).gte(perlu))
      if (!cukup) continue

      const batal = acak() < 0.06
      let total = new Decimal(0)
      const items = [...dipilih].map(([nama, qty]) => {
        const m = MENU.find((x) => x.name === nama)!
        total = total.plus(new Decimal(m.price).mul(qty))
        return {
          menuId: menuId.get(nama)!,
          qty,
          unitPrice: new Decimal(m.price).toFixed(2),
          note: acak() < 0.2 ? pilih(CATATAN) : null,
        }
      })

      const selesai = new Date(waktu.getTime() + acakAntara(6, 18) * 60000)

      const order = await prisma.order.create({
        data: {
          code: `TKR-${(jumlahPesanan + 4096).toString(16).toUpperCase().padStart(4, '0')}`,
          tableId: acak() < 0.8 ? pilih(tables).id : null,
          customerName: acak() < 0.7 ? pilih(NAMA_PELANGGAN) : null,
          status: batal ? 'CANCELLED' : 'DONE',
          total: total.toFixed(2),
          note: batal ? 'Batal: pelanggan berubah pikiran' : null,
          createdAt: waktu,
          updatedAt: selesai,
          confirmedAt: waktu,
          cancelledAt: batal ? selesai : null,
          items: { create: items },
        },
      })

      jumlahPesanan++

      for (const [k, perlu] of butuh) {
        const id = bahanId.get(k)!
        gerakan.push({
          ingredientId: id,
          qty: perlu.neg(),
          type: 'SALE',
          refType: 'order',
          refId: order.id,
          unitCost: hargaRata.get(id),
          createdAt: waktu,
        })
        tambahStok(k, perlu.neg())

        // Pesanan batal mengembalikan bahan lewat baris berlawanan,
        // bukan dengan menghapus penjualannya.
        if (batal) {
          gerakan.push({
            ingredientId: id,
            qty: perlu,
            type: 'RETURN',
            refType: 'order',
            refId: order.id,
            unitCost: hargaRata.get(id),
            note: 'Pesanan dibatalkan',
            createdAt: selesai,
          })
          tambahStok(k, perlu)
        }
      }

      if (batal) jumlahBatal++
    }

    // Pembuangan tidak terjadi tiap hari, tapi cukup sering untuk kelihatan
    // di laporan bulanan.
    if (acak() < 0.45) {
      const key = pilih(['susu', 'roti', 'es', 'alpukat', 'telur', 'ayam'] as const)
      const jumlah = new Decimal(
        key === 'susu' ? acakAntara(150, 600)
          : key === 'es' ? acakAntara(200, 800)
          : key === 'ayam' ? acakAntara(50, 150)
          : acakAntara(1, 3),
      )

      if (stokKey(key).gte(jumlah)) {
        const id = bahanId.get(key)!
        const waktu = tanggalKe(mundur, acakAntara(10, 19), acakAntara(0, 59))

        const log = await prisma.wasteLog.create({
          data: {
            ingredientId: id,
            qty: jumlah.toFixed(3),
            reason: pilih(ALASAN_WASTE),
            note: null,
            userId: pilih(users).id,
            createdAt: waktu,
          },
        })

        gerakan.push({
          ingredientId: id,
          qty: jumlah.neg(),
          type: 'WASTE',
          refType: 'waste',
          refId: log.id,
          unitCost: hargaRata.get(id),
          createdAt: waktu,
        })
        tambahStok(key, jumlah.neg())
      }
    }
  }

  console.log('Stock opname seminggu lalu...')
  {
    const waktu = tanggalKe(7, 21, 30)
    const opname = await prisma.stockOpname.create({
      data: {
        userId: users[0]!.id,
        note: 'Opname rutin akhir minggu',
        date: waktu,
        createdAt: waktu,
      },
    })

    // Beberapa bahan meleset sedikit, sisanya cocok. Ini yang bikin laporan
    // selisih terasa seperti kafe sungguhan, bukan angka bulat.
    const diperiksa = ['susu', 'arabika', 'es', 'cup16', 'roti', 'telur'] as const

    for (const key of diperiksa) {
      const id = bahanId.get(key)!
      const sistem = stokKey(key)
      const meleset = acak() < 0.6
      const selisih = meleset
        ? new Decimal(
            key === 'susu' ? -acakAntara(80, 260)
              : key === 'es' ? -acakAntara(100, 400)
              : key === 'arabika' ? -acakAntara(15, 60)
              : -acakAntara(1, 4),
          )
        : new Decimal(0)

      const fisik = sistem.plus(selisih)

      await prisma.opnameItem.create({
        data: {
          opnameId: opname.id,
          ingredientId: id,
          systemQty: sistem.toFixed(3),
          physicalQty: fisik.toFixed(3),
          diff: selisih.toFixed(3),
        },
      })

      if (!selisih.isZero()) {
        gerakan.push({
          ingredientId: id,
          qty: selisih,
          type: 'ADJUSTMENT',
          refType: 'opname',
          refId: opname.id,
          note: 'Penyesuaian hasil opname',
          createdAt: waktu,
        })
        tambahStok(key, selisih)
      }
    }
  }

  console.log('Pesanan hari ini (berbagai status)...')
  {
    const statusHariIni = [
      { status: 'PENDING', jam: 9, menit: 12 },
      { status: 'PENDING', jam: 9, menit: 31 },
      { status: 'CONFIRMED', jam: 8, menit: 47 },
      { status: 'PREPARING', jam: 8, menit: 55 },
      { status: 'READY', jam: 8, menit: 20 },
      { status: 'DONE', jam: 7, menit: 40 },
      { status: 'DONE', jam: 8, menit: 5 },
    ] as const

    for (const [i, s] of statusHariIni.entries()) {
      const waktu = tanggalKe(0, s.jam, s.menit)

      // Sama seperti hari-hari sebelumnya: hanya menu yang bahannya cukup yang
      // boleh masuk. Tanpa ini stok bisa jadi negatif, keadaan yang di aplikasi
      // sungguhan tidak mungkin terjadi.
      const dipilih = new Map<string, number>()
      for (let j = 0; j < acakAntara(1, 3); j++) {
        const kandidat = pilih(bobot)
        const perlu = new Map<BahanKey, Decimal>()

        for (const [nama, qty] of [...dipilih, [kandidat.name, 1] as const]) {
          const m = MENU.find((x) => x.name === nama)!
          for (const [key, takar] of Object.entries(m.recipe)) {
            const k = key as BahanKey
            perlu.set(
              k,
              (perlu.get(k) ?? new Decimal(0)).plus(
                new Decimal(takar as number).mul(qty as number),
              ),
            )
          }
        }

        const cukup = [...perlu].every(([k, butuh]) => stokKey(k).gte(butuh))
        if (cukup) {
          dipilih.set(kandidat.name, (dipilih.get(kandidat.name) ?? 0) + 1)
        }
      }

      if (dipilih.size === 0) continue

      let total = new Decimal(0)
      const items = [...dipilih].map(([nama, qty]) => {
        const m = MENU.find((x) => x.name === nama)!
        total = total.plus(new Decimal(m.price).mul(qty))
        return {
          menuId: menuId.get(nama)!,
          qty,
          unitPrice: new Decimal(m.price).toFixed(2),
          note: acak() < 0.3 ? pilih(CATATAN) : null,
        }
      })

      const sudahDipotong = s.status !== 'PENDING'

      const order = await prisma.order.create({
        data: {
          code: `TKR-${(jumlahPesanan + 4096).toString(16).toUpperCase().padStart(4, '0')}`,
          tableId: pilih(tables).id,
          customerName: pilih(NAMA_PELANGGAN),
          status: s.status,
          total: total.toFixed(2),
          createdAt: waktu,
          updatedAt: waktu,
          confirmedAt: sudahDipotong ? waktu : null,
          items: { create: items },
        },
      })

      jumlahPesanan++

      // Pesanan yang masih PENDING belum memotong stok, persis seperti
      // perilaku aplikasi: pemotongan terjadi saat kasir konfirmasi.
      if (sudahDipotong) {
        for (const [nama, qty] of dipilih) {
          const m = MENU.find((x) => x.name === nama)!
          for (const [key, takar] of Object.entries(m.recipe)) {
            const k = key as BahanKey
            const id = bahanId.get(k)!
            const perlu = new Decimal(takar as number).mul(qty)

            gerakan.push({
              ingredientId: id,
              qty: perlu.neg(),
              type: 'SALE',
              refType: 'order',
              refId: order.id,
              unitCost: hargaRata.get(id),
              createdAt: waktu,
            })
            tambahStok(k, perlu.neg())
          }
        }
      }

      void i
    }
  }

  console.log(`Menulis ${gerakan.length} pergerakan stok...`)
  const BATCH = 500
  for (let i = 0; i < gerakan.length; i += BATCH) {
    await prisma.stockMovement.createMany({
      data: gerakan.slice(i, i + BATCH).map((g) => ({
        ingredientId: g.ingredientId,
        qty: g.qty.toFixed(3),
        type: g.type,
        refType: g.refType ?? null,
        refId: g.refId ?? null,
        unitCost: g.unitCost ? g.unitCost.toFixed(4) : null,
        note: g.note ?? null,
        createdAt: g.createdAt,
      })),
    })
  }

  console.log('Menulis stok akhir & harga rata-rata...')
  for (const b of BAHAN) {
    const id = bahanId.get(b.key)!
    await prisma.ingredientStock.create({
      data: { ingredientId: id, qty: (stok.get(id) ?? new Decimal(0)).toFixed(3) },
    })
    await prisma.ingredient.update({
      where: { id },
      data: { avgCost: (hargaRata.get(id) ?? new Decimal(0)).toFixed(4) },
    })
  }

  // Satu pemeriksaan terakhir: cache harus sama dengan jumlah ledger.
  const cek = await prisma.stockMovement.groupBy({
    by: ['ingredientId'],
    _sum: { qty: true },
  })
  const meleset = cek.filter((row) => {
    const cache = stok.get(row.ingredientId) ?? new Decimal(0)
    return !cache.equals(new Decimal((row._sum.qty ?? 0).toString()))
  })

  console.log('\nSelesai.')
  console.log(`  ${BAHAN.length} bahan · ${MENU.length} menu · ${tables.length} meja`)
  console.log(`  ${jumlahPesanan} pesanan (${jumlahBatal} dibatalkan) · ${gerakan.length} pergerakan stok`)
  console.log(`  cache vs ledger: ${meleset.length === 0 ? 'cocok semua' : `${meleset.length} MELESET`}`)
  console.log('  Login owner : owner@takar.test / takar1234')
  console.log('  Login staff : staff@takar.test / takar1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
