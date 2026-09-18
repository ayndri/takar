import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { getParams, validateBody, validateParams } from '../../middleware/validate.js'
import { createIngredient, getStockCard, listIngredients } from './ingredients.service.js'

const idParamSchema = z.object({ id: z.uuid('ID tidak valid') })

const createIngredientSchema = z.object({
  name: z.string().min(1, 'Nama bahan wajib diisi').max(100),
  baseUnit: z.enum(['G', 'ML', 'PCS']),
  minStock: z.number().nonnegative().optional(),
  purchaseUnits: z
    .array(
      z.object({
        name: z.string().min(1).max(30),
        factor: z.number().positive('Faktor konversi harus lebih dari nol'),
      }),
    )
    .optional(),
})

export const ingredientsRouter = Router()

// Staff boleh melihat stok (perlu untuk kerja harian);
// yang dibatasi ke owner nanti adalah laporan margin.
ingredientsRouter.use(requireAuth)

ingredientsRouter.get('/', async (_req, res) => {
  res.json(await listIngredients())
})

ingredientsRouter.get('/:id/card', validateParams(idParamSchema), async (_req, res) => {
  res.json(await getStockCard(getParams<{ id: string }>(res).id))
})

ingredientsRouter.post('/', validateBody(createIngredientSchema), async (req, res) => {
  res.status(201).json(await createIngredient(req.body))
})
