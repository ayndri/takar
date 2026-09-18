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
| `paper` | `#FAF6F1` | latar halaman, kertas hangat, bukan putih steril |
| `surface` | `#FFFFFF` | kartu dan panel yang perlu naik selapis dari kertas |
| `sunk` | `#F3ECE4` | kolom kosong, tempat foto sebelum termuat |
| `ink` | `#241C17` | seluruh teks utama |
| `muted` | `#6F6259` | keterangan, kontras 5,5:1 di atas kertas |
| `accent` | `#B8472A` | satu-satunya aksen, warna biji kopi sangrai |
| `accent-ink` | `#8F331C` | teks di atas `accent-soft`, dan hover tombol |
| `forest` | `#2C5347` | dipakai persis sekali, di panel penjelasan stok |
| `warning` | `#8A5313` | penanda stok menipis |
| `danger` | `#A1231B` | kesalahan dan selisih negatif di dasbor |

Aksen hanya satu, dan dipakai hemat: tombol utama, penanda halaman aktif, dan
garis takaran. Warna kedua (`forest`) sengaja muncul di satu tempat saja supaya
panel itu terbaca sebagai penjelasan, bukan sebagai bagian menu.

Semua pasangan teks dan latar sudah dicek terhadap WCAG AA: `muted` di atas
kertas 5,5:1; putih di atas `accent` 5,3:1; `accent-ink` di atas `accent-soft`
6,7:1; `warning` di atas putih 6,3:1; teks panel di atas `forest` 6,3:1.

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

- `/` beranda: hero dengan pencarian, baris kategori, empat menu paling aman
  dipesan, lalu panel yang menjelaskan kenapa menu bisa hilang sendiri.
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

## Angka yang ditampilkan

Setiap angka di halaman toko berasal dari basis data: jumlah menu yang bisa
dibuat, sisa porsi, harga. Tidak ada statistik penghias, tidak ada testimoni,
tidak ada klaim yang tidak bisa ditelusuri ke satu baris di tabel.
