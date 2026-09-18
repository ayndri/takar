import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { notFound } from '../../lib/errors.js'
import { getParams, validateParams } from '../../middleware/validate.js'

export const tablesRouter = Router()

/** Daftar meja — dipakai form pesanan saat pelanggan tidak lewat QR. */
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
 * Token dipakai supaya nomor meja tidak bisa ditebak dengan mengganti angka di URL.
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
