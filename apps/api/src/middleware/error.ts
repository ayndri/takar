import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors.js'
import { env } from '../config/env.js'

/** Route yang tidak dikenal — dijalankan sebelum error handler. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} tidak ada` },
  })
}

/**
 * Satu-satunya tempat error diubah jadi response.
 * Express 5 sudah meneruskan promise yang reject ke sini, jadi handler async
 * tidak perlu dibungkus try/catch.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid',
        details: err.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
    })
    return
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    })
    return
  }

  // Sampai sini berarti bug, bukan input yang salah.
  console.error(err)
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan di server',
      ...(env.NODE_ENV === 'development' && {
        details: err instanceof Error ? err.message : String(err),
      }),
    },
  })
}
