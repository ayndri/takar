import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'

const app = createApp()

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
