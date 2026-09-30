import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from '../../lib/errors.js'

export type AnnouncementInput = {
  title: string
  body: string
  linkLabel?: string | null
  linkHref?: string | null
  startsAt?: string | null
  endsAt?: string | null
  isActive?: boolean
}

function rapikan(a: {
  id: string
  title: string
  body: string
  linkLabel: string | null
  linkHref: string | null
  startsAt: Date | null
  endsAt: Date | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  const sekarang = new Date()

  return {
    id: a.id,
    title: a.title,
    body: a.body,
    linkLabel: a.linkLabel,
    linkHref: a.linkHref,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    isActive: a.isActive,
    /**
     * Apakah pengumuman ini yang sedang dilihat pelanggan saat ini.
     *
     * Dibedakan dari `isActive` karena artinya beda: `isActive` itu saklar
     * yang ditekan pemilik, `sedangTampil` juga memperhitungkan rentang
     * waktunya. Pengumuman yang dinyalakan untuk minggu depan tetap
     * `isActive` tapi belum `sedangTampil`.
     */
    sedangTampil:
      a.isActive &&
      (!a.startsAt || a.startsAt <= sekarang) &&
      (!a.endsAt || a.endsAt > sekarang),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }
}

function periksa(input: AnnouncementInput) {
  const mulai = input.startsAt ? new Date(input.startsAt) : null
  const selesai = input.endsAt ? new Date(input.endsAt) : null

  if (mulai && selesai && selesai <= mulai) {
    throw badRequest('Tanggal selesai harus setelah tanggal mulai')
  }

  // Tautan tanpa teks jadi tombol tanpa tulisan; teks tanpa tautan jadi
  // tombol yang tidak ke mana-mana. Keduanya harus ada atau tidak sama sekali.
  const adaLabel = Boolean(input.linkLabel?.trim())
  const adaHref = Boolean(input.linkHref?.trim())

  if (adaLabel !== adaHref) {
    throw badRequest('Teks tautan dan alamatnya harus diisi dua-duanya, atau dikosongkan dua-duanya')
  }

  return { mulai, selesai }
}

/**
 * Pengumuman yang sedang tampil di beranda, atau null.
 *
 * Cuma satu yang dikembalikan walau ada beberapa yang memenuhi syarat —
 * beberapa banner bertumpuk di beranda malah tidak ada yang terbaca. Yang
 * dipilih yang paling baru dibuat, jadi mengganti pengumuman cukup dengan
 * membuat yang baru tanpa mematikan yang lama.
 */
export async function pengumumanAktif() {
  const sekarang = new Date()

  const a = await prisma.announcement.findFirst({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: sekarang } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: sekarang } }] }],
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!a) return null

  return {
    id: a.id,
    title: a.title,
    body: a.body,
    linkLabel: a.linkLabel,
    linkHref: a.linkHref,
  }
}

export async function listAnnouncements() {
  const rows = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return rows.map(rapikan)
}

export async function createAnnouncement(input: AnnouncementInput) {
  const { mulai, selesai } = periksa(input)

  const a = await prisma.announcement.create({
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      linkLabel: input.linkLabel?.trim() || null,
      linkHref: input.linkHref?.trim() || null,
      startsAt: mulai,
      endsAt: selesai,
      isActive: input.isActive ?? true,
    },
  })

  return rapikan(a)
}

export async function updateAnnouncement(id: string, input: AnnouncementInput) {
  const ada = await prisma.announcement.findUnique({ where: { id } })
  if (!ada) throw notFound('Pengumuman tidak ditemukan')

  const { mulai, selesai } = periksa(input)

  const a = await prisma.announcement.update({
    where: { id },
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      linkLabel: input.linkLabel?.trim() || null,
      linkHref: input.linkHref?.trim() || null,
      startsAt: mulai,
      endsAt: selesai,
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  })

  return rapikan(a)
}

export async function toggleAnnouncement(id: string) {
  const ada = await prisma.announcement.findUnique({ where: { id } })
  if (!ada) throw notFound('Pengumuman tidak ditemukan')

  const a = await prisma.announcement.update({
    where: { id },
    data: { isActive: !ada.isActive },
  })

  return rapikan(a)
}

export async function deleteAnnouncement(id: string) {
  const ada = await prisma.announcement.findUnique({ where: { id } })
  if (!ada) throw notFound('Pengumuman tidak ditemukan')

  await prisma.announcement.delete({ where: { id } })

  return { id }
}
