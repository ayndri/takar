import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { getParams, validateBody, validateParams } from '../../middleware/validate.js'
import { createPurchase, getPurchase, listPurchases } from './purchases.service.js'

const createPurchaseSchema = z.object({
  supplier: z.string().min(1, 'Nama supplier wajib diisi').max(100),
  date: z.iso.datetime().optional(),
  note: z.string().max(200).optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.uuid(),
        purchaseUnitId: z.uuid().optional(),
        qty: z.number().positive('Jumlah harus lebih dari nol'),
        unitPrice: z.number().nonnegative('Harga tidak boleh negatif'),
      }),
    )
    .min(1, 'Nota harus berisi minimal satu bahan'),
})

export const purchasesRouter = Router()

purchasesRouter.use(requireAuth)

purchasesRouter.get('/', async (_req, res) => {
  res.json(await listPurchases())
})

purchasesRouter.get('/:id', validateParams(z.object({ id: z.uuid() })), async (_req, res) => {
  res.json(await getPurchase(getParams<{ id: string }>(res).id))
})

purchasesRouter.post('/', validateBody(createPurchaseSchema), async (req, res) => {
  res.status(201).json(await createPurchase(req.body))
})
