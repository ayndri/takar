import { Router } from 'express'
import { z } from 'zod'
import { getUser, requireAuth, requireRole } from '../../middleware/auth.js'
import { getQuery, validateQuery } from '../../middleware/validate.js'
import { buatLaporanExcel } from './reports.export.js'
import {
  dashboardSummary,
  inventoryValue,
  lowStock,
  menuMargins,
  salesSummary,
  salesTrend,
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

// Ringkasan dasbor: isinya menyesuaikan peran yang membuka.
reportsRouter.get('/dashboard', async (_req, res) => {
  res.json(await dashboardSummary(getUser(res).role === 'OWNER'))
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

reportsRouter.get('/sales-trend', validateQuery(rangeSchema), async (_req, res) => {
  res.json(await salesTrend(getQuery<{ from?: string; to?: string }>(res)))
})

reportsRouter.get('/usage', validateQuery(rangeSchema), async (_req, res) => {
  res.json(await usageTrend(getQuery<Range>(res)))
})

/**
 * Seluruh laporan dalam satu berkas Excel.
 *
 * Dibangun di memori lalu dikirim langsung; tidak ada berkas sementara yang
 * ditulis ke disk. Penyedia hosting serverless tidak punya disk yang bertahan
 * antar permintaan, dan laporan kafe ukurannya puluhan kilobita.
 */
reportsRouter.get('/export', validateQuery(rangeSchema), async (_req, res) => {
  const { buffer, nama } = await buatLaporanExcel(
    getQuery<{ from?: string; to?: string }>(res),
  )

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  res.setHeader('Content-Disposition', `attachment; filename="${nama}"`)
  // Dibuka lintas asal lewat fetch, jadi namanya harus boleh dibaca browser.
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')

  res.send(buffer)
})

reportsRouter.get('/margins', async (_req, res) => {
  res.json(await menuMargins())
})
