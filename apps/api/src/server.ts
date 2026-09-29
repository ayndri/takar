import app from './app.js'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'

/**
 * Berkas ini cuma dipakai saat aplikasinya dijalankan sebagai program:
 * di mesin sendiri, dan di hosting yang menjalankan proses (Railway, Render).
 *
 * Hosting serverless tidak lewat sini sama sekali — yang diimpornya app.ts,
 * dan ekspor default di sana yang dipanggil tiap ada permintaan.
 */

const server = app.listen(env.PORT, () => {
  console.log(`API jalan di http://localhost:${env.PORT} (${env.NODE_ENV})`)
})

// Railway/Render mengirim SIGTERM saat redeploy — tutup koneksi dengan rapi
// supaya transaksi yang sedang jalan tidak terputus di tengah.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} diterima, menutup server...`)
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  })
}
