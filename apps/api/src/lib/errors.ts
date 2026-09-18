export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, 'BAD_REQUEST', details)

export const unauthorized = (message = 'Perlu login') =>
  new AppError(401, message, 'UNAUTHORIZED')

export const forbidden = (message = 'Tidak punya akses') =>
  new AppError(403, message, 'FORBIDDEN')

export const notFound = (message = 'Data tidak ditemukan') =>
  new AppError(404, message, 'NOT_FOUND')

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, message, 'CONFLICT', details)

/// Dipakai saat pesanan ditolak karena bahan tidak cukup.
export const insufficientStock = (
  shortages: { ingredient: string; needed: string; available: string }[],
) =>
  new AppError(
    409,
    'Stok bahan tidak cukup untuk pesanan ini',
    'INSUFFICIENT_STOCK',
    { shortages },
  )
