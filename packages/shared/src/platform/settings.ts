import { z } from 'zod'

import { dateToZonedInput, zonedInputToDate } from '../datetime/datetime'

/**
 * Реестр настроек платформы (22.3.1, ADR-22-3-1, D-20): ключ → схема Zod, значение по умолчанию
 * (равно поведению до 22.3.1), раздел экрана и где применяется. Ключ вне реестра не пишется и не
 * читается. Секретов в реестре нет по построению: токены, пароли и адреса остаются в env.
 * Добавление ключа — правка реестра и ADR, без миграции.
 */

/** В строке есть управляющий символ (код ≤ 0x1F или 0x7F): перевод строки, табуляция, NUL. */
export function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0)!
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

export const NO_CONTROL_MESSAGE = 'Недопустимые управляющие символы'

/** Текст без управляющих символов и переводов строк (проверка до `trim`). */
const text = (max: number) =>
  z
    .string()
    .refine((v) => !hasControlChars(v), NO_CONTROL_MESSAGE)
    .trim()
    .min(1)
    .max(max)

export const PLATFORM_SETTING_SECTIONS = ['general', 'limits'] as const
export type PlatformSettingSection = (typeof PLATFORM_SETTING_SECTIONS)[number]

export const PLATFORM_SETTINGS = {
  'general.platformName': {
    schema: text(60),
    default: 'Volley Time' as string,
    section: 'general',
    appliesTo: 'web',
  },
  'general.supportContact': {
    schema: text(120).nullable(),
    default: null as string | null,
    section: 'general',
    appliesTo: 'web',
  },
  'eventBalance.newOrganizationGrant': {
    schema: z.number().int().min(1).max(1000),
    default: 5 as number,
    section: 'limits',
    appliesTo: 'web',
  },
  'events.maxPublishedPerDay': {
    schema: z.number().int().min(1).max(50).nullable(),
    default: null as number | null,
    section: 'limits',
    appliesTo: 'web',
  },
  'bot.callbackLimit': {
    schema: z.number().int().min(1).max(100),
    default: 8 as number,
    section: 'limits',
    appliesTo: 'bot',
  },
  'bot.callbackWindowSeconds': {
    schema: z.number().int().min(1).max(300),
    default: 10 as number,
    section: 'limits',
    appliesTo: 'bot',
  },
} as const

export type PlatformSettingKey = keyof typeof PLATFORM_SETTINGS
export const PLATFORM_SETTING_KEYS = Object.keys(PLATFORM_SETTINGS) as PlatformSettingKey[]

/** Типизированные значения всех настроек (после применения умолчаний). */
export interface PlatformSettingsValues {
  'general.platformName': string
  'general.supportContact': string | null
  'eventBalance.newOrganizationGrant': number
  'events.maxPublishedPerDay': number | null
  'bot.callbackLimit': number
  'bot.callbackWindowSeconds': number
}

export const isPlatformSettingKey = (key: string): key is PlatformSettingKey =>
  Object.prototype.hasOwnProperty.call(PLATFORM_SETTINGS, key)

/** Значения по умолчанию всех ключей. */
export function platformSettingDefaults(): PlatformSettingsValues {
  return Object.fromEntries(
    PLATFORM_SETTING_KEYS.map((k) => [k, PLATFORM_SETTINGS[k].default]),
  ) as unknown as PlatformSettingsValues
}

/** Проверить значение ключа реестра; `ok: false` — сообщение первой ошибки схемы. */
export function parsePlatformSetting(
  key: PlatformSettingKey,
  value: unknown,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const parsed = PLATFORM_SETTINGS[key].schema.safeParse(value)
  if (parsed.success) return { ok: true, value: parsed.data }
  return { ok: false, message: parsed.error.issues[0]?.message ?? 'Недопустимое значение' }
}

/** Канонический JSON скалярных значений реестра — сравнение «равно действующему» (no-op). */
export const canonicalSettingValue = (value: unknown): string => JSON.stringify(value ?? null)

/** Ключи, которые читает бот (`bot.*`). */
export const BOT_SETTING_KEYS = ['bot.callbackLimit', 'bot.callbackWindowSeconds'] as const

/**
 * Ответ `GET /api/internal/bot/settings`: только ключи `bot.*`. Бот валидирует им ответ web; при
 * невалидном ответе берёт значения по умолчанию (8 нажатий за 10 с).
 */
export const BotSettingsResponseSchema = z.object({
  settings: z.object({
    'bot.callbackLimit': PLATFORM_SETTINGS['bot.callbackLimit'].schema,
    'bot.callbackWindowSeconds': PLATFORM_SETTINGS['bot.callbackWindowSeconds'].schema,
  }),
})
export type BotSettings = z.infer<typeof BotSettingsResponseSchema>['settings']

export const BOT_SETTINGS_DEFAULTS: BotSettings = {
  'bot.callbackLimit': PLATFORM_SETTINGS['bot.callbackLimit'].default,
  'bot.callbackWindowSeconds': PLATFORM_SETTINGS['bot.callbackWindowSeconds'].default,
}

/** Пауза применения настройки: кэш web (30 с); бот добавляет ещё столько же. */
export const PLATFORM_SETTINGS_APPLY_DELAY_SECONDS = 30

// ---------------------------------------------------------------------------
// Безлимит событий группы (ADR-22-3-1): граница по Минску, исключающая.
// ---------------------------------------------------------------------------

export const UNLIMITED_TIMEZONE = 'Europe/Minsk'
/** Безлимит ставится не дальше «сегодня + 366 дней». */
export const UNLIMITED_MAX_DAYS_AHEAD = 366
/** Дней до окончания, с которых кабинет предупреждает. */
export const UNLIMITED_WARNING_DAYS = 3
export const UNLIMITED_REASON_MIN = 3
export const UNLIMITED_REASON_MAX = 500

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Дата `YYYY-MM-DD` существует в календаре. */
export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!))
  return (
    d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]!
  )
}

/** `YYYY-MM-DD` + дни (календарная арифметика, без часовых поясов). */
export function addIsoDays(date: string, days: number): string {
  const m = ISO_DATE.exec(date)!
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]! + days)).toISOString().slice(0, 10)
}

/** Сегодняшняя календарная дата по Минску. */
export function minskToday(now: Date = new Date()): string {
  return dateToZonedInput(now, UNLIMITED_TIMEZONE).slice(0, 10)
}

/** Исключающая граница безлимита: `D + 1` 00:00 по Минску (последний день `D` включительно). */
export function unlimitedBoundary(lastDay: string): Date {
  return zonedInputToDate(`${addIsoDays(lastDay, 1)}T00:00`, UNLIMITED_TIMEZONE)
}

/** Последний день безлимита по Минску из исключающей границы. */
export function unlimitedLastDay(boundary: Date): string {
  return dateToZonedInput(new Date(boundary.getTime() - 1), UNLIMITED_TIMEZONE).slice(0, 10)
}

/** Безлимит группы в ответе баланса: `until` — последний день по Минску. */
export interface EventBalanceUnlimited {
  until: string
}

// ---------------------------------------------------------------------------
// Формы ответов `/api/platform/settings`
// ---------------------------------------------------------------------------

export interface PlatformSettingView {
  value: unknown
  default: unknown
  /** `0` — строки нет (значение по умолчанию). */
  version: number
  updatedAt: string | null
  updatedBy: { id: number; name: string | null } | null
}

export interface PlatformSettingsReadonly {
  payments: {
    currency: string
    model: 'manual_requests'
    onlinePayments: false
    bankDetails: null
  }
  general: { region: string }
  security: { authRateLimit: boolean; rootAuditLog: boolean; trustedProxy: boolean }
  integrations: {
    telegramBot: boolean
    telegramLoginWidget: boolean
    smtp: boolean
    sentry: boolean
    scheduler: boolean
  }
  featureFlags: { name: string; enabled: boolean }[]
}

export interface PlatformSettingsResponse {
  settings: Record<PlatformSettingKey, PlatformSettingView>
  readonly: PlatformSettingsReadonly
  applyDelaySeconds: number
}

export interface PlatformSettingsChange {
  key: string
  value: unknown
  version: number
}

export interface PlatformSettingsHistoryEntry {
  id: number
  createdAt: string
  actor: { id: number; name: string | null } | null
  key: string
  oldValue: unknown
  newValue: unknown
}

export interface PlatformUnlimitedResult {
  until: string | null
  active: boolean
}
