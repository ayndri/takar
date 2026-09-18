import { z } from 'zod'

const recipeLineSchema = z.object({
  ingredientId: z.uuid('ingredientId harus UUID'),
  qty: z.number().positive('Takaran harus lebih dari nol'),
})

export const createMenuSchema = z.object({
  name: z.string().min(1, 'Nama menu wajib diisi').max(100),
  category: z.string().min(1, 'Kategori wajib diisi').max(50),
  price: z.number().nonnegative('Harga tidak boleh negatif'),
  imageUrl: z.url('URL gambar tidak valid').optional(),
  recipes: z.array(recipeLineSchema).min(1, 'Menu harus punya minimal satu bahan'),
})

export const updateMenuSchema = createMenuSchema
  .partial()
  .extend({
    imageUrl: z.url().nullable().optional(),
    isActive: z.boolean().optional(),
  })

export const idParamSchema = z.object({
  id: z.uuid('ID tidak valid'),
})
