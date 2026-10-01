import { defineConfig } from 'vitest/config'

/**
 * Tes yang benar-benar menyentuh database.
 *
 * Dipisah dari tes unit karena sifatnya beda: butuh Postgres yang hidup,
 * jalannya puluhan kali lebih lambat, dan harus berurutan. `npm run test`
 * tetap cepat dan bisa dijalankan siapa pun tanpa menyiapkan apa pun.
 *
 * Alamat databasenya diambil dari DATABASE_URL_TEST, bukan DATABASE_URL.
 * Dua nama yang berbeda itu disengaja: tes ini mengosongkan seluruh tabel
 * sebelum tiap berkas, dan satu salah ketik tidak boleh cukup untuk
 * menghapus database yang sedang dipakai.
 */
const alamat = process.env.DATABASE_URL_TEST ?? ''

export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    setupFiles: ['src/test/setup.ts'],

    // Berurutan, satu berkas pada satu waktu. Tes ini berbagi satu database,
    // dan dua berkas yang mengosongkan tabel bersamaan akan saling merusak.
    fileParallelism: false,
    sequence: { concurrent: false },

    // Lebih longgar dari bawaan: beberapa tes sengaja menjalankan transaksi
    // yang saling menunggu kunci baris.
    testTimeout: 30_000,
    hookTimeout: 30_000,

    env: {
      DATABASE_URL: alamat,
      DIRECT_URL: alamat,
      JWT_SECRET: 'kunci-uji-yang-panjangnya-lebih-dari-tiga-puluh-dua',
      NODE_ENV: 'test',

      // Kunci palsu, tapi harus terisi: tanda tangan notifikasi dihitung
      // darinya, dan tes menghitung yang sama persis di sisinya sendiri.
      // Tidak ada permintaan yang benar-benar dikirim ke Midtrans.
      MIDTRANS_SERVER_KEY: 'SB-Mid-server-kunci-uji-bukan-punya-siapa-siapa',
      MIDTRANS_CLIENT_KEY: 'SB-Mid-client-kunci-uji',
      MIDTRANS_IS_PRODUCTION: 'false',
    },
  },
})
