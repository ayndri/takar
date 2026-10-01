/**
 * Penjaga sebelum satu pun tes integrasi jalan.
 *
 * Tes ini mengosongkan seluruh tabel. Kalau alamatnya salah, yang hilang
 * adalah database yang sedang dipakai orang. Jadi dua hal diperiksa dulu,
 * dan keduanya menolak dengan keras alih-alih melewatkan tesnya diam-diam:
 * tes yang dilewati tanpa suara adalah tes yang berhenti berguna.
 */

const alamat = process.env.DATABASE_URL ?? ''

if (alamat === '') {
  throw new Error(
    [
      'DATABASE_URL_TEST belum diisi, jadi tes integrasi tidak tahu harus menyentuh database mana.',
      '',
      'Jalankan Postgres lokal lalu siapkan skemanya:',
      '  docker compose up -d',
      '  DATABASE_URL_TEST=postgresql://takar:takar@localhost:5432/takar_test \\',
      '    npm run db:push:test --workspace=apps/api',
      '',
      'Lalu jalankan tesnya dengan DATABASE_URL_TEST yang sama.',
    ].join('\n'),
  )
}

/**
 * Database yang dipakai ngoding sehari-hari tidak boleh jadi sasaran.
 *
 * Penyaringnya sengaja berdasarkan daftar yang diizinkan, bukan daftar yang
 * dilarang: menebak semua bentuk alamat produksi yang mungkin itu mustahil,
 * sedangkan "harus localhost, atau namanya mengandung test" mudah diperiksa
 * dan sulit ditembus tanpa sengaja.
 */
const lokal = /@(localhost|127\.0\.0\.1|postgres|host\.docker\.internal)[:/]/.test(alamat)
const bernamaUji = /test/i.test(alamat)

if (!lokal && !bernamaUji) {
  throw new Error(
    [
      'DATABASE_URL_TEST menunjuk ke database yang tidak terlihat seperti database uji.',
      '',
      'Tes integrasi MENGOSONGKAN SELURUH TABEL sebelum tiap berkas.',
      'Alamatnya harus localhost, atau namanya mengandung kata "test".',
      '',
      `Yang diberikan: ${alamat.replace(/:\/\/[^@]*@/, '://***@')}`,
    ].join('\n'),
  )
}
