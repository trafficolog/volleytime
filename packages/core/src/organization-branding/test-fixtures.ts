/** Минимальные настоящие заголовки PNG и JPEG для тестов логотипа (без пикселей). */

/** PNG: сигнатура, IHDR (width x height), заполнитель `pad` байт после заголовка. */
export function pngBytes(width = 64, height = width, pad = 0): Buffer {
  const ihdr = Buffer.alloc(25)
  ihdr.writeUInt32BE(13, 0)
  ihdr.write('IHDR', 4, 'latin1')
  ihdr.writeUInt32BE(width, 8)
  ihdr.writeUInt32BE(height, 12)
  ihdr.set([8, 2, 0, 0, 0], 16) // глубина, тип цвета, сжатие, фильтр, чересстрочность
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), ihdr, Buffer.alloc(pad, 7)])
}

/** JPEG: SOI, APP0 (JFIF), кадр `sof` (C0 baseline, C2 progressive), EOI; `pad` байт перед EOI. */
export function jpegBytes(width = 64, height = width, sof = 0xc0, pad = 0): Buffer {
  const app0 = Buffer.from('ffe000104a46494600010100000100010000', 'hex')
  const frame = Buffer.alloc(19)
  frame.set([0xff, sof, 0x00, 0x11, 0x08])
  frame.writeUInt16BE(height, 5)
  frame.writeUInt16BE(width, 7)
  frame.set([0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01], 9)
  return Buffer.concat([
    Buffer.from('ffd8', 'hex'),
    app0,
    frame,
    Buffer.alloc(pad, 9),
    Buffer.from('ffd9', 'hex'),
  ])
}
