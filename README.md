# Takar

**Aplikasi kafe dengan dua sisi yang tersambung lewat satu hal: resep.**

Pelanggan memindai QR di meja, memilih menu, dan mengirim pesanan. Kafe
mengonfirmasi — dan di detik itu bahan baku dipotong dari gudang sesuai takaran
resepnya.

🔗 **[Coba demonya](https://restaurant-web-two-theta.vercel.app)** ·
[Dasbor kafe](https://restaurant-web-two-theta.vercel.app/login) (`owner@takar.test` / `takar1234`)

---

## Yang membedakannya dari CRUD inventory

**Stok bukan satu kolom angka.** Stok adalah hasil penjumlahan riwayat
pergerakan (`stock_movements`, append-only — tidak pernah di-UPDATE, tidak
pernah di-DELETE). Pembatalan pesanan tidak menghapus apa pun; ia menulis baris
baru yang berlawanan tanda. Stock opname tidak menimpa angka sistem; selisihnya
jadi pergerakan tersendiri yang bisa ditelusuri.

Akibatnya, pertanyaan "kenapa stok susu tinggal segini?" selalu punya jawaban
yang bisa dibaca baris per baris — bukan satu angka yang entah kenapa berubah.

Tabel `ingredient_stocks` ada, tapi cuma cache. Ia selalu ditulis di dalam
transaksi yang sama dengan pergerakannya, dan seeder memeriksa keduanya cocok
sebelum selesai.

### Tiga masalah yang sebenarnya dipecahkan

**1. Dua pesanan yang masuk bersamaan.**

Cup tinggal dua. Dua kasir menekan konfirmasi pada detik yang sama. Tanpa
penjagaan, keduanya membaca "tersisa 2" lalu sama-sama lolos, dan stok jadi
minus.

Pemotongan stok terjadi di dalam satu transaksi yang mengunci baris stok lebih
dulu dengan `SELECT ... FOR UPDATE`, dengan id bahan **diurutkan** — kalau
tidak, transaksi A menunggu B sementara B menunggu A. Kalau salah satu bahan
tidak cukup, seluruh transaksi dibatalkan dan tidak ada satu pun bahan yang
terpotong sebagian.

**2. Dua tamu yang memesan meja yang sama.**

Masalah yang sama bentuknya, barang yang berbeda. Reservasi meja memakai
disiplin yang sama persis: baris `tables` dikunci, dicek bentrok, baru disimpan.
Diuji dengan dua belas permintaan bersamaan untuk kapasitas yang cuma muat dua
meja — tepat dua yang lolos.

Cek bentroknya satu kondisi indeks biasa (`startAt < lawan.endAt AND endAt >
lawan.startAt`), karena `endAt` disimpan alih-alih dihitung dari durasi saat
query. Mengubah durasi di pengaturan tidak boleh diam-diam menggeser reservasi
yang sudah terlanjur dijanjikan ke tamu.

**3. Uang sudah masuk tapi bahannya keburu habis.**

Pembayaran online membuat masalah nomor 1 jadi punya korban yang jelas. Yang
diaktifkan cuma cara bayar yang selesai dalam hitungan detik (QRIS, e-wallet,
kartu) supaya jedanya sependek mungkin — tapi jeda tetaplah jeda.

Kalau notifikasi pembayaran masuk dan bahannya ternyata tidak cukup,
pembayarannya **tidak** dianggap gagal (uangnya memang sudah ada) dan
pesanannya **tidak** dibiarkan hilang. Statusnya jadi `REFUND_NEEDED` dan
muncul merah di papan kasir. Lebih baik kafe tahu ada satu orang yang harus
diuruskan uangnya daripada satu pesanan lenyap tanpa jejak.

Midtrans mengirim ulang notifikasi kalau server lambat menjawab, jadi
penerapannya dijaga dua lapis — diuji dengan mengirim notifikasi yang sama dua
kali: stok terpotong tepat sekali.

---

## Isinya

**Sisi pelanggan** — katalog dengan pencarian tanpa muat ulang halaman, menu
yang bahannya habis otomatis tertutup, keranjang dengan catatan per menu,
pelacakan pesanan, reservasi meja, dan pembayaran QRIS/e-wallet.

**Sisi kafe** — papan pesanan dapur yang hidup lewat SSE, bahan baku dan kartu
stoknya, menu & resep lengkap dengan HPP dan margin, nota pembelian berbukti
foto, catatan waste, stock opname, meja & QR siap cetak, papan reservasi, promo
& pengumuman, dan laporan bergrafik.

Angka uang hanya terlihat oleh peran `OWNER`. Barista bisa mengelola pesanan
tanpa melihat margin.

**Semua fitur bisa dimatikan** dari satu halaman pengaturan. Yang dimatikan
hilang dari navigasi **dan** endpoint-nya membalas 403 — menyembunyikan tombol
saja tidak cukup, alamatnya tetap bisa dipanggil langsung.

<!--
Tangkapan layar — taruh berkasnya di docs/screenshots/, lalu hapus tanda
komentar ini:

| Beranda | Papan dapur | Laporan |
|---|---|---|
| ![](docs/screenshots/beranda.png) | ![](docs/screenshots/dapur.png) | ![](docs/screenshots/laporan.png) |
-->

---

## Stack

| Bagian | Pilihan |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, SWR, Recharts |
| Backend | Express 5 + TypeScript, validasi Zod |
| Database | PostgreSQL (Neon) + Prisma 7, driver adapter |
| Auth | JWT sendiri (`jsonwebtoken` + `bcryptjs`) |
| Realtime | SSE untuk papan pesanan dapur |
| Pembayaran | Midtrans Snap (sandbox) |
| Test | Vitest, 108 unit test |

Monorepo npm workspaces: `apps/api` dan `apps/web`. 20 tabel, 5 migrasi.

### Keputusan yang mungkin terlihat aneh, dan alasannya

- **Uang dan takaran selalu `Decimal`, tidak pernah `float`.** 18 g × 3 harus
  tepat 54, bukan 53,99999999 — selisih sekecil itu menumpuk di ledger.
- **Bukti foto disimpan di kolom database**, bukan folder server. Folder di
  penyedia hosting hilang saat server diganti, dan bukti transaksi tidak boleh
  ikut hilang. Titik gantinya ke object storage cuma satu berkas kalau nanti
  volumenya berubah.
- **Jam reservasi selalu jam dinding kafe (WIB), bukan jam server.** Server
  produksi jalan di UTC; tanpa penanganan khusus, "buka jam sembilan" bergeser
  tujuh jam tanpa ada yang mengubah apa pun.
- **Pemberitahuan WhatsApp lewat tautan `wa.me`, bukan Business API.** Dasbor
  menyiapkan pesannya, admin yang menekan kirim. Pustaka tidak resmi sengaja
  tidak dipakai — melanggar ketentuan WhatsApp dan nomornya bisa diblokir.
- **Tema terang saja.** Alasannya ada di [`DESIGN.md`](DESIGN.md).

---

## Menjalankan di komputer sendiri

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

Login dasbor: `owner@takar.test` / `takar1234` (pemilik) atau
`staff@takar.test` / `takar1234` (barista).

**Data contohnya bukan tempelan.** Seeder membangun riwayat 14 hari operasi
kafe yang saling konsisten: 51 bahan, 96 menu berfoto di 10 kategori, belanja
dari supplier, penjualan, pembuangan, dan stock opname — semuanya lewat jalur
kode yang sama dengan aplikasi sungguhan, lalu diperiksa bahwa cache stok cocok
dengan jumlah ledger-nya.

Pembayaran online mati sampai kunci Midtrans diisi; sisa aplikasi tetap jalan
penuh tanpanya.

```bash
npm run test                             # 108 unit test
npx tsc --noEmit -p apps/api/tsconfig.json
npm run lint
```

---

## Peta kode

```
apps/api/src/
  modules/stock/stock-calculator.ts        hitungan stok murni, 26 test
  modules/stock/stock.service.ts           lockStocks, applyMovements
  modules/orders/orders.service.ts         konfirmasi & potong stok — inti project
  modules/reservations/
    reservation-calculator.ts              jadwal & zona waktu, 31 test
    reservations.service.ts                lockTables, cek bentrok
  modules/payments/
    midtrans-notification.ts               verifikasi tanda tangan, 18 test
    payments.service.ts                    Snap, webhook, penanganan refund
  modules/menus/menu-pricing.ts            harga promo, 22 test
  lib/phone.ts                             nomor HP → bentuk wa.me, 11 test
  middleware/feature.ts                    penolak 403 untuk modul yang mati

apps/web/src/
  app/(toko)/                              halaman pelanggan
  app/dashboard/                           halaman kafe
  components/ui/                           komponen bersama + grafik + rangka muat
  lib/use-table.ts                         cari + urut + halaman untuk tabel dasbor
```

Logika yang berdiri sendiri sengaja dipisah dari database dan Express supaya
bisa diuji tanpa menyiapkan apa pun — itu yang dites 108 kali.

---

## Yang belum ada

Jujur saja, supaya tidak perlu ditebak:

- Integration test untuk alur pesanan (unit test sudah; yang menyentuh database
  belum).
- Reservasi stok saat pesanan dibuat. Belum mendesak karena pembayaran dibatasi
  ke metode yang selesai dalam hitungan detik; jadi mendesak begitu virtual
  account diaktifkan.
- Multi-outlet. Skema `stock_movements` sudah punya `TRANSFER_IN`/`TRANSFER_OUT`
  tapi alurnya belum dibangun.
- Export laporan ke PDF/Excel.
- Foto menu masih dari Unsplash.

Demo memakai Midtrans **sandbox** — tidak ada uang sungguhan yang berpindah.
