import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { badRequest } from '../../lib/errors.js'
import { getUser, requireAuth, requireRole } from '../../middleware/auth.js'
import { getParams, getQuery, validateParams, validateQuery } from '../../middleware/validate.js'
import {
  UKURAN_MAKS,
  ambilBerkas,
  daftarBukti,
  hapusBukti,
  simpanBerkas,
} from './attachments.service.js'

// Berkas ditahan di memori, tidak ditulis ke disk sementara: ukurannya
// dibatasi 5 MB dan tujuan akhirnya memang kolom di database.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UKURAN_MAKS, files: 1 },
})

export const attachmentsRouter = Router()

attachmentsRouter.use(requireAuth)

attachmentsRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Tidak ada berkas yang diunggah')

  res.status(201).json(
    await simpanBerkas({
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      userId: getUser(res).id,
    }),
  )
})

attachmentsRouter.get(
  '/',
  validateQuery(
    z.object({
      refType: z.enum(['purchase', 'waste', 'opname']),
      refId: z.uuid(),
    }),
  ),
  async (_req, res) => {
    const { refType, refId } = getQuery<{ refType: string; refId: string }>(res)
    res.json(await daftarBukti(refType, refId))
  },
)

/**
 * Isi berkasnya.
 *
 * Tetap memerlukan login: nota belanja memuat nama supplier dan harga beli,
 * yang bukan urusan orang luar. Karena itu gambar di dasbor diambil lewat
 * fetch ber-token, bukan dipasang langsung sebagai src.
 */
attachmentsRouter.get(
  '/:id/file',
  validateParams(z.object({ id: z.uuid() })),
  async (_req, res) => {
    const berkas = await ambilBerkas(getParams<{ id: string }>(res).id)

    res.setHeader('Content-Type', berkas.mimeType)
    res.setHeader('Content-Length', String(berkas.size))
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(berkas.filename)}"`,
    )
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.end(Buffer.from(berkas.data))
  },
)

attachmentsRouter.delete(
  '/:id',
  requireRole('OWNER'),
  validateParams(z.object({ id: z.uuid() })),
  async (_req, res) => {
    await hapusBukti(getParams<{ id: string }>(res).id)
    res.status(204).end()
  },
)
