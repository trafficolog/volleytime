export class BrandingError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'BrandingError'
  }
}
/** Логотип не загружен (404). */
export class LogoNotFoundError extends BrandingError {
  constructor() {
    super('logo.not_found', 'Logo not found')
  }
}
/** Файл пуст, не PNG/JPEG по содержимому или тип в заявке не совпадает с байтами (422). */
export class LogoInvalidError extends BrandingError {
  constructor(message: string) {
    super('logo.invalid', message)
  }
}
/** Файл больше лимита (413). */
export class LogoTooLargeError extends BrandingError {
  constructor(maxBytes: number) {
    super('logo.too_large', `Logo is larger than ${maxBytes} bytes`)
  }
}
/** Короткая ссылка не соответствует формату (422). */
export class ShortLinkInvalidError extends BrandingError {
  constructor(message: string) {
    super('short_link.invalid', message)
  }
}
/** Короткая ссылка из списка зарезервированных (422). */
export class ShortLinkReservedError extends BrandingError {
  constructor(value: string) {
    super('short_link.reserved', `Short link "${value}" is reserved`)
  }
}
/** Короткая ссылка занята другой группой (409). */
export class ShortLinkTakenError extends BrandingError {
  constructor(value: string) {
    super('short_link.taken', `Short link "${value}" is already taken`)
  }
}
