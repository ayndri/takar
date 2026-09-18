import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { getQuery, validateQuery } from '../../middleware/validate.js'
import {
  inventoryValue,
  lowStock,
  menuMargins,
  salesSummary,
  usageTrend,
  wasteSummary,
} from './reports.service.js'

const rangeSchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
})

type Range = z.infer<typeof rangeSchema>

export const reportsRouter = Router()

reportsRouter.use(requireAuth)

// Stok menipis dipakai barista untuk kerja harian.
reportsRouter.get('/low-stock', async (_req, res) => {
  res.json(await lowStock())
})

// Sisanya menyangkut uang — hanya owner.
reportsRouter.use(requireRole('OWNER'))

reportsRouter.get('/inventory', async (_req, res) => {
  res.json(await inventoryValue())
})

reportsRouter.get('/waste', validateQuery(rangeSchema), async (_req, res) => {
  res.json(await wasteSummary(getQuery<Range>(res)))
})

reportsRouter.get('/sales', validateQuery(rangeSchema), async (_req, res) => {
  res.json(await salesSummary(getQuery<Range>(res)))
})

reportsRouter.get('/usage', validateQuery(rangeSchema), async (_req, res) => {
  res.json(await usageTrend(getQuery<Range>(res)))
})

reportsRouter.get('/margins', async (_req, res) => {
  res.json(await menuMargins())
})
