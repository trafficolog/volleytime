import { ORGANIZATION_LOGO_MAX_BYTES, type ORGANIZATION_LOGO_MIME_TYPES } from '@volley-time/db'

import { LogoInvalidError, LogoNotSquareError, LogoTooLargeError } from './errors'

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

export interface LogoDimensions {
  width: number
  height: number
}

/** PNG: сигнатура (8), длина чанка (4), «IHDR» (4), ширина и высота (по 4 байта, big-endian). */
function pngDimensions(data: Uint8Array): LogoDimensions | null {
  if (data.length < 33) return null
  if (Buffer.from(data.subarray(12, 16)).toString('latin1') !== 'IHDR') return null
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

/** Маркеры SOFn (кадр с размерами), кроме DHT (C4), JPG (C8) и DAC (CC). */
const isSof = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

/**
 * JPEG: обход сегментов от SOI до первого SOFn (SOF0 baseline, SOF1, SOF2 progressive и др.);
 * внутри SOF: длина (2), точность (1), высота (2), ширина (2). Каждый выход за границы файла,
 * сегмент короче своего заголовка или SOS/EOI до SOF — файл повреждён (`null`). Ничего не
 * декодируется: читаются только заголовки сегментов.
 */
function jpegDimensions(data: Uint8Array): LogoDimensions | null {
  let i = 2 // после SOI (FF D8)
  while (i < data.length) {
    if (data[i] !== 0xff) return null
    while (data[i] === 0xff) i++ // заполняющие FF перед маркером
    const marker = data[i++]
    if (marker === undefined) return null
    // маркеры без длины: TEM, RSTn, SOI
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue
    // EOI или SOS раньше SOF: размеров нет
    if (marker === 0xd9 || marker === 0xda || marker === 0x00) return null
    if (i + 2 > data.length) return null
    const length = (data[i]! << 8) | data[i + 1]!
    if (length < 2) return null
    if (isSof(marker)) {
      if (length < 8 || i + 7 > data.length) return null
      return {
        height: (data[i + 3]! << 8) | data[i + 4]!,
        width: (data[i + 5]! << 8) | data[i + 6]!,
      }
    }
    i += length
  }
  return null
}

/** Размеры изображения по заголовку; `null` — заголовок повреждён или не найден. */
export function logoDimensions(data: Uint8Array, mime: LogoMimeType): LogoDimensions | null {
  return mime === 'image/png' ? pngDimensions(data) : jpegDimensions(data)
}

/**
 * Проверка загруженного логотипа (21.2.16): непустой файл не больше 1 МБ, по содержимому PNG
 * или JPEG (SVG и всё остальное отклоняется), заявленный тип совпадает с байтами, размеры
 * читаются из заголовка (PNG IHDR, JPEG SOFn), изображение квадратное. Возвращает тип по
 * содержимому.
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
  const size = logoDimensions(data, detected)
  if (!size || size.width === 0 || size.height === 0) {
    throw new LogoInvalidError('Corrupted or unreadable image header')
  }
  if (size.width !== size.height) throw new LogoNotSquareError(size.width, size.height)
  return detected
}
