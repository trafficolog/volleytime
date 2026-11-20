import {
  BOT_SETTINGS_DEFAULTS,
  BotSettingsResponseSchema,
  type BotSettings,
} from '@volley-time/shared'

import { callWeb } from './web-client'

/**
 * Настройки платформы для бота (22.3.1, ADR-22-3-1): лимит нажатий inline-кнопок (`bot.*`). Бот не
 * имеет доступа к БД и читает те же значения через внутренний маршрут web. Снимок хранится в памяти
 * процесса и читается синхронно (нажатие не ждёт сети); истёкший снимок продолжает действовать, пока
 * фоновый запрос не вернётся. Ответ проверяется той же схемой Zod, что и в web; при ошибке сети или
 * невалидном ответе действуют значения по умолчанию (8 нажатий за 10 с), повтор — через TTL.
 */
export const BOT_SETTINGS_TTL_MS = 30_000

let snapshot: BotSettings = BOT_SETTINGS_DEFAULTS
/** Когда снимок получен (мс); `null` — ещё ни разу. Ошибка тоже считается получением: повтор через TTL. */
let fetchedAt: number | null = null
let inFlight: Promise<void> | null = null

/** Обновить снимок в фоне; параллельный запрос не создаётся. Ошибки наружу не выходят. */
export function refreshBotSettings(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const parsed = BotSettingsResponseSchema.safeParse(await callWeb<unknown>('settings'))
      snapshot = parsed.success ? parsed.data.settings : BOT_SETTINGS_DEFAULTS
      if (!parsed.success) console.warn('[bot] platform settings: invalid response, defaults used')
    } catch {
      snapshot = BOT_SETTINGS_DEFAULTS
    } finally {
      fetchedAt = Date.now()
      inFlight = null
    }
  })()
  return inFlight
}

/**
 * Текущий снимок — синхронно, без ожидания сети. Если снимок отсутствует или старше TTL, запускает
 * фоновое обновление и возвращает прежнее значение (по умолчанию — 8 нажатий за 10 с).
 */
export function getBotSettings(now: number = Date.now()): BotSettings {
  if ((fetchedAt === null || now - fetchedAt >= BOT_SETTINGS_TTL_MS) && !inFlight) {
    void refreshBotSettings()
  }
  return snapshot
}

/** Только для тестов: вернуть умолчания и забыть о прежних запросах. */
export function resetBotSettings(): void {
  snapshot = BOT_SETTINGS_DEFAULTS
  fetchedAt = null
  inFlight = null
}
