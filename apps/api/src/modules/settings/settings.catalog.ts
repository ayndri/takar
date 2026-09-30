/**
 * Daftar pengaturan yang dikenal aplikasi.
 *
 * Ini sumber kebenarannya, bukan tabel `settings`. Tabel itu cuma menyimpan
 * nilai yang sudah pernah diubah. Alasannya: menambah pengaturan baru jadi
 * satu baris di berkas ini tanpa migrasi, dan pemasangan baru langsung jalan
 * walau tabelnya kosong.
 *
 * Nilai di database selalu teks. `tipe` yang menentukan cara membacanya.
 */

import { nomorWhatsapp } from '../../lib/phone.js'

export type SettingTipe = 'boolean' | 'angka' | 'jam' | 'teks'
export type SettingGrup = 'modul' | 'toko' | 'reservasi'

export type SettingDef = {
  kunci: string
  grup: SettingGrup
  tipe: SettingTipe
  /** Selalu teks, supaya sebentuk dengan yang tersimpan di database. */
  bawaan: string
  label: string
  /** Kalimat yang dibaca pemilik di halaman pengaturan. */
  keterangan: string
  /**
   * Pengaturan ini tidak berlaku kalau kunci yang disebut di sini mati.
   * Cuma satu tingkat — tidak ada rantai, dan memang tidak perlu.
   */
  butuh?: string
  /** Hanya untuk tipe 'angka'. */
  min?: number
  maks?: number
  /** Ikut dikirim ke halaman pelanggan yang tanpa login. */
  publik?: boolean
  /**
   * Hanya untuk tipe 'teks'. Merapikan sekaligus memeriksa nilai yang masuk,
   * dan melempar kalau tidak sah. Dipakai supaya yang tersimpan sudah berupa
   * satu bentuk baku, bukan apa saja yang sempat diketik.
   */
  rapikan?: (nilai: string) => string
  /** Contoh isian di halaman pengaturan. Hanya untuk tipe 'teks'. */
  contoh?: string
}

export const SETTINGS: readonly SettingDef[] = [
  // ── modul dasbor yang boleh dimatikan ──
  {
    kunci: 'modul.pembelian',
    grup: 'modul',
    tipe: 'boolean',
    bawaan: 'true',
    label: 'Pembelian',
    keterangan:
      'Nota belanja dari supplier. Dimatikan berarti stok cuma bisa bertambah lewat opname.',
  },
  {
    kunci: 'modul.waste',
    grup: 'modul',
    tipe: 'boolean',
    bawaan: 'true',
    label: 'Waste',
    keterangan:
      'Catatan bahan terbuang. Dimatikan berarti selisih stok tidak punya sebab yang bisa dibaca.',
  },
  {
    kunci: 'modul.opname',
    grup: 'modul',
    tipe: 'boolean',
    bawaan: 'true',
    label: 'Stock opname',
    keterangan: 'Hitung fisik gudang dan pencatatan selisihnya.',
  },
  {
    kunci: 'modul.laporan',
    grup: 'modul',
    tipe: 'boolean',
    bawaan: 'true',
    label: 'Laporan',
    keterangan: 'Kartu stok, nilai persediaan, HPP, dan margin per menu.',
  },
  {
    kunci: 'modul.meja',
    grup: 'modul',
    tipe: 'boolean',
    bawaan: 'true',
    label: 'Meja & QR',
    keterangan:
      'Nomor meja dan kode QR-nya. Matikan kalau kafe hanya melayani bawa pulang.',
    publik: true,
  },
  {
    kunci: 'modul.promo',
    grup: 'modul',
    tipe: 'boolean',
    bawaan: 'true',
    label: 'Promo & pengumuman',
    keterangan:
      'Harga promo per menu dan banner pengumuman di beranda. Dimatikan berarti harga kembali normal seketika — promo yang sudah tersimpan tidak dihapus, cuma berhenti berlaku.',
    publik: true,
  },
  {
    kunci: 'modul.reservasi',
    grup: 'modul',
    tipe: 'boolean',
    bawaan: 'true',
    label: 'Reservasi meja',
    keterangan: 'Tamu memesan meja untuk jam tertentu sebelum datang.',
    butuh: 'modul.meja',
    publik: true,
  },

  // ── perilaku toko ──
  {
    kunci: 'toko.pesananOnline',
    grup: 'toko',
    tipe: 'boolean',
    bawaan: 'true',
    label: 'Terima pesanan online',
    keterangan:
      'Dimatikan berarti pelanggan masih bisa melihat menu, tapi tombol kirim pesanan hilang. Dipakai saat kafe tutup atau dapur kewalahan.',
    publik: true,
  },
  {
    kunci: 'toko.wajibMeja',
    grup: 'toko',
    tipe: 'boolean',
    bawaan: 'false',
    label: 'Wajib pilih meja',
    keterangan:
      'Pesanan tanpa nomor meja ditolak. Matikan kalau kafe melayani bawa pulang.',
    butuh: 'modul.meja',
    publik: true,
  },
  {
    kunci: 'toko.wajibBuktiPembelian',
    grup: 'toko',
    tipe: 'boolean',
    bawaan: 'true',
    label: 'Nota pembelian wajib berfoto',
    keterangan:
      'Dimatikan berarti nota bisa disimpan tanpa bukti. Angka belanja jadi bertumpu pada ingatan orang yang mengetiknya — sebaiknya tetap nyala.',
    butuh: 'modul.pembelian',
  },
  {
    kunci: 'toko.sembunyikanMenuHabis',
    grup: 'toko',
    tipe: 'boolean',
    bawaan: 'false',
    label: 'Sembunyikan menu yang habis',
    keterangan:
      'Bawaannya menu habis tetap tampil tapi diberi tanda, supaya pelanggan tahu kafe ini memang menjualnya. Nyalakan kalau daftar mau bersih.',
    publik: true,
  },
  {
    kunci: 'toko.nomorWhatsapp',
    grup: 'toko',
    tipe: 'teks',
    bawaan: '',
    contoh: '081234567890',
    label: 'Nomor WhatsApp kafe',
    keterangan:
      'Dipakai tamu untuk menghubungi kafe dari halaman status reservasinya. Dikosongkan berarti tombolnya tidak muncul.',
    publik: true,
    rapikan: (nilai) => {
      const bersih = nilai.trim()
      if (bersih === '') return ''

      // Disimpan dalam bentuk yang langsung bisa dipakai tautan wa.me, supaya
      // yang tampil di pengaturan sama persis dengan yang dituju tombolnya.
      const wa = nomorWhatsapp(bersih)
      if (!wa) throw new Error('Nomor WhatsApp tidak dikenali. Contoh: 081234567890')

      return wa
    },
  },

  // ── perilaku reservasi ──
  {
    kunci: 'reservasi.jamBuka',
    grup: 'reservasi',
    tipe: 'jam',
    bawaan: '09:00',
    label: 'Jam buka',
    keterangan: 'Reservasi paling awal yang bisa dipilih tamu.',
    butuh: 'modul.reservasi',
    publik: true,
  },
  {
    kunci: 'reservasi.jamTutup',
    grup: 'reservasi',
    tipe: 'jam',
    bawaan: '21:00',
    label: 'Jam tutup',
    keterangan:
      'Reservasi harus sudah selesai pada jam ini, bukan baru mulai. Jadi jam mulai paling akhir adalah jam tutup dikurangi durasi.',
    butuh: 'modul.reservasi',
    publik: true,
  },
  {
    kunci: 'reservasi.durasiMenit',
    grup: 'reservasi',
    tipe: 'angka',
    bawaan: '90',
    min: 30,
    maks: 480,
    label: 'Durasi satu reservasi (menit)',
    keterangan:
      'Berapa lama meja dianggap terpakai. Mengubah ini tidak menggeser reservasi yang sudah masuk — jam selesainya sudah ikut tersimpan.',
    butuh: 'modul.reservasi',
    publik: true,
  },
  {
    kunci: 'reservasi.maksHariKeDepan',
    grup: 'reservasi',
    tipe: 'angka',
    bawaan: '30',
    min: 1,
    maks: 365,
    label: 'Paling jauh bisa dipesan (hari)',
    keterangan: 'Tamu tidak bisa memesan melampaui jarak ini dari hari ini.',
    butuh: 'modul.reservasi',
    publik: true,
  },
] as const

export const SETTING_BY_KEY = new Map(SETTINGS.map((s) => [s.kunci, s]))

export const isSettingKey = (key: string) => SETTING_BY_KEY.has(key)

export const GRUP_LABEL: Record<SettingGrup, { judul: string; keterangan: string }> = {
  modul: {
    judul: 'Modul dasbor',
    keterangan:
      'Modul yang dimatikan hilang dari menu dan endpoint-nya ikut ditolak. Data lamanya tidak dihapus dan kembali utuh begitu dinyalakan lagi.',
  },
  toko: {
    judul: 'Perilaku toko',
    keterangan: 'Aturan yang dirasakan langsung oleh pelanggan di halaman menu.',
  },
  reservasi: {
    judul: 'Reservasi',
    keterangan: 'Jam layanan dan lama satu reservasi.',
  },
}
