import { EventEmitter } from 'node:events'

export type OrderEvent = {
  type: 'created' | 'confirmed' | 'cancelled' | 'status'
  orderId: string
}

/**
 * Pemberitahuan perubahan pesanan untuk layar dapur (SSE).
 *
 * Cukup untuk satu proses. Kalau nanti backend dijalankan lebih dari satu
 * instance, ini harus pindah ke Postgres LISTEN/NOTIFY atau Redis — kalau
 * tidak, layar dapur cuma dapat kabar dari instance yang kebetulan melayani.
 */
export const orderEvents = new EventEmitter()

// Layar dapur bisa terbuka di beberapa perangkat sekaligus.
orderEvents.setMaxListeners(50)
