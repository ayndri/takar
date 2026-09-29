import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { GRUP_LABEL } from './settings.catalog.js'
import { daftarSettings, settingsPublik, simpanSettings } from './settings.service.js'

/**
 * Pengaturan yang boleh dibaca halaman pelanggan.
 * Tanpa login — halaman menu perlu tahu apakah pesanan sedang diterima.
 */
export const publicSettingsRouter = Router()

publicSettingsRouter.get('/', async (_req, res) => {
  res.json(await settingsPublik())
})

/**
 * Pengaturan lengkap.
 *
 * Membacanya cukup login: menu dasbor barista ikut disaring oleh nilai ini,
 * jadi staff harus bisa tahu modul mana yang hidup. Mengubahnya tetap milik
 * pemilik saja.
 */
export const settingsRouter = Router()

settingsRouter.use(requireAuth)

settingsRouter.get('/', async (_req, res) => {
  res.json({ grup: GRUP_LABEL, items: await daftarSettings() })
})

const patchSchema = z.record(
  z.string().min(1).max(64),
  z.union([z.boolean(), z.string().max(32), z.number()]),
)

settingsRouter.patch(
  '/',
  requireRole('OWNER'),
  validateBody(patchSchema),
  async (req, res) => {
    res.json({ grup: GRUP_LABEL, items: await simpanSettings(req.body) })
  },
)
