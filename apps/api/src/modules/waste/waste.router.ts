import { Router } from 'express'
import { z } from 'zod'
import { getUser, requireAuth } from '../../middleware/auth.js'
import { getQuery, validateBody, validateQuery } from '../../middleware/validate.js'
import { createWaste, listWaste } from './waste.service.js'

const createWasteSchema = z.object({
  ingredientId: z.uuid(),
  qty: z.number().positive('Jumlah yang terbuang harus lebih dari nol'),
  reason: z.enum(['SPILLED', 'EXPIRED', 'MISTAKE', 'OTHER']),
  note: z.string().max(200).optional(),
})

const listWasteSchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
})

export const wasteRouter = Router()

wasteRouter.use(requireAuth)

wasteRouter.get('/', validateQuery(listWasteSchema), async (_req, res) => {
  res.json(await listWaste(getQuery<{ from?: string; to?: string; limit: number }>(res)))
})

wasteRouter.post('/', validateBody(createWasteSchema), async (req, res) => {
  res.status(201).json(await createWaste({ ...req.body, userId: getUser(res).id }))
})
