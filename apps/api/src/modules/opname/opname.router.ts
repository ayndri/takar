import { Router } from 'express'
import { z } from 'zod'
import { getUser, requireAuth } from '../../middleware/auth.js'
import { getParams, validateBody, validateParams } from '../../middleware/validate.js'
import { createOpname, getOpname, listOpnames } from './opname.service.js'

const createOpnameSchema = z.object({
  note: z.string().max(200).optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.uuid(),
        physicalQty: z.number().nonnegative('Hasil hitung fisik tidak boleh negatif'),
      }),
    )
    .min(1, 'Opname harus berisi minimal satu bahan'),
})

export const opnameRouter = Router()

opnameRouter.use(requireAuth)

opnameRouter.get('/', async (_req, res) => {
  res.json(await listOpnames())
})

opnameRouter.get('/:id', validateParams(z.object({ id: z.uuid() })), async (_req, res) => {
  res.json(await getOpname(getParams<{ id: string }>(res).id))
})

opnameRouter.post('/', validateBody(createOpnameSchema), async (req, res) => {
  res.status(201).json(await createOpname({ ...req.body, userId: getUser(res).id }))
})
