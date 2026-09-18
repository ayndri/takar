import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import {
  getParams,
  getQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validate.js'
import { createMenuSchema, idParamSchema, updateMenuSchema } from './menus.schema.js'
import {
  createMenu,
  getHighlights,
  getMenu,
  listMenusForOwner,
  listPublicMenus,
  updateMenu,
} from './menus.service.js'

const listMenuSchema = z.object({
  q: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(96).default(12),
})

type ListMenuQuery = z.infer<typeof listMenuSchema>

/** Katalog untuk pelanggan, tanpa login. */
export const publicMenusRouter = Router()

publicMenusRouter.get('/', validateQuery(listMenuSchema), async (_req, res) => {
  res.json(await listPublicMenus(getQuery<ListMenuQuery>(res)))
})

// Didaftarkan sebelum '/:id', kalau tidak "highlights" akan dibaca sebagai id.
publicMenusRouter.get('/highlights', async (_req, res) => {
  res.json(await getHighlights())
})

publicMenusRouter.get('/:id', validateParams(idParamSchema), async (_req, res) => {
  res.json(await getMenu(getParams<{ id: string }>(res).id))
})

/** Pengelolaan menu — hanya owner. */
export const adminMenusRouter = Router()

adminMenusRouter.use(requireAuth, requireRole('OWNER'))

adminMenusRouter.get('/', async (_req, res) => {
  res.json(await listMenusForOwner())
})

adminMenusRouter.post('/', validateBody(createMenuSchema), async (req, res) => {
  res.status(201).json(await createMenu(req.body))
})

adminMenusRouter.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateMenuSchema),
  async (req, res) => {
    res.json(await updateMenu(getParams<{ id: string }>(res).id, req.body))
  },
)
