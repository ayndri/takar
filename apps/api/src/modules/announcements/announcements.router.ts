import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { getParams, validateBody, validateParams } from '../../middleware/validate.js'
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  pengumumanAktif,
  toggleAnnouncement,
  updateAnnouncement,
} from './announcements.service.js'

const idParamSchema = z.object({ id: z.uuid('ID tidak valid') })

const announcementSchema = z.object({
  title: z.string().min(3, 'Judul terlalu pendek').max(80),
  body: z.string().min(3, 'Isi terlalu pendek').max(300),
  linkLabel: z.string().max(40).nullish(),
  /**
   * Hanya tautan di dalam situs ini. Tautan keluar di banner beranda gampang
   * dipakai menyalahgunakan nama kafe, dan tidak ada gunanya untuk promo.
   */
  linkHref: z
    .string()
    .max(200)
    .regex(/^\/[A-Za-z0-9\-._~/?#[\]@!$&'()*+,;=%]*$/, 'Alamat harus diawali / dan tanpa domain')
    .nullish(),
  startsAt: z.iso.datetime().nullish(),
  endsAt: z.iso.datetime().nullish(),
  isActive: z.boolean().optional(),
})

/** Sisi pelanggan — tanpa login, cuma yang sedang tampil. */
export const publicAnnouncementsRouter = Router()

publicAnnouncementsRouter.get('/', async (_req, res) => {
  res.json(await pengumumanAktif())
})

/** Sisi kafe. Membaca cukup login, mengubah milik pemilik. */
export const adminAnnouncementsRouter = Router()

adminAnnouncementsRouter.use(requireAuth)

adminAnnouncementsRouter.get('/', async (_req, res) => {
  res.json(await listAnnouncements())
})

adminAnnouncementsRouter.post(
  '/',
  requireRole('OWNER'),
  validateBody(announcementSchema),
  async (req, res) => {
    res.status(201).json(await createAnnouncement(req.body))
  },
)

adminAnnouncementsRouter.put(
  '/:id',
  requireRole('OWNER'),
  validateParams(idParamSchema),
  validateBody(announcementSchema),
  async (req, res) => {
    res.json(await updateAnnouncement(getParams<{ id: string }>(res).id, req.body))
  },
)

adminAnnouncementsRouter.post(
  '/:id/toggle',
  requireRole('OWNER'),
  validateParams(idParamSchema),
  async (_req, res) => {
    res.json(await toggleAnnouncement(getParams<{ id: string }>(res).id))
  },
)

adminAnnouncementsRouter.delete(
  '/:id',
  requireRole('OWNER'),
  validateParams(idParamSchema),
  async (_req, res) => {
    res.json(await deleteAnnouncement(getParams<{ id: string }>(res).id))
  },
)
