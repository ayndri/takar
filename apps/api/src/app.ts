import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { authRouter } from './modules/auth/auth.router.js'
import { ingredientsRouter } from './modules/ingredients/ingredients.router.js'
import { adminMenusRouter, publicMenusRouter } from './modules/menus/menus.router.js'
import { opnameRouter } from './modules/opname/opname.router.js'
import {
  adminOrdersRouter,
  orderStreamRouter,
  publicOrdersRouter,
} from './modules/orders/orders.router.js'
import { purchasesRouter } from './modules/purchases/purchases.router.js'
import { reportsRouter } from './modules/reports/reports.router.js'
import { tablesRouter } from './modules/tables/tables.router.js'
import { wasteRouter } from './modules/waste/waste.router.js'

/**
 * Dipisah dari server.ts supaya test bisa memakai instance ini
 * lewat supertest tanpa membuka port.
 */
export function createApp(): Express {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()) }))
  app.use(express.json({ limit: '1mb' }))

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
  }

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`select 1`
    res.json({ status: 'ok', env: env.NODE_ENV, time: new Date().toISOString() })
  })

  // ── publik: dipakai halaman pelanggan, tanpa login ──
  app.use('/api/menus', publicMenusRouter)
  app.use('/api/orders', publicOrdersRouter)
  app.use('/api/tables', tablesRouter)
  app.use('/api/stream/orders', orderStreamRouter)

  // ── perlu login ──
  app.use('/api/auth', authRouter)
  app.use('/api/ingredients', ingredientsRouter)
  app.use('/api/purchases', purchasesRouter)
  app.use('/api/waste', wasteRouter)
  app.use('/api/opname', opnameRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api/admin/menus', adminMenusRouter)
  app.use('/api/admin/orders', adminOrdersRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
