import { describe, expect, it } from 'vitest'
import { nomorBisaDiwhatsapp, nomorWhatsapp } from './phone.js'

describe('nomorWhatsapp', () => {
  it('mengubah bentuk lokal 08 jadi 628', () => {
    expect(nomorWhatsapp('08123456789')).toBe('628123456789')
  })

  it('membuang spasi dan strip', () => {
    expect(nomorWhatsapp('0812 3456-789')).toBe('628123456789')
    expect(nomorWhatsapp('+62 812-3456-789')).toBe('628123456789')
    expect(nomorWhatsapp('  0812 3456 7890  ')).toBe('6281234567890')
  })

  it('membiarkan nomor yang sudah berkode negara', () => {
    expect(nomorWhatsapp('628123456789')).toBe('628123456789')
    expect(nomorWhatsapp('+628123456789')).toBe('628123456789')
  })

  it('menambahkan kode negara ke nomor tanpa nol di depan', () => {
    expect(nomorWhatsapp('8123456789')).toBe('628123456789')
  })

  it('tidak memaksa nomor luar negeri jadi nomor Indonesia', () => {
    // Tamu dari Singapura. Tanpa penanganan ini nomornya jadi 62 65 …
    expect(nomorWhatsapp('+65 8123 4567')).toBe('6581234567')
    expect(nomorWhatsapp('+60 12-345 6789')).toBe('60123456789')
  })

  it('mengganti nol depan dengan kode negara, bukan membuangnya', () => {
    // 0621 itu kode area Binjai — kalau nolnya cuma dibuang, nomornya jadi
    // 62 621… yang benar, tapi kalau nolnya dipertahankan jadi 62 0621… yang
    // tidak bisa dihubungi.
    expect(nomorWhatsapp('0621234567')).toBe('62621234567')
  })

  it('menolak nomor yang terlalu pendek', () => {
    expect(nomorWhatsapp('123')).toBeNull()
    expect(nomorWhatsapp('0812')).toBeNull()
  })

  it('menolak nomor yang terlalu panjang', () => {
    expect(nomorWhatsapp('0812345678901234567')).toBeNull()
  })

  it('menolak yang kosong atau tanpa angka sama sekali', () => {
    expect(nomorWhatsapp('')).toBeNull()
    expect(nomorWhatsapp('   ')).toBeNull()
    expect(nomorWhatsapp('-- --')).toBeNull()
    expect(nomorWhatsapp('+')).toBeNull()
  })

  it('hasilnya tidak pernah memuat tanda apa pun', () => {
    const hasil = nomorWhatsapp('+62 (812) 3456-789')
    expect(hasil).toBe('628123456789')
    expect(hasil).toMatch(/^\d+$/)
  })
})

describe('nomorBisaDiwhatsapp', () => {
  it('memisahkan yang bisa dihubungi dari yang tidak', () => {
    expect(nomorBisaDiwhatsapp('08123456789')).toBe(true)
    expect(nomorBisaDiwhatsapp('123')).toBe(false)
  })
})
