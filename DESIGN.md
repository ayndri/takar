# Arahan desain Takar

Dokumen ini mencatat keputusan visual beserta alasannya, supaya perubahan
berikutnya tidak menebak-nebak maksud yang sudah diputuskan.

## Siapa yang memakai

Dua orang yang sangat berbeda, di perangkat yang berbeda:

- **Pelanggan** membuka halaman toko dari HP, sambil duduk di meja, kadang
  dengan satu tangan memegang gelas. Dia belum pernah melihat aplikasi ini
  sebelumnya dan tidak akan membaca petunjuk.
- **Barista dan pemilik** membuka dasbor dari laptop atau tablet, berulang kali
  dalam sehari, dan hafal letak tombolnya setelah hari pertama.

Karena itu sisi toko dibuat lapang dan besar, sedangkan dasbor padat dan rapat:
yang satu dipakai sekali, yang satu dipakai ratusan kali.

## Tema

Terang saja, tanpa pilihan gelap.

Alasannya bukan selera: aplikasi ini dipakai di ruang kafe yang terang, dan
identitasnya bertumpu pada warna kertas hangat yang berubah jadi abu kotor
begitu dipaksa ke mode gelap. Menyediakan toggle berarti merawat dua tampilan
yang hanya satu di antaranya benar-benar dipakai.

## Warna

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `paper` | `#FFFFFF` | latar halaman |
| `surface` | `#FFFFFF` | kartu dan panel |
| `sunk` | `#F4F4F5` | kolom kosong, tempat foto sebelum termuat |
| `border` | `#E8E6E3` | pembatas kartu |
| `ink` | `#1C1917` | seluruh teks utama |
| `muted` | `#6B6560` | keterangan, kontras 5,7:1 di atas putih |
| `accent` | `#C63E23` | satu-satunya aksen, merah bata |
| `accent-ink` | `#9C2F19` | teks di atas `accent-soft`, dan hover tombol |
| `forest` | `#23554A` | dipakai persis sekali, di panel penjelasan stok |
| `warning` | `#8A5313` | penanda stok menipis |
| `danger` | `#A1231B` | kesalahan dan selisih negatif di dasbor |

Latar dan kartu sama-sama putih, jadi yang memisahkan keduanya adalah garis
tipis, bukan bayangan. Bayangan disimpan untuk elemen yang memang mengambang
di atas halaman, seperti bar keranjang. Kalau semua kartu diberi bayangan,
halaman jadi terasa melayang dan tidak ada yang menonjol.

Aksen hanya satu, dan dipakai hemat: tombol utama, penanda halaman aktif, dan
garis takaran. Warna kedua (`forest`) sengaja muncul di satu tempat saja supaya
panel itu terbaca sebagai penjelasan, bukan sebagai bagian menu.

Semua pasangan teks dan latar sudah dicek terhadap WCAG AA: `muted` di atas
putih 5,7:1; putih di atas `accent` 5,1:1; `accent-ink` di atas `accent-soft`
6,6:1; `warning` di atas putih 6,3:1; teks panel di atas `forest` 8,6:1.

## Kartu kategori

Tingginya dikunci di 112px dan labelnya dibatasi dua baris. Tanpa itu, nama
panjang seperti "Jus & Smoothie" membuat kartunya lebih tinggi dari tetangganya
dan barisnya terlihat bergelombang. Jumlah menu per kategori sengaja tidak
ditulis di kartu: angka itu sudah muncul di halaman katalog, dan di sini cuma
menambah baris ketiga yang bikin susunannya ramai.

## Huruf

- **Fraunces** untuk judul. Serif dengan sudut yang sedikit melunak, mirip papan
  menu tulis tangan. Dipakai hanya pada judul dan angka besar, supaya kesan
  "tempat makan" datang dari huruf, bukan dari hiasan.
- **Plus Jakarta Sans** untuk teks. Dirancang untuk bahasa Indonesia, jadi
  rangkaian huruf yang sering muncul di sini ("ng", "ny", "yang") tetap enak
  dibaca pada ukuran kecil di layar HP.

Tidak ada huruf monospace kecuali untuk kode pesanan, karena di sana yang
penting justru tiap karakter terbaca satu per satu saat dibacakan ke kasir.

## Motif

Garis takaran, seperti pada gelas ukur. Delapan batang dengan tinggi menanjak,
yang menyala sebanyak sisa porsi. Muncul di kartu menu dan halaman detail.

Ini bukan hiasan: nama produk berarti "menakar", dan motif ini membuat sisa
stok bisa dibaca sekilas tanpa harus membaca angka.

## Susunan halaman

- `/` beranda, dari atas ke bawah:
  1. **Header** berisi pemilih meja, kolom pencarian, navigasi, dan keranjang.
     Pemilih meja menggantikan "antar ke alamat" pada aplikasi pesan-antar,
     karena di kafe yang menentukan tujuan adalah nomor mejanya.
  2. **Hero** dengan foto memenuhi seluruh blok, ditumpuk lapisan warna kertas
     yang memudar dari kiri ke kanan. Teks tetap hitam di atas dasar terang,
     jadi kontrasnya tidak bergantung pada isi foto yang sewaktu-waktu diganti.
     Di dalamnya ada satu kotak berisi pemilih meja dan kolom pencarian.
  3. **Baris kategori** berbentuk kartu bulat yang bisa digeser. Urutannya
     ditentukan di `lib/kategori.ts`, bukan abjad: ini kafe kopi, jadi minuman
     didahulukan, lalu sarapan, makanan berat, camilan, dan penutup.
  4. **Paling laku minggu ini**: tiga kartu, lalu satu panel hijau di kolom
     keempat. Panel itu menempati posisi yang biasanya diisi spanduk diskon,
     tapi isinya keadaan stok hari ini, bukan promo yang dikarang.
  5. **Bar status pesanan** yang hanya muncul kalau perangkat ini memang punya
     pesanan berjalan.
  6. **Menu unggulan** berukuran besar di kiri dengan pemilih jumlah, dan grid
     pendamping di kanan.
  7. **Lima janji layanan** dengan ikon gambar sendiri, semuanya hal yang
     benar-benar dilakukan aplikasi ini.
- `/menu` katalog lengkap dengan pencarian dan saringan kategori.
- `/menu/[id]` detail satu menu: foto, harga, sisa porsi, daftar bahan, dan
  pemilih jumlah.
- `/pesanan` dan `/pesanan/[code]` untuk melacak pesanan.
- `/dashboard/*` sisi kafe.

Beranda sengaja **tidak** langsung menjadi daftar menu panjang. Pelanggan yang
baru duduk butuh tahu dulu ada apa saja di sini, baru memilih.

## Foto

Foto menu saat ini diambil dari Unsplash dan disimpan di kolom `imageUrl`,
bukan ditulis di kode. Ini penempatan sementara sampai kafe punya foto sendiri:
ganti isinya lewat data, tampilan tidak perlu disentuh.

## Gerak

Sangat sedikit, dan hanya sebagai respons terhadap tindakan: foto sedikit
membesar saat kartu disentuh, tombol berubah gelap saat ditekan. Tidak ada
animasi yang jalan sendiri saat halaman digulir, karena halaman ini dibuka
untuk memesan minuman, bukan untuk ditonton.

## Ikon

Digambar sendiri sebagai SVG di `components/icons.tsx`, bukan diambil dari
pustaka ikon umum. Tiap bentuk menunjuk sesuatu yang memang ada di aplikasi:
gelas takar, kode QR meja, mesin kasir, catatan pesanan, jam. Tidak ada bentuk
hiasan seperti kilau atau bintang yang tidak mewakili apa pun.

## Angka yang ditampilkan

Setiap angka di halaman toko berasal dari basis data: jumlah menu yang bisa
dibuat, sisa porsi, harga. Tidak ada statistik penghias, tidak ada testimoni,
tidak ada klaim yang tidak bisa ditelusuri ke satu baris di tabel.
