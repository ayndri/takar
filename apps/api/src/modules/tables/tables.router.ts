import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { conflict, notFound } from '../../lib/errors.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { getParams, validateBody, validateParams } from '../../middleware/validate.js'

/** Token cukup panjang supaya tidak bisa ditebak dengan mencoba-coba. */
const buatToken = () => randomBytes(9).toString('base64url')

export const tablesRouter = Router()

/**
 * Daftar meja untuk form pesanan.
 *
 * Sengaja tanpa qrToken: kalau token semua meja bisa diambil dari sini, QR di
 * meja kehilangan gunanya karena siapa pun bisa mengaku duduk di meja mana pun.
 */
tablesRouter.get('/', async (_req, res) => {
  const tables = await prisma.cafeTable.findMany({
    where: { isActive: true },
    select: { id: true, number: true },
    orderBy: { number: 'asc' },
  })

  res.json(tables)
})

/**
 * Tukar token QR jadi data meja.
 * Dipanggil halaman /meja/[token] saat pelanggan memindai kode di mejanya.
 */
tablesRouter.get(
  '/by-token/:token',
  validateParams(z.object({ token: z.string().min(4).max(64) })),
  async (_req, res) => {
    const token = getParams<{ token: string }>(res).token

    const table = await prisma.cafeTable.findUnique({
      where: { qrToken: token },
      select: { id: true, number: true, isActive: true },
    })

    if (!table?.isActive) throw notFound('Meja tidak ditemukan')

    res.json({ id: table.id, number: table.number })
  },
)

/** Pengelolaan meja dan QR-nya. Hanya untuk staff. */
export const adminTablesRouter = Router()

adminTablesRouter.use(requireAuth)

adminTablesRouter.get('/', async (_req, res) => {
  const tables = await prisma.cafeTable.findMany({
    orderBy: { number: 'asc' },
  })

  res.json(
    tables.map((t) => ({
      id: t.id,
      number: t.number,
      qrToken: t.qrToken,
      isActive: t.isActive,
      /** Alamat yang dituliskan ke dalam kode QR. */
      path: `/meja/${t.qrToken}`,
    })),
  )
})

adminTablesRouter.post(
  '/',
  requireRole('OWNER'),
  validateBody(z.object({ number: z.string().min(1).max(10) })),
  async (req, res) => {
    const ada = await prisma.cafeTable.findUnique({
      where: { number: req.body.number },
    })

    if (ada) throw conflict(`Meja ${req.body.number} sudah ada`)

    const table = await prisma.cafeTable.create({
      data: { number: req.body.number, qrToken: buatToken() },
    })

    res.status(201).json(table)
  },
)

/**
 * Ganti token meja.
 *
 * Dipakai kalau stiker QR-nya difoto orang lalu dipakai memesan dari luar kafe.
 * Token lama langsung mati begitu yang baru dibuat.
 */
adminTablesRouter.post(
  '/:id/regenerate',
  requireRole('OWNER'),
  validateParams(z.object({ id: z.uuid() })),
  async (_req, res) => {
    const id = getParams<{ id: string }>(res).id

    const ada = await prisma.cafeTable.findUnique({ where: { id } })
    if (!ada) throw notFound('Meja tidak ditemukan')

    const table = await prisma.cafeTable.update({
      where: { id },
      data: { qrToken: buatToken() },
    })

    res.json({ id: table.id, number: table.number, qrToken: table.qrToken })
  },
)

adminTablesRouter.post(
  '/:id/toggle',
  requireRole('OWNER'),
  validateParams(z.object({ id: z.uuid() })),
  async (_req, res) => {
    const id = getParams<{ id: string }>(res).id

    const ada = await prisma.cafeTable.findUnique({ where: { id } })
    if (!ada) throw notFound('Meja tidak ditemukan')

    const table = await prisma.cafeTable.update({
      where: { id },
      data: { isActive: !ada.isActive },
    })

    res.json({ id: table.id, number: table.number, isActive: table.isActive })
  },
)
