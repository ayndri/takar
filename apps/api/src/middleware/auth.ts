import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { forbidden, unauthorized } from '../lib/errors.js'

export type Role = 'OWNER' | 'STAFF'

export type AuthUser = {
  id: string
  email: string
  role: Role
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: '7d' })
}

/** Wajib login. Token dibaca dari header `Authorization: Bearer <token>`. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('Token tidak ada'))
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser
    res.locals.user = payload
    next()
  } catch {
    next(unauthorized('Token tidak valid atau sudah kedaluwarsa'))
  }
}

/**
 * Batasi ke peran tertentu. Dipakai untuk laporan keuangan:
 * staff boleh mengelola pesanan, tapi tidak boleh melihat margin.
 */
export function requireRole(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthUser | undefined

    if (!user) return next(unauthorized())
    if (!roles.includes(user.role)) {
      return next(forbidden(`Butuh peran: ${roles.join(' atau ')}`))
    }

    next()
  }
}

export const getUser = (res: Response): AuthUser => res.locals.user as AuthUser
