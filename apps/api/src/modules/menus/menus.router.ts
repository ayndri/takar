import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { getParams, validateBody, validateParams } from '../../middleware/validate.js'
import { createMenuSchema, idParamSchema, updateMenuSchema } from './menus.schema.js'
import {
  createMenu,
  getMenu,
  listMenusForOwner,
  listPublicMenus,
  updateMenu,
} from './menus.service.js'

/** Katalog untuk pelanggan — tanpa login. */
export const publicMenusRouter = Router()

publicMenusRouter.get('/', async (_req, res) => {
  res.json(await listPublicMenus())
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
