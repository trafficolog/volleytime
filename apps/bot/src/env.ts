import { timingSafeEqual } from 'node:crypto'

const isProduction = process.env.NODE_ENV === 'production'

/** Обязательная переменная (в production — всегда, в dev допускается дефолт). */
const required = (key: string): string => {
  const v = process.env[key]
  if (!v) throw new Error(`${key} is not set`)
  return v
}

/** В production дефолтов для секретов нет (Task 8.8.2). */
const requiredInProduction = (key: string, devDefault: string): string => {
  const v = process.env[key]
  if (v) return v
  if (isProduction) throw new Error(`${key} is not set (required in production)`)
  return devDefault
}

export const env = {
  BOT_TOKEN: required('TELEGRAM_BOT_TOKEN'),
  BOT_MODE: process.env.BOT_MODE ?? 'polling',
  WEB_URL: requiredInProduction('WEB_URL', 'http://localhost:3000'),
  INTERNAL_SECRET: requiredInProduction('BOT_INTERNAL_SECRET', 'dev-internal-secret'),
  INTERNAL_PORT: Number(process.env.BOT_INTERNAL_PORT ?? 3001),
  WEBHOOK_URL: process.env.WEBHOOK_URL ?? '',
  WEBHOOK_SECRET_TOKEN: requiredInProduction('WEBHOOK_SECRET_TOKEN', 'dev-webhook-token'),
  WEBHOOK_PORT: Number(process.env.WEBHOOK_PORT ?? 8443),
} as const

/** Сравнение секретов за постоянное время (защита от timing attack, Task 8.8.2). */
export function secretsMatch(expected: string, got: unknown): boolean {
  if (typeof got !== 'string' || got.length === 0) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  if (a.length !== b.length) {
    // выравниваем длину, чтобы время сравнения не зависело от длины входа
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}
