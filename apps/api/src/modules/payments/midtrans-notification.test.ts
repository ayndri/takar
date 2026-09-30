import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  jumlahCocok,
  rupiahBulat,
  statusDariNotifikasi,
  tandaTanganSah,
  tandaTanganSeharusnya,
  type NotifikasiMidtrans,
} from './midtrans-notification.js'

const KUNCI = 'SB-Mid-server-contoh-untuk-tes'

/** Notifikasi yang bertanda tangan benar, seperti yang dikirim Midtrans. */
function notifikasi(isi: Partial<NotifikasiMidtrans> = {}): NotifikasiMidtrans {
  const dasar = {
    order_id: 'TKR-7F2A-1',
    status_code: '200',
    gross_amount: '38000.00',
    transaction_status: 'settlement',
    payment_type: 'qris',
    ...isi,
  }

  return {
    ...dasar,
    signature_key: createHash('sha512')
      .update(
        String(dasar.order_id) +
          String(dasar.status_code) +
          String(dasar.gross_amount) +
          KUNCI,
      )
      .digest('hex'),
  }
}

describe('tandaTanganSeharusnya', () => {
  it('memakai rumus order_id + status_code + gross_amount + server key', () => {
    const n = { order_id: 'A', status_code: '200', gross_amount: '1000.00' }
    const manual = createHash('sha512').update('A200' + '1000.00' + KUNCI).digest('hex')

    expect(tandaTanganSeharusnya(n, KUNCI)).toBe(manual)
  })

  it('memakai gross_amount persis seperti dikirim, termasuk desimalnya', () => {
    const dengan = tandaTanganSeharusnya(
      { order_id: 'A', status_code: '200', gross_amount: '1000.00' },
      KUNCI,
    )
    const tanpa = tandaTanganSeharusnya(
      { order_id: 'A', status_code: '200', gross_amount: '1000' },
      KUNCI,
    )

    expect(dengan).not.toBe(tanpa)
  })
})

describe('tandaTanganSah', () => {
  it('menerima notifikasi yang benar', () => {
    expect(tandaTanganSah(notifikasi(), KUNCI)).toBe(true)
  })

  it('menolak kalau kuncinya berbeda', () => {
    expect(tandaTanganSah(notifikasi(), 'kunci-orang-lain')).toBe(false)
  })

  it('menolak kalau jumlahnya diubah setelah ditandatangani', () => {
    const n = notifikasi()
    expect(tandaTanganSah({ ...n, gross_amount: '1000.00' }, KUNCI)).toBe(false)
  })

  it('menolak kalau nomor pesanannya diubah', () => {
    const n = notifikasi()
    expect(tandaTanganSah({ ...n, order_id: 'TKR-LAIN-1' }, KUNCI)).toBe(false)
  })

  it('menolak notifikasi tanpa tanda tangan sama sekali', () => {
    const { signature_key: _, ...tanpa } = notifikasi()
    expect(tandaTanganSah(tanpa, KUNCI)).toBe(false)
    expect(tandaTanganSah({ ...tanpa, signature_key: '' }, KUNCI)).toBe(false)
  })

  it('menolak tanda tangan yang panjangnya tidak wajar tanpa melempar', () => {
    expect(() =>
      tandaTanganSah({ ...notifikasi(), signature_key: 'pendek' }, KUNCI),
    ).not.toThrow()
    expect(tandaTanganSah({ ...notifikasi(), signature_key: 'pendek' }, KUNCI)).toBe(
      false,
    )
  })
})

describe('statusDariNotifikasi', () => {
  it('settlement berarti lunas', () => {
    expect(statusDariNotifikasi({ transaction_status: 'settlement' })).toBe('PAID')
  })

  it('capture baru lunas kalau lolos pemeriksaan penipuan', () => {
    expect(
      statusDariNotifikasi({ transaction_status: 'capture', fraud_status: 'accept' }),
    ).toBe('PAID')
  })

  it('capture yang masih ditahan belum boleh dianggap lunas', () => {
    // Midtrans masih menunggu keputusan manual. Menganggapnya lunas berarti
    // menyerahkan kopi untuk transaksi yang mungkin dibatalkan.
    expect(
      statusDariNotifikasi({
        transaction_status: 'capture',
        fraud_status: 'challenge',
      }),
    ).toBe('PENDING')
  })

  it('menerjemahkan status gagal dan batal', () => {
    expect(statusDariNotifikasi({ transaction_status: 'deny' })).toBe('FAILED')
    expect(statusDariNotifikasi({ transaction_status: 'failure' })).toBe('FAILED')
    expect(statusDariNotifikasi({ transaction_status: 'expire' })).toBe('EXPIRED')
    expect(statusDariNotifikasi({ transaction_status: 'cancel' })).toBe('CANCELLED')
    expect(statusDariNotifikasi({ transaction_status: 'pending' })).toBe('PENDING')
  })

  it('status yang tidak dikenal tidak pernah dianggap lunas', () => {
    expect(statusDariNotifikasi({ transaction_status: 'entah_apa' })).toBe('PENDING')
    expect(statusDariNotifikasi({})).toBe('PENDING')
  })
})

describe('jumlahCocok', () => {
  it('menyamakan bentuk berdesimal dan tidak', () => {
    expect(jumlahCocok({ gross_amount: '38000.00' }, '38000')).toBe(true)
    expect(jumlahCocok({ gross_amount: '38000' }, '38000.00')).toBe(true)
  })

  it('menolak jumlah yang berbeda', () => {
    expect(jumlahCocok({ gross_amount: '1000.00' }, '38000.00')).toBe(false)
    expect(jumlahCocok({ gross_amount: '38001.00' }, '38000.00')).toBe(false)
  })

  it('menolak yang bukan angka', () => {
    expect(jumlahCocok({ gross_amount: 'banyak' }, '38000')).toBe(false)
    expect(jumlahCocok({}, '38000')).toBe(false)
  })
})

describe('rupiahBulat', () => {
  it('membulatkan ke atas, bukan ke bawah', () => {
    // Ke bawah berarti kafe menanggung selisihnya tiap transaksi.
    expect(rupiahBulat('19000.01')).toBe(19001)
    expect(rupiahBulat('19000.99')).toBe(19001)
  })

  it('membiarkan yang sudah bulat', () => {
    expect(rupiahBulat('38000.00')).toBe(38000)
    expect(rupiahBulat(38000)).toBe(38000)
  })
})
