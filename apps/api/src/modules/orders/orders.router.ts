import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import { getParams, getQuery, validateBody, validateParams, validateQuery } from '../../middleware/validate.js'
import { orderEvents } from './orders.events.js'
import {
  advanceStatus,
  cancelOrder,
  confirmOrder,
  createOrder,
  getOrderByCode,
  listOrders,
} from './orders.service.js'
import {
  codeParamSchema,
  createOrderSchema,
  idParamSchema,
  listOrdersSchema,
} from './orders.schema.js'

/** Sisi pelanggan — tanpa login. */
export const publicOrdersRouter = Router()

publicOrdersRouter.post('/', validateBody(createOrderSchema), async (req, res) => {
  res.status(201).json(await createOrder(req.body))
})

publicOrdersRouter.get('/:code', validateParams(codeParamSchema), async (_req, res) => {
  res.json(await getOrderByCode(getParams<{ code: string }>(res).code))
})

/** Sisi kafe — perlu login. */
export const adminOrdersRouter = Router()

adminOrdersRouter.use(requireAuth)

adminOrdersRouter.get('/', validateQuery(listOrdersSchema), async (_req, res) => {
  res.json(await listOrders(getQuery<{ status?: string; limit: number }>(res)))
})

adminOrdersRouter.post('/:id/confirm', validateParams(idParamSchema), async (_req, res) => {
  res.json(await confirmOrder(getParams<{ id: string }>(res).id))
})

adminOrdersRouter.post(
  '/:id/status',
  validateParams(idParamSchema),
  validateBody(z.object({ status: z.enum(['PREPARING', 'READY', 'DONE']) })),
  async (req, res) => {
    res.json(await advanceStatus(getParams<{ id: string }>(res).id, req.body.status))
  },
)

adminOrdersRouter.post(
  '/:id/cancel',
  validateParams(idParamSchema),
  validateBody(z.object({ reason: z.string().max(200).optional() })),
  async (req, res) => {
    res.json(await cancelOrder(getParams<{ id: string }>(res).id, req.body.reason))
  },
)

/**
 * Aliran perubahan pesanan untuk layar dapur.
 *
 * Sengaja tidak pakai requireAuth: EventSource di browser tidak bisa mengirim
 * header Authorization. Yang dikirim hanya sinyal "ada yang berubah" tanpa isi
 * pesanan, jadi klien tetap harus memanggil endpoint ber-token untuk datanya.
 */
export const orderStreamRouter = Router()

orderStreamRouter.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })

  res.write('event: ready\ndata: {}\n\n')

  const onChange = (payload: unknown) => {
    res.write(`event: changed\ndata: ${JSON.stringify(payload)}\n\n`)
  }

  orderEvents.on('changed', onChange)

  // Proxy (Railway, Nginx) memutus koneksi yang diam terlalu lama.
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000)

  req.on('close', () => {
    clearInterval(ping)
    orderEvents.off('changed', onChange)
  })
})
