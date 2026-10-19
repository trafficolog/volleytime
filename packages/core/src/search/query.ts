/** Минимальная и максимальная длина запроса поиска кабинета (20.5.2). */
export const SEARCH_MIN_LENGTH = 2
export const SEARCH_MAX_LENGTH = 64
/** Сколько строк каждого типа отдаёт поиск (на тип запрашивается на одну больше — признак `more`). */
export const SEARCH_GROUP_LIMIT = 8

/** Пробелы схлопнуты, края обрезаны, длина ограничена. */
export function normalizeSearchQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_LENGTH)
}

export function isSearchQueryValid(normalized: string): boolean {
  return normalized.length >= SEARCH_MIN_LENGTH
}

/** Шаблон для `ILIKE … ESCAPE '\'`: подстрока без интерпретации `%`, `_` и `\` из запроса. */
export function toContainsPattern(normalized: string): string {
  return `%${normalized.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/** Ник можно искать с `@` и без. */
export function stripAt(normalized: string): string {
  return normalized.replace(/^@+/, '')
}
