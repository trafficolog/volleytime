/**
 * Логотип группы (21.2.16). Адрес фиксирован: `/api/organizations/{id}/logo`; `?v=` — версия
 * (время загрузки), чтобы после замены браузер не показывал прежнюю картинку. Нет версии —
 * логотипа нет, показывается монограмма (`group-monogram.ts`).
 */
export const LOGO_ACCEPT = 'image/png,image/jpeg'
export const LOGO_MAX_BYTES = 524_288
export const LOGO_MAX_LABEL = '512 КБ'

export function groupLogoUrl(
  orgId: number,
  logoUpdatedAt: string | Date | null | undefined,
): string | null {
  if (!logoUpdatedAt) return null
  const version = new Date(logoUpdatedAt).getTime()
  if (!Number.isFinite(version)) return null
  return `/api/organizations/${orgId}/logo?v=${version}`
}

/** Первичная проверка файла в браузере; окончательно файл проверяет сервер по содержимому. */
export function validateLogoFile(file: {
  name: string
  size: number
  type: string
}): string | null {
  if (file.size === 0) return 'Файл пустой'
  if (file.size > LOGO_MAX_BYTES) return `Файл больше ${LOGO_MAX_LABEL}: выберите меньший логотип`
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    return 'Нужен файл PNG или JPEG (SVG не поддерживается)'
  }
  return null
}

/** Ссылка в виде, который видит организатор: `volleytime.by/<имя>`. */
export const SHORT_LINK_PREFIX = 'volleytime.by/'
export const SHORT_LINK_HINT =
  'От 3 до 32 знаков: строчные латинские буквы, цифры и дефис (не в начале, не в конце и не двойной).'

/** Проверка адреса в браузере (формат); занятость и зарезервированные слова проверяет сервер. */
export function validateShortLink(raw: string): string | null {
  const value = raw.trim().toLowerCase()
  if (value.length < 3) return 'Не короче 3 знаков'
  if (value.length > 32) return 'Не длиннее 32 знаков'
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value) || value.includes('--')) {
    return 'Строчные латинские буквы, цифры и дефис; дефис не в начале, не в конце и не двойной'
  }
  return null
}
