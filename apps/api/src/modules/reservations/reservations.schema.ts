import { z } from 'zod'

const tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus YYYY-MM-DD')
const jam = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Jam harus HH:MM')

/**
 * Tamu mengirim tanggal dan jam terpisah, bukan satu ISO datetime.
 *
 * Alasannya: yang dimaksud tamu adalah jam dinding kafe. Kalau browser yang
 * menyusun ISO-nya, orang yang memesan dari HP berzona WITA mengirim jam yang
 * bergeser satu jam tanpa merasa salah pilih.
 */
export const createReservationSchema = z.object({
  tanggal,
  jam,
  guestCount: z.number().int().positive('Jumlah tamu minimal satu').max(50),
  customerName: z.string().min(2, 'Nama terlalu pendek').max(60),
  phone: z
    .string()
    .min(8, 'Nomor HP terlalu pendek')
    .max(20)
    .regex(/^[0-9+\-\s]+$/, 'Nomor HP hanya boleh berisi angka'),
  note: z.string().max(200).optional(),
  /** Kosong berarti sistem yang memilihkan meja paling pas. */
  tableId: z.uuid('ID meja tidak valid').optional(),
})

export const availabilitySchema = z.object({
  tanggal,
  guestCount: z.coerce.number().int().positive().max(50).default(2),
})

export const listReservationsSchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'SEATED', 'DONE', 'CANCELLED', 'NO_SHOW'])
    .optional(),
  /** Tanggal kafe, bukan tanggal UTC. Kosong berarti semua. */
  tanggal: tanggal.optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
})

export const codeParamSchema = z.object({
  code: z.string().min(4).max(20),
})

export const idParamSchema = z.object({
  id: z.uuid('ID tidak valid'),
})

export const assignTableSchema = z.object({
  tableId: z.uuid('ID meja tidak valid'),
})

export const cancelSchema = z.object({
  reason: z.string().max(200).optional(),
})

export type CreateReservationInput = z.infer<typeof createReservationSchema>
export type AvailabilityInput = z.infer<typeof availabilitySchema>
export type ListReservationsInput = z.infer<typeof listReservationsSchema>
