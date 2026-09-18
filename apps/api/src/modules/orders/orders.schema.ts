import { z } from 'zod'

export const createOrderSchema = z.object({
  tableId: z.uuid('ID meja tidak valid').optional(),
  customerName: z.string().min(1).max(60).optional(),
  note: z.string().max(200).optional(),
  items: z
    .array(
      z.object({
        menuId: z.uuid('ID menu tidak valid'),
        qty: z.number().int().positive('Jumlah harus bilangan bulat positif').max(99),
        note: z.string().max(120).optional(),
      }),
    )
    .min(1, 'Pesanan harus berisi minimal satu menu'),
})

export const orderStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'DONE', 'CANCELLED']),
})

export const listOrdersSchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DONE', 'CANCELLED'])
    .optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
})

export const codeParamSchema = z.object({
  code: z.string().min(4).max(20),
})

export const idParamSchema = z.object({
  id: z.uuid('ID tidak valid'),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
