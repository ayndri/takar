import type { NextFunction, Request, Response } from 'express'
import { featureDisabled } from '../lib/errors.js'
import { SETTING_BY_KEY } from '../modules/settings/settings.catalog.js'
import { flagNyala } from '../modules/settings/settings.service.js'

/**
 * Tolak permintaan ke modul yang sedang dimatikan.
 *
 * Dipasang di app.ts saat router-nya di-mount, bukan di tiap endpoint, supaya
 * tidak ada jalur yang kelewat saat nanti ada endpoint baru ditambahkan.
 *
 * Menyembunyikan menunya di frontend saja tidak cukup: alamat endpoint-nya
 * tetap bisa dipanggil langsung, dan modul yang "dimatikan" tapi masih
 * menerima POST bukan dimatikan namanya.
 */
export function requireFeature(kunci: string) {
  const label = SETTING_BY_KEY.get(kunci)?.label ?? kunci

  return (_req: Request, _res: Response, next: NextFunction) => {
    flagNyala(kunci)
      .then((nyala) => next(nyala ? undefined : featureDisabled(label)))
      .catch(next)
  }
}
