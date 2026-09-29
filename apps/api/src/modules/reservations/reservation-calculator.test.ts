import { describe, expect, it } from 'vitest'
import {
  ZONA_KAFE_MENIT,
  akhirReservasi,
  alasanWaktuDitolak,
  bertumpuk,
  buatWaktu,
  jamMenit,
  menitJam,
  menitLokal,
  pilihMejaTerbaik,
  slotHarian,
  tanggalLokal,
  type MejaKandidat,
} from './reservation-calculator.js'

/** Denah meja contoh: dua meja kecil, satu sedang, satu besar. */
const MEJA: MejaKandidat[] = [
  { id: 'm1', number: '1', capacity: 2 },
  { id: 'm2', number: '2', capacity: 2 },
  { id: 'm5', number: '5', capacity: 4 },
  { id: 'm9', number: '9', capacity: 8 },
]

describe('menitJam & jamMenit', () => {
  it('mengubah jam jadi menit sejak tengah malam', () => {
    expect(menitJam('00:00')).toBe(0)
    expect(menitJam('09:30')).toBe(570)
    expect(menitJam('23:59')).toBe(1439)
  })

  it('kembali utuh saat diubah bolak-balik', () => {
    expect(jamMenit(menitJam('19:45'))).toBe('19:45')
  })

  it('menolak bentuk yang bukan HH:MM', () => {
    expect(() => menitJam('9:00')).toThrow()
    expect(() => menitJam('24:00')).toThrow()
    expect(() => menitJam('19:60')).toThrow()
  })
})

describe('buatWaktu', () => {
  it('membaca jam sebagai jam dinding kafe, bukan jam server', () => {
    // 19:00 WIB = 12:00 UTC
    expect(buatWaktu('2026-09-20', '19:00').toISOString()).toBe('2026-09-20T12:00:00.000Z')
  })

  it('mundur ke hari sebelumnya kalau jamnya pagi sekali', () => {
    // 05:00 WIB = 22:00 UTC hari sebelumnya
    expect(buatWaktu('2026-09-20', '05:00').toISOString()).toBe('2026-09-19T22:00:00.000Z')
  })

  it('menolak tanggal yang bukan YYYY-MM-DD', () => {
    expect(() => buatWaktu('20-09-2026', '19:00')).toThrow()
  })
})

describe('menitLokal & tanggalLokal', () => {
  it('membaca titik waktu UTC sebagai jam dinding kafe', () => {
    const waktu = new Date('2026-09-20T12:00:00.000Z')
    expect(menitLokal(waktu)).toBe(menitJam('19:00'))
    expect(tanggalLokal(waktu)).toBe('2026-09-20')
  })

  it('reservasi jam 8 malam WIB tetap tanggal itu, walau di UTC masih siang', () => {
    const waktu = buatWaktu('2026-09-20', '20:00')
    expect(tanggalLokal(waktu)).toBe('2026-09-20')
    expect(waktu.getUTCDate()).toBe(20)
  })

  it('reservasi jam 1 pagi WIB tanggal 21 di UTC masih tanggal 20', () => {
    const waktu = buatWaktu('2026-09-21', '01:00')
    expect(waktu.toISOString()).toBe('2026-09-20T18:00:00.000Z')
    expect(tanggalLokal(waktu)).toBe('2026-09-21')
  })

  it('zona lain ikut dihormati', () => {
    const waktu = new Date('2026-09-20T12:00:00.000Z')
    expect(menitLokal(waktu, 0)).toBe(menitJam('12:00'))
    expect(menitLokal(waktu, ZONA_KAFE_MENIT)).toBe(menitJam('19:00'))
  })
})

describe('akhirReservasi', () => {
  it('menambahkan durasi ke jam mulai', () => {
    const mulai = buatWaktu('2026-09-20', '19:00')
    expect(akhirReservasi(mulai, 90).toISOString()).toBe('2026-09-20T13:30:00.000Z')
  })

  it('menolak durasi nol atau negatif', () => {
    expect(() => akhirReservasi(new Date(), 0)).toThrow()
    expect(() => akhirReservasi(new Date(), -30)).toThrow()
  })
})

describe('bertumpuk', () => {
  const rentang = (mulai: string, selesai: string) =>
    [buatWaktu('2026-09-20', mulai), buatWaktu('2026-09-20', selesai)] as const

  it('mengenali dua reservasi yang beririsan', () => {
    const [a1, a2] = rentang('19:00', '20:30')
    const [b1, b2] = rentang('20:00', '21:30')
    expect(bertumpuk(a1, a2, b1, b2)).toBe(true)
  })

  it('mengenali reservasi yang tertelan seluruhnya', () => {
    const [a1, a2] = rentang('18:00', '22:00')
    const [b1, b2] = rentang('19:00', '20:00')
    expect(bertumpuk(a1, a2, b1, b2)).toBe(true)
    expect(bertumpuk(b1, b2, a1, a2)).toBe(true)
  })

  it('membolehkan dua reservasi yang bersambung persis di ujungnya', () => {
    const [a1, a2] = rentang('17:00', '18:30')
    const [b1, b2] = rentang('18:30', '20:00')
    expect(bertumpuk(a1, a2, b1, b2)).toBe(false)
  })

  it('membolehkan reservasi yang berjauhan', () => {
    const [a1, a2] = rentang('10:00', '11:30')
    const [b1, b2] = rentang('19:00', '20:30')
    expect(bertumpuk(a1, a2, b1, b2)).toBe(false)
  })
})

describe('slotHarian', () => {
  it('berhenti pada slot terakhir yang masih selesai sebelum tutup', () => {
    const slot = slotHarian({ jamBuka: '09:00', jamTutup: '21:00', durasiMenit: 90 })
    expect(slot[0]).toBe('09:00')
    expect(slot.at(-1)).toBe('19:30')
    expect(slot).not.toContain('20:00')
  })

  it('mengikuti langkah yang diminta', () => {
    const slot = slotHarian({
      jamBuka: '09:00',
      jamTutup: '12:00',
      durasiMenit: 60,
      langkahMenit: 60,
    })
    expect(slot).toEqual(['09:00', '10:00', '11:00'])
  })

  it('tidak menghasilkan slot apa pun kalau durasinya melebihi jam layanan', () => {
    expect(slotHarian({ jamBuka: '09:00', jamTutup: '10:00', durasiMenit: 120 })).toEqual([])
  })

  it('menolak durasi atau langkah yang tidak masuk akal', () => {
    expect(() => slotHarian({ jamBuka: '09:00', jamTutup: '21:00', durasiMenit: 0 })).toThrow()
    expect(() =>
      slotHarian({ jamBuka: '09:00', jamTutup: '21:00', durasiMenit: 90, langkahMenit: 0 }),
    ).toThrow()
  })
})

describe('alasanWaktuDitolak', () => {
  const dasar = {
    durasiMenit: 90,
    jamBuka: '09:00',
    jamTutup: '21:00',
    maksHariKeDepan: 30,
    sekarang: buatWaktu('2026-09-20', '10:00'),
  }

  it('meloloskan jam yang wajar', () => {
    expect(alasanWaktuDitolak({ ...dasar, mulai: buatWaktu('2026-09-20', '19:00') })).toBeNull()
  })

  it('menolak jam yang sudah lewat', () => {
    expect(alasanWaktuDitolak({ ...dasar, mulai: buatWaktu('2026-09-20', '09:00') })).toMatch(
      /sudah lewat/,
    )
  })

  it('menolak jam sebelum kafe buka', () => {
    expect(alasanWaktuDitolak({ ...dasar, mulai: buatWaktu('2026-09-21', '07:00') })).toMatch(
      /baru buka/,
    )
  })

  it('menolak reservasi yang belum selesai saat kafe tutup', () => {
    expect(alasanWaktuDitolak({ ...dasar, mulai: buatWaktu('2026-09-20', '20:00') })).toMatch(
      /19:30/,
    )
  })

  it('meloloskan slot terakhir yang selesai persis saat tutup', () => {
    expect(alasanWaktuDitolak({ ...dasar, mulai: buatWaktu('2026-09-20', '19:30') })).toBeNull()
  })

  it('menolak tanggal yang terlalu jauh ke depan', () => {
    expect(alasanWaktuDitolak({ ...dasar, mulai: buatWaktu('2026-12-31', '19:00') })).toMatch(
      /30 hari/,
    )
  })

  it('memakai jam kafe, bukan jam UTC', () => {
    // 08:00 WIB itu 01:00 UTC. Kalau jam bukanya dibandingkan memakai jam UTC,
    // 01:00 lolos sebagai "sebelum 09:00 tapi masih dini hari" dengan alasan
    // yang salah, dan 09:00 WIB (02:00 UTC) justru ikut ditolak.
    expect(alasanWaktuDitolak({ ...dasar, mulai: buatWaktu('2026-09-21', '08:00') })).toMatch(
      /baru buka/,
    )
    expect(alasanWaktuDitolak({ ...dasar, mulai: buatWaktu('2026-09-21', '09:00') })).toBeNull()
  })
})

describe('pilihMejaTerbaik', () => {
  it('memilih meja terkecil yang masih muat', () => {
    expect(pilihMejaTerbaik(MEJA, 3)?.number).toBe('5')
    expect(pilihMejaTerbaik(MEJA, 2)?.number).toBe('1')
    expect(pilihMejaTerbaik(MEJA, 5)?.number).toBe('9')
  })

  it('tidak menghabiskan meja besar untuk tamu sedikit', () => {
    expect(pilihMejaTerbaik(MEJA, 1)?.capacity).toBe(2)
  })

  it('memilih nomor terkecil kalau kapasitasnya sama', () => {
    expect(pilihMejaTerbaik(MEJA, 2)?.id).toBe('m1')
  })

  it('mengembalikan null kalau tidak ada yang muat', () => {
    expect(pilihMejaTerbaik(MEJA, 12)).toBeNull()
    expect(pilihMejaTerbaik([], 2)).toBeNull()
  })
})
