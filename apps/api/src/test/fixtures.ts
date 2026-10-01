import { Decimal } from 'decimal.js'
import { prisma } from '../lib/prisma.js'
import { lupakanCacheSettings } from '../modules/settings/settings.service.js'

/**
 * Perkakas untuk tes integrasi.
 *
 * Dua hal yang dikerjakan di sini: mengosongkan database, dan menyiapkan
 * kafe kecil yang isinya pas untuk satu tes.
 *
 * Isinya sengaja tidak memakai seeder sungguhan. Seeder membangun 14 hari
 * operasi dengan 96 menu, dan tes yang menyatakan "cup tinggal dua" jadi
 * harus mencari dulu di tengah ratusan baris. Kafe tiga bahan yang dibuat
 * di tempat jauh lebih mudah dibaca: angka yang diuji terlihat langsung di
 * sebelah pernyataannya.
 */

/**
 * Tolak kalau yang tersambung bukan database uji.
 *
 * Ditanyakan ke databasenya sendiri lewat `current_database()`, bukan dibaca
 * dari variabel lingkungan. Alasannya mahal dipelajari: penjaga versi
 * pertama memeriksa DATABASE_URL di berkas setup, dan berkas setup itu hanya
 * dimuat oleh konfigurasi tes integrasi. Saat berkas `.int.test.ts` tidak
 * sengaja ikut terpungut oleh `npm run test`, konfigurasi unit memuatnya
 * tanpa setup dan tanpa env, dotenv mengisi DATABASE_URL dari `.env`, dan
 * seluruh tabel di database yang sedang dipakai terhapus.
 *
 * Pelajarannya: penjaga harus menempel pada perbuatan yang berbahaya, bukan
 * pada jalur yang kebetulan biasa dilewati. Ditaruh di sini, ia ikut ke mana
 * pun fungsi ini dipanggil.
 */
async function pastikanDatabaseUji() {
  const baris = await prisma.$queryRaw<{ db: string }[]>`
    select current_database() as db
  `

  const db = baris[0]?.db ?? '(tidak diketahui)'

  if (!/test/i.test(db)) {
    throw new Error(
      [
        `MENOLAK mengosongkan database "${db}".`,
        '',
        'Nama databasenya harus mengandung "test". Yang ini tidak, jadi besar',
        'kemungkinan ia sedang dipakai untuk hal lain.',
        '',
        'Jalankan tes integrasi dengan DATABASE_URL_TEST yang menunjuk ke',
        'database uji tersendiri: npm run test:int',
      ].join('\n'),
    )
  }
}

/**
 * Kosongkan semua tabel.
 *
 * Satu perintah TRUNCATE untuk semuanya, dengan CASCADE supaya urutan foreign
 * key tidak perlu dipikirkan. Jauh lebih cepat daripada migrate reset, dan
 * tesnya dijalankan berurutan jadi tidak ada yang bertabrakan.
 *
 * Daftar tabelnya dibaca dari katalog Postgres, bukan ditulis tangan. Tabel
 * baru yang ditambahkan nanti otomatis ikut terhapus, dan tidak ada tes yang
 * diam-diam mewarisi data dari tes sebelumnya.
 */
export async function kosongkanDatabase() {
  await pastikanDatabaseUji()

  const tabel = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename
      from pg_tables
     where schemaname = 'public'
       and tablename not like '_prisma%'
  `

  if (tabel.length > 0) {
    const daftar = tabel.map((t) => `"public"."${t.tablename}"`).join(', ')
    await prisma.$executeRawUnsafe(`truncate table ${daftar} restart identity cascade`)
  }

  // Pengaturan disimpan di memori selama sepuluh detik. Tanpa dilupakan,
  // tes berikutnya mewarisi sakelar yang diubah tes sebelumnya.
  lupakanCacheSettings()
}

export type Kafe = Awaited<ReturnType<typeof siapkanKafe>>

/**
 * Kafe terkecil yang masih masuk akal: dua bahan, satu menu, satu meja.
 *
 * Resep Latte sengaja memakai dua bahan dengan sisa yang berbeda jauh, jadi
 * tes bisa membuat salah satunya habis duluan tanpa menyentuh yang lain.
 */
export async function siapkanKafe(
  opsi: { susu?: number; cup?: number; harga?: number } = {},
) {
  const susuAwal = opsi.susu ?? 10_000
  const cupAwal = opsi.cup ?? 100
  const harga = opsi.harga ?? 28_000

  const susu = await prisma.ingredient.create({
    data: { name: 'Susu UHT', baseUnit: 'ML', minStock: 1000, avgCost: '15.0000' },
  })

  const cup = await prisma.ingredient.create({
    data: { name: 'Gelas plastik', baseUnit: 'PCS', minStock: 20, avgCost: '900.0000' },
  })

  // Stok masuk lewat jalur yang sama dengan aplikasi: satu pergerakan di
  // ledger, satu baris cache. Mengisi cache saja akan membuat tes lolos
  // padahal invariannya dilanggar sejak awal.
  for (const [bahan, qty] of [
    [susu, susuAwal],
    [cup, cupAwal],
  ] as const) {
    await prisma.stockMovement.create({
      data: {
        ingredientId: bahan.id,
        qty: new Decimal(qty).toFixed(3),
        type: 'PURCHASE',
        unitCost: bahan.avgCost,
        note: 'stok awal untuk tes',
      },
    })
    await prisma.ingredientStock.create({
      data: { ingredientId: bahan.id, qty: new Decimal(qty).toFixed(3) },
    })
  }

  const latte = await prisma.menu.create({
    data: {
      name: 'Latte',
      category: 'Kopi',
      price: new Decimal(harga).toFixed(2),
      recipes: {
        create: [
          { ingredientId: susu.id, qty: '150.000' },
          { ingredientId: cup.id, qty: '1.000' },
        ],
      },
    },
  })

  const meja = await prisma.cafeTable.create({
    data: { number: '1', qrToken: 'token-uji-meja-satu', capacity: 4 },
  })

  return { susu, cup, latte, meja, susuAwal, cupAwal, harga }
}

/** Stok menurut cache, dipakai sebagian besar jalur baca aplikasi. */
export async function stokCache(ingredientId: string) {
  const row = await prisma.ingredientStock.findUnique({ where: { ingredientId } })
  return new Decimal(row?.qty.toString() ?? '0')
}

/** Stok menurut jumlah seluruh ledger. Inilah angka yang sebenarnya benar. */
export async function stokLedger(ingredientId: string) {
  const hasil = await prisma.stockMovement.aggregate({
    where: { ingredientId },
    _sum: { qty: true },
  })

  return new Decimal((hasil._sum.qty ?? 0).toString())
}

/**
 * Periksa invarian paling penting di seluruh project: cache stok harus sama
 * dengan jumlah ledger-nya, untuk setiap bahan.
 *
 * Dipanggil di akhir tiap alur. Kalau ada operasi yang menulis cache tanpa
 * menulis ledger (atau sebaliknya), inilah yang menangkapnya.
 */
export async function periksaCacheCocokLedger() {
  const semua = await prisma.ingredient.findMany({ select: { id: true, name: true } })

  const meleset: string[] = []

  for (const b of semua) {
    const cache = await stokCache(b.id)
    const ledger = await stokLedger(b.id)
    if (!cache.equals(ledger)) {
      meleset.push(`${b.name}: cache ${cache.toString()} vs ledger ${ledger.toString()}`)
    }
  }

  return meleset
}
