import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Dipakai Prisma CLI saja (migrate, studio, db pull).
// Sengaja pakai DIRECT_URL: koneksi pooled tidak bisa menjalankan DDL.
// Runtime aplikasi pakai DATABASE_URL lewat adapter di src/lib/prisma.ts.
const directUrl = process.env.DIRECT_URL

if (!directUrl) {
  throw new Error('DIRECT_URL belum diisi di apps/api/.env')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: directUrl,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
