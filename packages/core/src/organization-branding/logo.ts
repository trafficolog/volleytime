import { ORGANIZATION_LOGO_MAX_BYTES, type ORGANIZATION_LOGO_MIME_TYPES } from '@volley-time/db'

import { LogoInvalidError, LogoTooLargeError } from './errors'

export type LogoMimeType = (typeof ORGANIZATION_LOGO_MIME_TYPES)[number]

export const LOGO_MAX_BYTES = ORGANIZATION_LOGO_MAX_BYTES

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

function startsWith(data: Uint8Array, signature: number[]): boolean {
  return data.length >= signature.length && signature.every((byte, i) => data[i] === byte)
}

/** Тип по первым байтам (не по расширению и не по заявленному Content-Type). */
export function detectLogoMime(data: Uint8Array): LogoMimeType | null {
  if (startsWith(data, PNG_SIGNATURE)) return 'image/png'
  if (startsWith(data, JPEG_SIGNATURE)) return 'image/jpeg'
  return null
}

/**
 * Проверка загруженного логотипа (21.2.16): непустой файл не больше 512 КБ, по содержимому PNG
 * или JPEG (SVG и всё остальное отклоняется), заявленный тип совпадает с байтами. PNG обязан
 * содержать заголовок IHDR сразу за сигнатурой. Возвращает тип по содержимому.
 */
export function validateLogoUpload(input: {
  declaredType: string | undefined
  data: Uint8Array
}): LogoMimeType {
  const { data } = input
  if (data.length === 0) throw new LogoInvalidError('Logo file is empty')
  if (data.length > LOGO_MAX_BYTES) throw new LogoTooLargeError(LOGO_MAX_BYTES)
  const detected = detectLogoMime(data)
  if (!detected) throw new LogoInvalidError('Logo must be a PNG or JPEG image')
  const declared = input.declaredType?.split(';')[0]?.trim().toLowerCase()
  if (declared !== detected) {
    throw new LogoInvalidError('Declared file type does not match the file content')
  }
  if (detected === 'image/png') {
    // сигнатура (8) + длина чанка (4) + «IHDR» (4)
    const ihdr = Buffer.from(data.subarray(12, 16)).toString('latin1')
    if (data.length < 33 || ihdr !== 'IHDR') throw new LogoInvalidError('Corrupted PNG file')
  }
  return detected
}
