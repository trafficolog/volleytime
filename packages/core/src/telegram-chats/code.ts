import { createHash, randomInt } from 'node:crypto'

/** Срок действия кода привязки: организатор успевает дойти до чата, код не лежит в истории долго. */
export const LINK_CODE_TTL_MS = 15 * 60_000

/** Без похожих символов (I, L, O, 0, 1): код вводят руками из кабинета в чат. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

/** Случайный код ≈ 39,6 бит (`crypto.randomInt`), без разделителей. */
export function generateLinkCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

/** Вид для показа: `ABCD-EFGH`. */
export const formatLinkCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`

/**
 * Код из ввода пользователя (`ABCD-EFGH`, регистр и пробелы не важны) или `null`, если по форме он
 * не может быть выданным кодом: такой ввод не доходит до базы.
 */
export function normalizeLinkCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 32) return null
  const code = input.toUpperCase().replace(/[\s-]/g, '')
  if (code.length !== CODE_LENGTH) return null
  for (const ch of code) if (!ALPHABET.includes(ch)) return null
  return code
}

/** В базе хранится только SHA-256 кода: чтение таблицы не даёт действующего кода. */
export const hashLinkCode = (code: string): string =>
  createHash('sha256').update(code, 'utf8').digest('hex')
