# Takar

Aplikasi kafe dengan dua sisi yang tersambung lewat resep.

Pelanggan memindai QR di meja, memilih menu, mengirim pesanan. Kafe
mengonfirmasi, dan di detik itu bahan baku dipotong dari gudang sesuai
takarannya.

🔗 **[Coba demonya](https://restaurant-web-two-theta.vercel.app)** ·
[Dasbor kafe](https://restaurant-web-two-theta.vercel.app/login)
(`owner@takar.test` / `takar1234`)

---

## Kenapa ini bukan CRUD inventory

Stoknya tidak disimpan sebagai angka. Yang disimpan riwayat pergerakannya
(`stock_movements`), dan stok adalah jumlahnya. Tabel itu append-only: tidak
pernah di-UPDATE, tidak pernah di-DELETE.

Pembatalan pesanan menulis baris baru yang berlawanan tanda. Stock opname
tidak menimpa angka sistem; selisihnya jadi pergerakan tersendiri. Jadi
pertanyaan "kenapa susu tinggal segini?" selalu bisa dijawab baris per baris.

Ada tabel `ingredient_stocks`, tapi itu cache. Ia ditulis di dalam transaksi
yang sama dengan pergerakannya, dan seeder memeriksa keduanya cocok sebelum
selesai.

### Tiga perebutan

Hampir semua yang menarik di sini berbentuk sama: dua pihak menginginkan
barang terakhir pada detik yang sama.

**Dua pesanan, satu cup terakhir.**

Cup tinggal dua. Dua kasir menekan konfirmasi bersamaan. Tanpa penjagaan,
keduanya membaca "tersisa 2" lalu sama-sama lolos, dan stok jadi minus.

Pemotongan terjadi di dalam satu transaksi yang mengunci baris stoknya dulu
dengan `SELECT ... FOR UPDATE`. Id bahannya diurutkan, karena kalau tidak,
transaksi A menunggu B sementara B menunggu A. Satu bahan kurang berarti
seluruh transaksi batal, dan tidak ada yang terpotong separuh.

**Dua tamu, satu meja jam tujuh malam.**

Barangnya beda, bentuknya sama. Reservasi memakai disiplin yang sama: baris
`tables` dikunci, dicek bentrok, baru disimpan. Saya uji dengan dua belas
permintaan bersamaan untuk kapasitas yang cuma muat dua meja. Tepat dua yang
lolos.

Cek bentroknya satu kondisi indeks biasa (`startAt < lawan.endAt AND endAt >
lawan.startAt`). Itu mungkin karena `endAt` ikut disimpan, tidak dihitung dari
durasi saat query. Mengubah durasi di pengaturan tidak boleh diam-diam
menggeser reservasi yang sudah dijanjikan ke tamu.

Bahan untuk pesanan yang menunggu konfirmasi ikut disisihkan, jadi pesanan
berikutnya tidak bisa menghabiskannya sambil yang pertama masih mengantre.
Penyisihan itu kedaluwarsa sendiri kalau kasir tidak kunjung menekan
konfirmasi.

**Uang sudah masuk, bahannya keburu habis.**

Pembayaran online membuat perebutan pertama punya korban. Yang diaktifkan cuma
cara bayar yang selesai dalam hitungan detik (QRIS, e-wallet, kartu), supaya
jedanya sependek mungkin. Tapi jeda tetap ada.

Kalau notifikasi pembayaran masuk dan bahannya tidak cukup, pembayarannya
tidak dianggap gagal. Uangnya memang sudah ada. Statusnya jadi
`REFUND_NEEDED` dan pesanannya muncul merah di papan kasir, supaya kafe tahu
ada orang yang harus diuruskan uangnya.

Midtrans mengirim ulang notifikasi kalau server lambat menjawab, jadi
penerapannya dijaga dua lapis.

Tes integrasi untuk bagian ini menemukan bug yang lolos dari pengujian
manual: dua notifikasi yang dikirim berurutan memang aman, tapi dua yang
benar-benar bersamaan memotong stok dua kali. Penyebabnya status pesanan
dibaca sebelum barisnya dikunci, jadi keduanya melihat PENDING. Sekarang
baris pesanannya ikut dikunci, bukan cuma baris stoknya.

---

## Isinya

Pelanggan dapat katalog yang mencari tanpa muat ulang halaman, menu yang
bahannya habis otomatis tertutup, keranjang dengan catatan per menu,
pelacakan pesanan, reservasi meja, dan pembayaran QRIS.

Kafe dapat papan dapur yang hidup lewat SSE, kartu stok tiap bahan, resep
dengan HPP dan marginnya, nota pembelian berbukti foto, catatan waste, stock
opname, QR meja siap cetak, papan reservasi, promo, dan laporan bergrafik
yang bisa diunduh sebagai Excel.

Angka uang cuma terlihat oleh `OWNER`. Barista mengelola pesanan tanpa melihat
margin.

Tiap fitur bisa dimatikan dari halaman pengaturan. Yang dimatikan hilang dari
navigasi dan endpoint-nya membalas 403, karena menyembunyikan tombol saja
tidak menutup alamatnya.

| Beranda pelanggan | Papan dapur | Laporan |
|---|---|---|
| ![Beranda dengan banner promo dan menu terlaris](docs/screenshots/beranda.png) | ![Papan kanban pesanan dapur](docs/screenshots/dapur.png) | ![Laporan dengan grafik omzet harian](docs/screenshots/laporan.png) |

---

## Stack

| Bagian | Pilihan |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, SWR, Recharts |
| Backend | Express 5 + TypeScript, validasi Zod |
| Database | PostgreSQL (Neon) + Prisma 7, driver adapter |
| Auth | JWT sendiri (`jsonwebtoken` + `bcryptjs`) |
| Realtime | SSE untuk papan dapur |
| Pembayaran | Midtrans Snap (sandbox) |
| Test | Vitest: 114 unit test, 22 tes integrasi terhadap Postgres sungguhan |

Monorepo npm workspaces: `apps/api` dan `apps/web`. 21 tabel, 6 migrasi.

### Beberapa pilihan yang perlu dijelaskan

Uang dan takaran memakai `Decimal`, tidak pernah `float`. 18 g dikali 3 harus
tepat 54, bukan 53,99999999, karena selisih sekecil itu menumpuk di ledger.

Bukti foto masuk ke kolom database, bukan folder server. Folder di penyedia
hosting hilang saat servernya diganti, dan bukti transaksi tidak boleh ikut
hilang. Kalau volumenya nanti berubah, titik gantinya ke object storage cuma
satu berkas.

Jam reservasi memakai jam dinding kafe (WIB), bukan jam server. Server
produksi jalan di UTC, jadi tanpa penanganan khusus "buka jam sembilan"
bergeser tujuh jam sendiri.

Pemberitahuan WhatsApp lewat tautan `wa.me`. Dasbor menyiapkan pesannya, admin
yang menekan kirim. Pustaka tidak resmi sengaja tidak dipakai: melanggar
ketentuan WhatsApp, dan nomornya bisa diblokir.

Tema terang saja. Alasannya di [`DESIGN.md`](DESIGN.md).

---

## Menjalankan sendiri

Butuh Node 20+ dan satu database PostgreSQL.

```bash
git clone https://github.com/ayndri/takar.git
cd takar
npm install

cp apps/api/.env.example apps/api/.env      # isi DATABASE_URL & DIRECT_URL
cp apps/web/.env.example apps/web/.env.local

npm run db:migrate --workspace=apps/api
npm run db:seed
```

Lalu di dua terminal:

```bash
npm run dev:api    # http://localhost:3001
npm run dev:web    # http://localhost:3000
```

Login: `owner@takar.test` (pemilik) atau `staff@takar.test` (barista), sandi
`takar1234`.

Data contohnya bukan tempelan. Seeder membangun riwayat 14 hari operasi yang
saling konsisten: 51 bahan, 96 menu di 10 kategori, belanja supplier,
penjualan, pembuangan, opname. Semuanya lewat jalur kode yang sama dengan
aplikasi sungguhan, lalu diperiksa bahwa cache stoknya cocok dengan jumlah
ledger.

Pembayaran online mati sampai kunci Midtrans diisi. Sisanya tetap jalan.

```bash
npm run test                             # 114 unit test, tanpa database
npx tsc --noEmit -p apps/api/tsconfig.json
npm run lint
```

Tes integrasi butuh Postgres yang hidup dan dijalankan terpisah, karena ia
mengosongkan seluruh tabel sebelum tiap berkas:

```bash
docker compose up -d

export DATABASE_URL_TEST=postgresql://takar:takar@localhost:5432/takar_test
DATABASE_URL=$DATABASE_URL_TEST DIRECT_URL=$DATABASE_URL_TEST   npm run db:migrate:test --workspace=apps/api

npm run test:int                         # 22 tes
```

Alamatnya dibaca dari `DATABASE_URL_TEST`, bukan `DATABASE_URL`, dan ditolak
kalau tidak terlihat seperti database uji. Satu salah ketik tidak boleh cukup
untuk mengosongkan database yang sedang dipakai.

---

## Peta kode

```
apps/api/src/
  modules/stock/stock-calculator.ts        hitungan stok murni, 32 test
  modules/stock/stock.service.ts           lockStocks, applyMovements
  modules/stock/stock-reservation.service.ts  penyisihan bahan & pelepasannya
  modules/orders/orders.service.ts         konfirmasi & potong stok
  modules/reservations/
    reservation-calculator.ts              jadwal & zona waktu, 31 test
    reservations.service.ts                lockTables, cek bentrok
  modules/payments/
    midtrans-notification.ts               verifikasi tanda tangan, 18 test
    payments.service.ts                    Snap, webhook, penanganan refund
  modules/menus/menu-pricing.ts            harga promo, 22 test
  lib/phone.ts                             nomor HP ke bentuk wa.me, 11 test
  middleware/feature.ts                    penolak 403 untuk modul yang mati
  test/fixtures.ts                         kafe kecil & pengosong db untuk tes integrasi

apps/web/src/
  app/(toko)/                              halaman pelanggan
  app/dashboard/                           halaman kafe
  components/ui/                           komponen bersama, grafik, rangka muat
  lib/use-table.ts                         cari, urut, halaman untuk tabel dasbor
```

Logika yang bisa berdiri sendiri dipisah dari database dan Express. Itu yang
diuji 114 kali, tanpa perlu menyiapkan apa pun.

---

## Yang belum ada

Multi-outlet. Skemanya sudah punya `TRANSFER_IN` dan `TRANSFER_OUT`, alurnya
belum.

Foto menu masih dari Unsplash.

Demonya memakai Midtrans sandbox, jadi tidak ada uang sungguhan yang
berpindah.
