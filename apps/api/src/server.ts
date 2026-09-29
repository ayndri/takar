import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'

const app = createApp()

/**
 * Dua cara berkas ini dijalankan, dan keduanya harus didukung.
 *
 * Di mesin sendiri dan di hosting yang menjalankan proses (Railway, Render),
 * berkas ini dijalankan sebagai program: port dibuka, server hidup terus.
 *
 * Di hosting serverless, berkas ini cuma diimpor lalu ekspor default-nya
 * dipanggil dengan (req, res) tiap ada permintaan — tidak ada port yang
 * ditunggu. Aplikasi Express kebetulan sudah berbentuk fungsi (req, res),
 * jadi cukup diekspor apa adanya. Tanpa baris ini, permintaannya sampai ke
 * modul yang tidak menawarkan apa pun untuk dipanggil, dan yang terlihat dari
 * luar cuma 500 tanpa penjelasan.
 */
export default app

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
