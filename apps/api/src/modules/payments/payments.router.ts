import { Router } from 'express'
import { z } from 'zod'
import { getParams, validateParams } from '../../middleware/validate.js'
import {
  mulaiPembayaran,
  segarkanDariMidtrans,
  terimaNotifikasi,
} from './payments.service.js'

const codeParamSchema = z.object({ code: z.string().min(4).max(30) })

export const paymentsRouter = Router()

/**
 * Mulai bayar. Tanpa login — yang memesan memang bukan pengguna terdaftar.
 * Kode pesanan yang jadi kuncinya, sama seperti halaman lacak pesanan.
 */
paymentsRouter.post(
  '/:code/snap',
  validateParams(codeParamSchema),
  async (_req, res) => {
    res.json(await mulaiPembayaran(getParams<{ code: string }>(res).code))
  },
)

/** Cadangan kalau notifikasi Midtrans tidak pernah sampai. */
paymentsRouter.post(
  '/:code/refresh',
  validateParams(codeParamSchema),
  async (_req, res) => {
    res.json(await segarkanDariMidtrans(getParams<{ code: string }>(res).code))
  },
)

/**
 * Notifikasi dari Midtrans.
 *
 * Sengaja di router terpisah yang TIDAK dijaga requireFeature: notifikasi
 * untuk pembayaran yang sudah terlanjur dibuat harus tetap diterima walau
 * pemilik baru saja mematikan pembayaran online. Menolaknya berarti uang
 * masuk tanpa pesanannya pernah dikonfirmasi.
 *
 * Yang menggantikan penjagaan adalah tanda tangan SHA512 di dalam isinya.
 */
export const paymentsWebhookRouter = Router()

paymentsWebhookRouter.post('/', async (req, res) => {
  // Midtrans membaca kode 200 sebagai "sudah diterima" dan berhenti mengirim
  // ulang. Error apa pun dilempar ke errorHandler supaya kodenya bukan 200,
  // dan Midtrans mencoba lagi nanti.
  res.json(await terimaNotifikasi(req.body ?? {}))
})
