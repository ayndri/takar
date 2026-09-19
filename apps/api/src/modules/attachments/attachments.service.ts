import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from '../../lib/errors.js'

/** Hanya tipe yang benar-benar bisa jadi bukti belanja. */
export const TIPE_DIIZINKAN = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const

export const UKURAN_MAKS = 5 * 1024 * 1024

/**
 * Simpan berkas bukti. Belum terkait ke dokumen mana pun.
 *
 * Urutannya memang begitu: berkas diunggah lebih dulu, lalu id-nya dikirim
 * bersama nota. Dengan cara ini pencatatan nota bisa menolak dirinya sendiri
 * kalau buktinya tidak ada, tanpa perlu membuat nota setengah jadi dulu.
 */
export async function simpanBerkas(input: {
  filename: string
  mimeType: string
  size: number
  data: Buffer
  userId: string
}) {
  if (!TIPE_DIIZINKAN.includes(input.mimeType as (typeof TIPE_DIIZINKAN)[number])) {
    throw badRequest(
      'Bukti harus berupa foto (JPG, PNG, WEBP, HEIC) atau PDF',
    )
  }

  if (input.size > UKURAN_MAKS) {
    throw badRequest('Ukuran berkas maksimal 5 MB')
  }

  // Berkas yang diunggah lalu ditinggalkan (form ditutup sebelum disimpan)
  // dibersihkan sambil jalan, supaya tidak menumpuk diam-diam.
  await prisma.attachment.deleteMany({
    where: {
      refId: null,
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })

  const row = await prisma.attachment.create({
    data: {
      filename: input.filename.slice(0, 200),
      mimeType: input.mimeType,
      size: input.size,
      // Prisma menunggu Uint8Array yang berdiri di atas ArrayBuffer biasa,
      // sedangkan Buffer dari multer tipenya lebih longgar. Disalin sekali
      // di sini supaya tipenya pasti dan isinya tidak berbagi memori dengan
      // buffer permintaan yang akan dilepas.
      data: Uint8Array.from(input.data),
      uploadedById: input.userId,
    },
    select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
  })

  return row
}

/**
 * Kaitkan berkas yang sudah diunggah ke dokumennya.
 *
 * Dipanggil di dalam transaksi pembuatan dokumen, jadi kalau dokumennya gagal
 * disimpan, buktinya juga tidak jadi terkait ke apa pun.
 */
export async function kaitkan(
  tx: { attachment: { updateMany: typeof prisma.attachment.updateMany } },
  ids: string[],
  refType: string,
  refId: string,
) {
  if (ids.length === 0) return

  const hasil = await tx.attachment.updateMany({
    where: { id: { in: ids }, refId: null },
    data: { refType, refId },
  })

  if (hasil.count !== ids.length) {
    throw badRequest('Ada bukti yang tidak ditemukan atau sudah dipakai dokumen lain')
  }
}

export async function daftarBukti(refType: string, refId: string) {
  return prisma.attachment.findMany({
    where: { refType, refId },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}

/** Berapa bukti yang dimiliki tiap dokumen, untuk menandai yang belum punya. */
export async function hitungBukti(refType: string, refIds: string[]) {
  if (refIds.length === 0) return new Map<string, number>()

  const rows = await prisma.attachment.groupBy({
    by: ['refId'],
    _count: { _all: true },
    where: { refType, refId: { in: refIds } },
  })

  return new Map(rows.map((r) => [r.refId!, r._count._all]))
}

export async function ambilBerkas(id: string) {
  const row = await prisma.attachment.findUnique({ where: { id } })
  if (!row) throw notFound('Bukti tidak ditemukan')
  return row
}

export async function hapusBukti(id: string) {
  const row = await prisma.attachment.findUnique({
    where: { id },
    select: { id: true, refType: true, refId: true },
  })

  if (!row) throw notFound('Bukti tidak ditemukan')

  // Nota pembelian wajib punya bukti, jadi yang terakhir tidak boleh dicabut.
  if (row.refType === 'purchase' && row.refId) {
    const sisa = await prisma.attachment.count({
      where: { refType: 'purchase', refId: row.refId },
    })

    if (sisa <= 1) {
      throw badRequest(
        'Nota pembelian harus punya minimal satu bukti. Unggah pengganti dulu sebelum menghapus yang ini.',
      )
    }
  }

  await prisma.attachment.delete({ where: { id } })
}
