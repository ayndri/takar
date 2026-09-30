const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type ApiError = {
  error: { code?: string; message: string; details?: unknown }
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    // Katalog dan stok berubah terus — jangan di-cache.
    cache: 'no-store',
  })

  if (!res.ok) {
    let payload: ApiError | undefined
    try {
      payload = (await res.json()) as ApiError
    } catch {
      // Response bukan JSON (mis. backend mati) — pakai pesan bawaan.
    }

    throw new ApiRequestError(
      res.status,
      payload?.error.message ?? `Request gagal (${res.status})`,
      payload?.error.code,
      payload?.error.details,
    )
  }

  return res.json() as Promise<T>
}

export type PublicMenu = {
  id: string
  name: string
  category: string
  /** Harga yang benar-benar dibayar sekarang — sudah termasuk promo. */
  price: string
  /** Harga sebelum potongan. Hanya terisi saat sedang promo; ini yang dicoret. */
  normalPrice: string | null
  /** Besar potongan dalam persen, atau null kalau tidak sedang promo. */
  discountPercent: number | null
  imageUrl: string | null
  available: boolean
  remainingPortions: number
  /** Porsi terjual tujuh hari terakhir. */
  soldThisWeek: number
  /** Termasuk tiga terlaris minggu ini, dihitung terhadap seluruh menu. */
  isBestSeller: boolean
  ingredientCount: number
}

export type Pengumuman = {
  id: string
  title: string
  body: string
  linkLabel: string | null
  linkHref: string | null
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  pages: number
  /**
   * Isi tiap kategori menurut kata kunci yang sedang dipakai — bukan jumlah
   * global. Tidak ikut menyaring kategori yang sedang dipilih, supaya masih
   * kelihatan ke mana bisa berpindah.
   */
  categories?: { name: string; count: number }[]
}

export const getPublicMenus = (params: {
  q?: string
  category?: string
  page?: number
  pageSize?: number
} = {}) => {
  const p = new URLSearchParams()
  if (params.q) p.set('q', params.q)
  if (params.category) p.set('category', params.category)
  if (params.page) p.set('page', String(params.page))
  if (params.pageSize) p.set('pageSize', String(params.pageSize))

  const s = p.toString()
  return api<Paginated<PublicMenu>>(`/api/menus${s ? `?${s}` : ''}`)
}

export type Highlights = {
  stats: {
    total: number
    available: number
    categories: number
    soldThisWeek: number
  }
  categories: { name: string; count: number }[]
  topSellers: PublicMenu[]
  lowStock: PublicMenu[]
  /** Menu yang sedang potong harga, potongan terbesar lebih dulu. */
  promos: PublicMenu[]
}

export const getHighlights = () => api<Highlights>('/api/menus/highlights')

/**
 * Pengumuman yang sedang tampil, atau null.
 *
 * Gagal diam-diam: banner itu pelengkap, dan beranda tidak boleh ikut mati
 * cuma karena modul promo sedang dimatikan (endpoint-nya balas 403).
 */
export const getPengumuman = async (): Promise<Pengumuman | null> => {
  try {
    return await api<Pengumuman | null>('/api/announcements')
  } catch {
    return null
  }
}

export const formatRupiah = (value: string | number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value))
