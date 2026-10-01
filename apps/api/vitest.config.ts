import { defineConfig } from 'vitest/config'

/**
 * Tes hanya dicari di `src`.
 *
 * Tanpa batasan ini, `npm run test` yang dijalankan setelah `npm run build`
 * ikut menjalankan hasil kompilasi di `dist/` — tesnya lolos semua, tapi
 * jumlahnya jadi dua kali lipat dan tidak ada yang sadar angkanya salah.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],

    // Tes integrasi punya confignya sendiri: ia butuh Postgres yang hidup dan
    // mengosongkan seluruh tabel. Tanpa dikecualikan di sini, `npm run test`
    // ikut memungutnya dan gagal di mesin yang tidak menyiapkan database.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.int.test.ts'],
  },
})
