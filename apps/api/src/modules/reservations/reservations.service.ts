import { randomBytes } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, notFound } from '../../lib/errors.js'
import { nomorWhatsapp } from '../../lib/phone.js'
import { angka, jam as bacaJam } from '../settings/settings.service.js'
import {
  ZONA_KAFE_MENIT,
  akhirReservasi,
  alasanWaktuDitolak,
  buatWaktu,
  pilihMejaTerbaik,
  slotHarian,
  tanggalLokal,
  type MejaKandidat,
} from './reservation-calculator.js'
import type {
  AvailabilityInput,
  CreateReservationInput,
  ListReservationsInput,
} from './reservations.schema.js'

/** Prisma dalam transaksi punya tipe yang sedikit berbeda dari client biasa. */
type Db = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Kode pendek yang gampang dibaca tamu lewat WhatsApp: RSV-3C91. */
function generateCode() {
  return `RSV-${randomBytes(2).toString('hex').toUpperCase()}`
}

/**
 * Status yang masih memegang meja.
 *
 * DONE, CANCELLED, dan NO_SHOW tidak ikut: mejanya sudah bebas dan boleh
 * dipesan orang lain di jam yang sama.
 */
const STATUS_MEMEGANG_MEJA = ['PENDING', 'CONFIRMED', 'SEATED'] as const

const RESERVATION_INCLUDE = {
  table: { select: { id: true, number: true, capacity: true } },
} as const

/** Semua pengaturan reservasi sekaligus, supaya tidak dibaca satu per satu. */
async function aturanReservasi() {
  const [durasiMenit, maksHariKeDepan, jamBuka, jamTutup] = await Promise.all([
    angka('reservasi.durasiMenit'),
    angka('reservasi.maksHariKeDepan'),
    bacaJam('reservasi.jamBuka'),
    bacaJam('reservasi.jamTutup'),
  ])

  return { durasiMenit, maksHariKeDepan, jamBuka, jamTutup }
}

/**
 * Kunci baris meja tertentu di dalam transaksi.
 *
 * Alasannya sama persis dengan lockStocks(): tanpa ini, dua orang yang
 * memesan meja 5 untuk jam tujuh malam pada detik yang sama sama-sama membaca
 * "belum ada yang pesan" lalu sama-sama tersimpan, dan kafe baru tahu saat
 * keduanya datang.
 *
 * Meja diurutkan supaya dua transaksi selalu mengunci dengan urutan yang sama.
 * Kalau tidak, A menunggu B sementara B menunggu A.
 */
async function lockTables(tx: Db, tableIds: string[]): Promise<void> {
  if (tableIds.length === 0) return

  const sorted = [...new Set(tableIds)].sort()

  // Cast ke text[], bukan uuid[]: Prisma memetakan `String @id` ke kolom text.
  await tx.$queryRawUnsafe(
    `select id
       from tables
      where id = any($1::text[])
      order by id
        for update`,
    sorted,
  )
}

/** Meja mana saja yang sudah terpakai pada rentang waktu ini. */
async function mejaTerpakai(
  tx: Db,
  mulai: Date,
  selesai: Date,
  kecualiId?: string,
): Promise<Set<string>> {
  const bentrok = await tx.reservation.findMany({
    where: {
      ...(kecualiId && { id: { not: kecualiId } }),
      tableId: { not: null },
      status: { in: [...STATUS_MEMEGANG_MEJA] },
      // Inilah cek bentrokannya: dua rentang bertabrakan kalau yang satu
      // mulai sebelum yang lain selesai, dan selesai setelah yang lain mulai.
      startAt: { lt: selesai },
      endAt: { gt: mulai },
    },
    select: { tableId: true },
  })

  return new Set(bentrok.map((b) => b.tableId!).filter(Boolean))
}

function rapikan(r: {
  id: string
  code: string
  customerName: string
  phone: string
  guestCount: number
  startAt: Date
  endAt: Date
  status: string
  note: string | null
  cancelReason?: string | null
  createdAt: Date
  table: { id: string; number: string; capacity: number } | null
}) {
  return {
    id: r.id,
    code: r.code,
    customerName: r.customerName,
    phone: r.phone,
    /**
     * Nomor yang sama, dalam bentuk yang diterima wa.me. null berarti yang
     * diketik tamu tidak bisa dihubungi — dasbor mematikan tombolnya alih-alih
     * membuka WhatsApp ke nomor ngawur.
     */
    waNumber: nomorWhatsapp(r.phone),
    guestCount: r.guestCount,
    startAt: r.startAt,
    endAt: r.endAt,
    /** Tanggal dan jam menurut jam dinding kafe — ini yang ditampilkan. */
    tanggal: tanggalLokal(r.startAt),
    status: r.status,
    note: r.note,
    cancelReason: r.cancelReason ?? null,
    createdAt: r.createdAt,
    table: r.table ? { id: r.table.id, number: r.table.number } : null,
  }
}

/**
 * Buat reservasi.
 *
 * Seluruh pemilihan meja ada di dalam satu transaksi:
 *   1. kunci baris semua meja yang jadi kandidat (FOR UPDATE)
 *   2. cari reservasi yang bentrok pada rentang waktu itu
 *   3. pilih meja terkecil yang masih muat dan belum terpakai
 *   4. kalau tidak ada yang tersisa → error, tidak ada yang tersimpan
 *
 * Langkah 1 harus mendahului langkah 2. Membaca dulu baru mengunci membuat
 * angka yang dipakai bisa sudah basi saat keputusannya diambil.
 */
export async function createReservation(input: CreateReservationInput) {
  const aturan = await aturanReservasi()

  const mulai = buatWaktu(input.tanggal, input.jam, ZONA_KAFE_MENIT)
  const selesai = akhirReservasi(mulai, aturan.durasiMenit)

  const ditolak = alasanWaktuDitolak({
    mulai,
    durasiMenit: aturan.durasiMenit,
    jamBuka: aturan.jamBuka,
    jamTutup: aturan.jamTutup,
    maksHariKeDepan: aturan.maksHariKeDepan,
    sekarang: new Date(),
  })

  if (ditolak) throw badRequest(ditolak)

  return prisma.$transaction(async (tx) => {
    const semua = await tx.cafeTable.findMany({
      where: {
        isActive: true,
        ...(input.tableId && { id: input.tableId }),
      },
      select: { id: true, number: true, capacity: true },
    })

    if (semua.length === 0) {
      throw input.tableId
        ? notFound('Meja tidak ditemukan atau sedang tidak dipakai')
        : conflict('Belum ada meja yang bisa dipesan')
    }

    const muat = semua.filter((m) => m.capacity >= input.guestCount)

    if (muat.length === 0) {
      const terbesar = Math.max(...semua.map((m) => m.capacity))
      throw conflict(
        input.tableId
          ? `Meja itu muat ${terbesar} orang, sedangkan tamunya ${input.guestCount}`
          : `Meja terbesar di sini muat ${terbesar} orang. Untuk ${input.guestCount} orang, hubungi kafe langsung.`,
      )
    }

    await lockTables(
      tx,
      muat.map((m) => m.id),
    )

    const terpakai = await mejaTerpakai(tx, mulai, selesai)
    const bebas: MejaKandidat[] = muat.filter((m) => !terpakai.has(m.id))

    const terpilih = pilihMejaTerbaik(bebas, input.guestCount)

    if (!terpilih) {
      throw conflict(
        input.tableId
          ? 'Meja itu sudah dipesan orang lain pada jam tersebut'
          : `Semua meja untuk ${input.guestCount} orang sudah penuh pada jam itu. Coba jam lain.`,
      )
    }

    const reservation = await tx.reservation.create({
      data: {
        code: generateCode(),
        tableId: terpilih.id,
        customerName: input.customerName,
        phone: input.phone,
        guestCount: input.guestCount,
        startAt: mulai,
        endAt: selesai,
        note: input.note ?? null,
      },
      include: RESERVATION_INCLUDE,
    })

    return rapikan(reservation)
  })
}

/**
 * Jam mana saja yang masih bisa dipesan pada satu tanggal.
 *
 * Dihitung tanpa penguncian: ini cuma tampilan, dan angkanya boleh basi
 * sepersekian detik. Keputusan sesungguhnya diambil di createReservation()
 * setelah baris meja dikunci — sama seperti katalog menu yang menampilkan
 * "tersisa 3 porsi" tapi yang menentukan tetap confirmOrder().
 */
export async function availability(input: AvailabilityInput) {
  const aturan = await aturanReservasi()

  const slot = slotHarian({
    jamBuka: aturan.jamBuka,
    jamTutup: aturan.jamTutup,
    durasiMenit: aturan.durasiMenit,
  })

  const meja = await prisma.cafeTable.findMany({
    where: { isActive: true, capacity: { gte: input.guestCount } },
    select: { id: true, number: true, capacity: true },
  })

  const sekarang = new Date()

  // Satu hari saja, jadi semua reservasi hari itu diambil sekali lalu
  // dicocokkan di memori. Jauh lebih murah daripada satu query per slot.
  const awalHari = buatWaktu(input.tanggal, '00:00', ZONA_KAFE_MENIT)
  const akhirHari = new Date(awalHari.getTime() + 36 * 60 * 60 * 1000)

  const terisi = await prisma.reservation.findMany({
    where: {
      tableId: { not: null },
      status: { in: [...STATUS_MEMEGANG_MEJA] },
      startAt: { lt: akhirHari },
      endAt: { gt: awalHari },
    },
    select: { tableId: true, startAt: true, endAt: true },
  })

  const jamTersedia = slot.map((j) => {
    const mulai = buatWaktu(input.tanggal, j, ZONA_KAFE_MENIT)
    const selesai = akhirReservasi(mulai, aturan.durasiMenit)

    const alasan = alasanWaktuDitolak({
      mulai,
      durasiMenit: aturan.durasiMenit,
      jamBuka: aturan.jamBuka,
      jamTutup: aturan.jamTutup,
      maksHariKeDepan: aturan.maksHariKeDepan,
      sekarang,
    })

    const dipakai = new Set(
      terisi
        .filter((r) => r.startAt < selesai && r.endAt > mulai)
        .map((r) => r.tableId!),
    )

    const sisa = meja.filter((m) => !dipakai.has(m.id)).length

    return {
      jam: j,
      /** Berapa meja yang masih kosong pada jam ini. */
      sisaMeja: sisa,
      bisa: alasan === null && sisa > 0,
      alasan: alasan ?? (sisa === 0 ? 'Semua meja sudah dipesan' : null),
    }
  })

  return {
    tanggal: input.tanggal,
    durasiMenit: aturan.durasiMenit,
    jamBuka: aturan.jamBuka,
    jamTutup: aturan.jamTutup,
    maksHariKeDepan: aturan.maksHariKeDepan,
    /** Kapasitas meja terbesar — dipakai form untuk menjelaskan batasnya. */
    kapasitasTerbesar: meja.length > 0 ? Math.max(...meja.map((m) => m.capacity)) : 0,
    slot: jamTersedia,
  }
}

export async function getReservationByCode(code: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { code: code.toUpperCase() },
    include: RESERVATION_INCLUDE,
  })

  if (!reservation) throw notFound('Reservasi tidak ditemukan')

  return rapikan(reservation)
}

export async function listReservations(params: ListReservationsInput) {
  // Saringan tanggal dibatasi pada hari kafe, bukan hari UTC: reservasi jam
  // 8 malam WIB masih tanggal itu buat kafe, tapi di UTC sudah siang hari
  // yang sama — dan jam 1 pagi WIB di UTC masih tanggal kemarin.
  const awalHari = params.tanggal
    ? buatWaktu(params.tanggal, '00:00', ZONA_KAFE_MENIT)
    : null

  const rentang = awalHari
    ? {
        startAt: {
          gte: awalHari,
          lt: new Date(awalHari.getTime() + 24 * 60 * 60 * 1000),
        },
      }
    : {}

  const rows = await prisma.reservation.findMany({
    where: {
      ...(params.status && { status: params.status }),
      ...rentang,
    },
    include: RESERVATION_INCLUDE,
    orderBy: { startAt: 'asc' },
    take: params.limit,
  })

  return rows.map(rapikan)
}

/** Perpindahan status yang diizinkan. Sisanya ditolak. */
const LANJUT: Record<string, readonly string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SEATED', 'CANCELLED', 'NO_SHOW'],
  SEATED: ['DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
  NO_SHOW: [],
}

const LABEL_STATUS: Record<string, string> = {
  PENDING: 'menunggu konfirmasi',
  CONFIRMED: 'dikonfirmasi',
  SEATED: 'tamu sudah duduk',
  DONE: 'selesai',
  CANCELLED: 'dibatalkan',
  NO_SHOW: 'tamu tidak datang',
}

/**
 * Ubah status reservasi.
 *
 * Dijaga daftar perpindahan, bukan diserahkan ke tombol di frontend: dua
 * barista yang membuka layar yang sama bisa menekan "tamu datang" dua kali,
 * dan yang kedua harus ditolak, bukan menimpa jam duduk yang pertama.
 */
export async function setReservationStatus(
  id: string,
  status: 'CONFIRMED' | 'SEATED' | 'DONE' | 'CANCELLED' | 'NO_SHOW',
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const ada = await tx.reservation.findUnique({ where: { id } })
    if (!ada) throw notFound('Reservasi tidak ditemukan')

    if (!LANJUT[ada.status]?.includes(status)) {
      throw conflict(
        `Reservasi ${LABEL_STATUS[ada.status]} tidak bisa diubah jadi ${LABEL_STATUS[status]}`,
      )
    }

    // Reservasi tanpa meja tidak boleh dikonfirmasi — tidak ada yang
    // dijanjikan ke tamu kalau mejanya belum ditentukan.
    if (status === 'CONFIRMED' && !ada.tableId) {
      throw badRequest('Tentukan dulu mejanya sebelum mengonfirmasi')
    }

    const sekarang = new Date()

    const reservation = await tx.reservation.update({
      where: { id },
      data: {
        status,
        ...(status === 'CONFIRMED' && { confirmedAt: sekarang }),
        ...(status === 'SEATED' && { seatedAt: sekarang }),
        ...(status === 'CANCELLED' && {
          cancelledAt: sekarang,
          cancelReason: reason ?? null,
        }),
      },
      include: RESERVATION_INCLUDE,
    })

    return rapikan(reservation)
  })
}

/**
 * Pindahkan reservasi ke meja lain.
 *
 * Penguncian dan cek bentrok sama seperti saat membuat: memindahkan tamu ke
 * meja yang ternyata sudah dijanjikan ke orang lain sama saja dengan membuat
 * bentrokan baru dengan tangan sendiri.
 */
export async function assignTable(id: string, tableId: string) {
  return prisma.$transaction(async (tx) => {
    const ada = await tx.reservation.findUnique({ where: { id } })
    if (!ada) throw notFound('Reservasi tidak ditemukan')

    if (!LANJUT[ada.status] || LANJUT[ada.status]!.length === 0) {
      throw conflict(`Reservasi ${LABEL_STATUS[ada.status]} tidak bisa dipindah mejanya`)
    }

    const meja = await tx.cafeTable.findUnique({
      where: { id: tableId },
      select: { id: true, number: true, capacity: true, isActive: true },
    })

    if (!meja?.isActive) throw notFound('Meja tidak ditemukan atau sedang tidak dipakai')

    if (meja.capacity < ada.guestCount) {
      throw conflict(
        `Meja ${meja.number} muat ${meja.capacity} orang, sedangkan tamunya ${ada.guestCount}`,
      )
    }

    await lockTables(tx, [tableId])

    const terpakai = await mejaTerpakai(tx, ada.startAt, ada.endAt, ada.id)
    if (terpakai.has(tableId)) {
      throw conflict(`Meja ${meja.number} sudah dipesan orang lain pada jam itu`)
    }

    const reservation = await tx.reservation.update({
      where: { id },
      data: { tableId },
      include: RESERVATION_INCLUDE,
    })

    return rapikan(reservation)
  })
}
