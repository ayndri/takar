import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL wajib diisi'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET minimal 32 karakter'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  /**
   * Midtrans. Sengaja opsional: aplikasi harus tetap hidup penuh tanpa
   * pembayaran online. Kalau kuncinya kosong, fiturnya yang mati — bukan
   * seluruh API yang menolak menyala.
   */
  MIDTRANS_SERVER_KEY: z.string().default(''),
  MIDTRANS_CLIENT_KEY: z.string().default(''),
  MIDTRANS_IS_PRODUCTION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  // Mati sejak awal, bukan gagal diam-diam di request pertama.
  const detail = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n')
  throw new Error(`Konfigurasi env tidak valid:\n${detail}`)
}

export const env = parsed.data

/**
 * Apakah pembayaran online bisa dipakai sama sekali.
 *
 * Diperiksa terpisah dari sakelar di halaman pengaturan: yang ini soal
 * kuncinya ada atau tidak, yang itu soal kafe mau memakainya atau tidak.
 * Keduanya harus benar.
 */
export const midtransSiap =
  parsed.data.MIDTRANS_SERVER_KEY !== '' && parsed.data.MIDTRANS_CLIENT_KEY !== ''
