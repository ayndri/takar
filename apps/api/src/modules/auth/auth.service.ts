import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma.js'
import { unauthorized } from '../../lib/errors.js'
import { signToken, type AuthUser } from '../../middleware/auth.js'
import type { LoginInput } from './auth.schema.js'

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })

  // Pesan yang sama untuk email salah dan password salah — supaya tidak bisa
  // dipakai menebak email mana yang terdaftar.
  const invalid = unauthorized('Email atau password salah')

  if (!user) {
    // Tetap jalankan hash walau user tidak ada, supaya lama responsnya seragam.
    await bcrypt.compare(input.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin')
    throw invalid
  }

  const match = await bcrypt.compare(input.password, user.passwordHash)
  if (!match) throw invalid

  const payload: AuthUser = { id: user.id, email: user.email, role: user.role }

  return {
    token: signToken(payload),
    user: { ...payload, name: user.name },
  }
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  })

  if (!user) throw unauthorized('User sudah tidak ada')

  return user
}
