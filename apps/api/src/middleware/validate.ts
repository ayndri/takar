import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

/**
 * Express tidak punya validasi bawaan, jadi semua input lewat sini dulu.
 * Error dari Zod ditangkap errorHandler dan jadi response 400 yang seragam.
 */

/** Hasil parse menimpa req.body — controller menerima data yang sudah bertipe. */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body)
    next()
  }
}

/**
 * req.query di Express 5 read-only, jadi hasilnya ditaruh di res.locals.query.
 * Ambil di controller dengan getQuery<T>(res).
 */
export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.locals.query = schema.parse(req.query)
    next()
  }
}

export function validateParams<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.locals.params = schema.parse(req.params)
    next()
  }
}

export const getQuery = <T>(res: Response): T => res.locals.query as T
export const getParams = <T>(res: Response): T => res.locals.params as T
