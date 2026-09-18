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
  price: string
  imageUrl: string | null
  available: boolean
  remainingPortions: number
  /** Porsi terjual tujuh hari terakhir, dipakai menandai menu terlaris. */
  soldThisWeek: number
  ingredientCount: number
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  pages: number
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
}

export const getHighlights = () => api<Highlights>('/api/menus/highlights')

export const formatRupiah = (value: string | number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value))
