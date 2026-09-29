import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth.js'
import {
  getParams,
  getQuery,
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validate.js'
import {
  assignTable,
  availability,
  createReservation,
  getReservationByCode,
  listReservations,
  setReservationStatus,
} from './reservations.service.js'
import {
  assignTableSchema,
  availabilitySchema,
  cancelSchema,
  codeParamSchema,
  createReservationSchema,
  idParamSchema,
  listReservationsSchema,
  type AvailabilityInput,
  type ListReservationsInput,
} from './reservations.schema.js'

/** Sisi tamu — tanpa login. */
export const publicReservationsRouter = Router()

publicReservationsRouter.get(
  '/availability',
  validateQuery(availabilitySchema),
  async (_req, res) => {
    res.json(await availability(getQuery<AvailabilityInput>(res)))
  },
)

publicReservationsRouter.post(
  '/',
  validateBody(createReservationSchema),
  async (req, res) => {
    res.status(201).json(await createReservation(req.body))
  },
)

/**
 * Status reservasi lewat kodenya.
 *
 * Dipasang paling bawah supaya "availability" tidak ikut tertangkap sebagai
 * kode reservasi.
 */
publicReservationsRouter.get('/:code', validateParams(codeParamSchema), async (_req, res) => {
  res.json(await getReservationByCode(getParams<{ code: string }>(res).code))
})

/** Sisi kafe — perlu login. */
export const adminReservationsRouter = Router()

adminReservationsRouter.use(requireAuth)

adminReservationsRouter.get('/', validateQuery(listReservationsSchema), async (_req, res) => {
  res.json(await listReservations(getQuery<ListReservationsInput>(res)))
})

adminReservationsRouter.post(
  '/:id/status',
  validateParams(idParamSchema),
  validateBody(
    z.object({
      status: z.enum(['CONFIRMED', 'SEATED', 'DONE', 'CANCELLED', 'NO_SHOW']),
      reason: z.string().max(200).optional(),
    }),
  ),
  async (req, res) => {
    res.json(
      await setReservationStatus(
        getParams<{ id: string }>(res).id,
        req.body.status,
        req.body.reason,
      ),
    )
  },
)

adminReservationsRouter.post(
  '/:id/cancel',
  validateParams(idParamSchema),
  validateBody(cancelSchema),
  async (req, res) => {
    res.json(
      await setReservationStatus(
        getParams<{ id: string }>(res).id,
        'CANCELLED',
        req.body.reason,
      ),
    )
  },
)

adminReservationsRouter.post(
  '/:id/table',
  validateParams(idParamSchema),
  validateBody(assignTableSchema),
  async (req, res) => {
    res.json(await assignTable(getParams<{ id: string }>(res).id, req.body.tableId))
  },
)
