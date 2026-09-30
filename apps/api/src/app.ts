import cors from 'cors'
import express, { type Express, type RequestHandler } from 'express'
import helmetModule, { type HelmetOptions } from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { requireFeature } from './middleware/feature.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { attachmentsRouter } from './modules/attachments/attachments.router.js'
import {
  adminAnnouncementsRouter,
  publicAnnouncementsRouter,
} from './modules/announcements/announcements.router.js'
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
import {
  adminReservationsRouter,
  publicReservationsRouter,
} from './modules/reservations/reservations.router.js'
import { reportsRouter } from './modules/reports/reports.router.js'
import { publicSettingsRouter, settingsRouter } from './modules/settings/settings.router.js'
import { adminTablesRouter, tablesRouter } from './modules/tables/tables.router.js'
import { wasteRouter } from './modules/waste/waste.router.js'

/**
 * helmet menaruh sintaks ESM (`export { helmet as default }`) di dalam berkas
 * tipe CJS-nya, tanpa `export =` sama sekali. Akibatnya bentuk yang diterima
 * TypeScript berbeda tergantung jalur mana yang dipilih saat menyelesaikan
 * paketnya: lewat `import` yang didapat fungsinya, lewat `require` yang
 * didapat seluruh namespace-nya.
 *
 * Di laptop yang terpilih jalur `import`, di sebagian lingkungan build yang
 * terpilih `require` — dan di situ `helmet()` gagal dikompilasi dengan pesan
 * "has no call signatures". Bedanya baru muncul saat deploy, jadi diambil
 * saja mana pun yang tersedia.
 */
const helmet = ((helmetModule as unknown as { default?: unknown }).default ??
  helmetModule) as (options?: HelmetOptions) => RequestHandler

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
  //
  // requireFeature dipasang di sini, bukan di dalam tiap router, supaya tidak
  // ada endpoint yang kelewat saat nanti ada yang ditambahkan. Menyembunyikan
  // menunya di frontend saja tidak cukup — alamatnya tetap bisa dipanggil.
  app.use('/api/menus', publicMenusRouter)
  app.use('/api/orders', publicOrdersRouter)
  app.use('/api/tables', requireFeature('modul.meja'), tablesRouter)
  app.use('/api/reservations', requireFeature('modul.reservasi'), publicReservationsRouter)
  app.use('/api/settings/public', publicSettingsRouter)
  app.use('/api/announcements', requireFeature('modul.promo'), publicAnnouncementsRouter)
  app.use('/api/stream/orders', orderStreamRouter)

  // ── perlu login ──
  app.use('/api/auth', authRouter)
  app.use('/api/attachments', attachmentsRouter)
  app.use('/api/ingredients', ingredientsRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/purchases', requireFeature('modul.pembelian'), purchasesRouter)
  app.use('/api/waste', requireFeature('modul.waste'), wasteRouter)
  app.use('/api/opname', requireFeature('modul.opname'), opnameRouter)
  app.use('/api/reports', requireFeature('modul.laporan'), reportsRouter)
  app.use('/api/admin/menus', adminMenusRouter)
  app.use('/api/admin/orders', adminOrdersRouter)
  app.use('/api/admin/tables', requireFeature('modul.meja'), adminTablesRouter)
  app.use(
    '/api/admin/announcements',
    requireFeature('modul.promo'),
    adminAnnouncementsRouter,
  )
  app.use(
    '/api/admin/reservations',
    requireFeature('modul.reservasi'),
    adminReservationsRouter,
  )

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

/**
 * Instance siap pakai, diekspor sebagai default.
 *
 * Hosting serverless mengimpor modul ini lalu memanggil ekspor default-nya
 * dengan (req, res) — tidak ada port yang dibuka dan tidak ada yang memanggil
 * createApp() untuknya. Aplikasi Express kebetulan sudah berbentuk fungsi
 * (req, res), jadi cukup diekspor apa adanya.
 *
 * createApp() tetap diekspor terpisah supaya test bisa membuat instance
 * sendiri yang bersih lewat supertest, tanpa ikut memakai yang ini.
 */
const app = createApp()

export default app
