import { prisma } from '../../lib/prisma.js'
import { badRequest } from '../../lib/errors.js'
import {
  SETTINGS,
  SETTING_BY_KEY,
  type SettingDef,
  type SettingGrup,
} from './settings.catalog.js'

/**
 * Pembacaan pengaturan.
 *
 * Nilainya dipakai hampir di setiap permintaan, jadi hasil query disimpan di
 * memori proses dan dibuang begitu ada yang menyimpan perubahan. Cache-nya
 * juga punya umur pendek: kalau nanti backend jalan lebih dari satu instance,
 * instance yang tidak menerima permintaan simpan tetap ikut menyusul dalam
 * hitungan detik, bukan diam sampai di-restart.
 */
const UMUR_CACHE_MS = 10_000

let cache: Map<string, string> | null = null
let kedaluwarsa = 0

export function lupakanCacheSettings() {
  cache = null
  kedaluwarsa = 0
}

async function bacaMentah(): Promise<Map<string, string>> {
  if (cache && Date.now() < kedaluwarsa) return cache

  const rows = await prisma.setting.findMany()

  // Bawaan dulu, baris database menimpanya. Kunci yang tidak dikenal katalog
  // diabaikan — biasanya sisa pengaturan yang sudah dihapus dari kode.
  const map = new Map(SETTINGS.map((s) => [s.kunci, s.bawaan]))
  for (const row of rows) {
    if (SETTING_BY_KEY.has(row.key)) map.set(row.key, row.value)
  }

  cache = map
  kedaluwarsa = Date.now() + UMUR_CACHE_MS
  return map
}

const keBoolean = (v: string) => v === 'true'

/**
 * Nilai yang benar-benar berlaku, bukan yang tersimpan.
 *
 * Bedanya ada pada `butuh`: "wajib pilih meja" yang tersimpan menyala tetap
 * dianggap mati kalau modul meja dimatikan. Tanpa ini, mematikan satu modul
 * meninggalkan aturan yatim yang masih menolak pesanan orang.
 */
function nilaiBerlaku(def: SettingDef, tersimpan: Map<string, string>): string {
  const nilai = tersimpan.get(def.kunci) ?? def.bawaan

  if (def.butuh) {
    const induk = SETTING_BY_KEY.get(def.butuh)
    const nilaiInduk = tersimpan.get(def.butuh) ?? induk?.bawaan ?? 'false'
    if (!keBoolean(nilaiInduk)) return def.tipe === 'boolean' ? 'false' : nilai
  }

  return nilai
}

/** Semua nilai yang berlaku, siap dibaca modul lain. */
export async function settingsBerlaku(): Promise<Map<string, string>> {
  const tersimpan = await bacaMentah()
  return new Map(SETTINGS.map((s) => [s.kunci, nilaiBerlaku(s, tersimpan)]))
}

export async function flagNyala(kunci: string): Promise<boolean> {
  const def = SETTING_BY_KEY.get(kunci)
  if (!def) throw new Error(`Pengaturan tidak dikenal: ${kunci}`)
  if (def.tipe !== 'boolean') throw new Error(`${kunci} bukan pengaturan hidup/mati`)

  return keBoolean(nilaiBerlaku(def, await bacaMentah()))
}

export async function angka(kunci: string): Promise<number> {
  const def = SETTING_BY_KEY.get(kunci)
  if (!def) throw new Error(`Pengaturan tidak dikenal: ${kunci}`)

  const n = Number(nilaiBerlaku(def, await bacaMentah()))
  return Number.isFinite(n) ? n : Number(def.bawaan)
}

export async function jam(kunci: string): Promise<string> {
  const def = SETTING_BY_KEY.get(kunci)
  if (!def) throw new Error(`Pengaturan tidak dikenal: ${kunci}`)

  return nilaiBerlaku(def, await bacaMentah())
}

export type SettingTampil = {
  kunci: string
  grup: SettingGrup
  tipe: string
  label: string
  keterangan: string
  /** Yang tersimpan — ini yang muncul di kotak isian. */
  nilai: string
  /** Yang benar-benar berlaku setelah `butuh` diperhitungkan. */
  berlaku: string
  /**
   * Kunci induk pengaturan ini, kalau ada — selalu dikirim, tidak hanya saat
   * induknya mati. Halaman pengaturan perlu tahu hubungannya supaya bisa
   * meredupkan baris seketika saat sakelar induknya baru dimatikan di layar,
   * sebelum apa pun dikirim ke server.
   */
  butuh: string | null
  min?: number
  maks?: number
  /** Contoh isian, hanya untuk tipe 'teks'. */
  contoh?: string
}

export async function daftarSettings(): Promise<SettingTampil[]> {
  const tersimpan = await bacaMentah()

  return SETTINGS.map((def) => ({
    kunci: def.kunci,
    grup: def.grup,
    tipe: def.tipe,
    label: def.label,
    keterangan: def.keterangan,
    nilai: tersimpan.get(def.kunci) ?? def.bawaan,
    berlaku: nilaiBerlaku(def, tersimpan),
    butuh: def.butuh ?? null,
    ...(def.min !== undefined && { min: def.min }),
    ...(def.maks !== undefined && { maks: def.maks }),
    ...(def.contoh !== undefined && { contoh: def.contoh }),
  }))
}

/**
 * Bagian yang boleh dibaca halaman pelanggan tanpa login.
 *
 * Disaring, tidak dikirim semua: daftar modul dasbor yang dipakai kafe bukan
 * urusan orang yang cuma mau memesan kopi.
 */
export async function settingsPublik(): Promise<Record<string, string>> {
  const berlaku = await settingsBerlaku()

  return Object.fromEntries(
    SETTINGS.filter((s) => s.publik).map((s) => [s.kunci, berlaku.get(s.kunci) ?? s.bawaan]),
  )
}

const JAM_VALID = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Ubah nilai dari luar jadi teks yang sah untuk tipe pengaturannya. */
function bakukan(def: SettingDef, nilai: unknown): string {
  if (def.tipe === 'boolean') {
    if (typeof nilai === 'boolean') return String(nilai)
    if (nilai === 'true' || nilai === 'false') return nilai
    throw badRequest(`${def.label} hanya menerima hidup atau mati`)
  }

  if (def.tipe === 'angka') {
    const n = Number(nilai)
    if (!Number.isFinite(n)) throw badRequest(`${def.label} harus berupa angka`)
    if (def.min !== undefined && n < def.min) {
      throw badRequest(`${def.label} paling kecil ${def.min}`)
    }
    if (def.maks !== undefined && n > def.maks) {
      throw badRequest(`${def.label} paling besar ${def.maks}`)
    }
    return String(Math.round(n))
  }

  if (def.tipe === 'teks') {
    const teks = String(nilai)
    if (!def.rapikan) return teks.trim()

    try {
      return def.rapikan(teks)
    } catch (e) {
      throw badRequest(e instanceof Error ? e.message : `${def.label} tidak sah`)
    }
  }

  const teks = String(nilai)
  if (!JAM_VALID.test(teks)) throw badRequest(`${def.label} harus berformat HH:MM`)
  return teks
}

/**
 * Simpan beberapa pengaturan sekaligus.
 *
 * Satu transaksi supaya halaman pengaturan tidak bisa menyimpan separuh —
 * mematikan modul tapi gagal mematikan aturan yang bergantung padanya akan
 * meninggalkan keadaan yang membingungkan.
 */
export async function simpanSettings(perubahan: Record<string, unknown>) {
  const entri = Object.entries(perubahan)
  if (entri.length === 0) throw badRequest('Tidak ada yang diubah')

  const siap = entri.map(([kunci, nilai]) => {
    const def = SETTING_BY_KEY.get(kunci)
    if (!def) throw badRequest(`Pengaturan tidak dikenal: ${kunci}`)
    return { kunci, nilai: bakukan(def, nilai) }
  })

  // Jam buka harus lebih awal dari jam tutup. Diperiksa terhadap gabungan
  // nilai lama dan baru, karena yang dikirim bisa cuma salah satunya.
  const tersimpan = await bacaMentah()
  const ambil = (k: string) =>
    siap.find((s) => s.kunci === k)?.nilai ?? tersimpan.get(k) ?? SETTING_BY_KEY.get(k)!.bawaan

  if (ambil('reservasi.jamBuka') >= ambil('reservasi.jamTutup')) {
    throw badRequest('Jam buka harus lebih awal dari jam tutup')
  }

  await prisma.$transaction(
    siap.map((s) =>
      prisma.setting.upsert({
        where: { key: s.kunci },
        create: { key: s.kunci, value: s.nilai },
        update: { value: s.nilai },
      }),
    ),
  )

  lupakanCacheSettings()

  return daftarSettings()
}
