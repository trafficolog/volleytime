import { readPublicEvent } from '@volley-time/core'
import { buildBotDeeplink } from '@volley-time/shared'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['public'],
    summary: 'Публичная страница события (P-17)',
    description:
      'Без авторизации. slug — непрозрачный идентификатор события (12 hex-символов). Отдаёт только то, ' +
      'что показывает страница: данные события, счётчики мест, инициалы записавшихся (без имён, ников, ' +
      'аватаров, уровней и оплат), цену одного места (тот же расчёт, что GET …/events/{id}/price; ' +
      'у отменённого события — null) и ссылку на бота. Черновик, группа не в статусе active и ' +
      'неизвестный slug отвечают одинаково: 404.',
    parameters: [
      {
        in: 'path',
        name: 'slug',
        required: true,
        schema: { type: 'string' },
      },
    ],
    responses: {
      200: {
        description: 'Событие: { slug, event, group, price, roster, indexable, telegramUrl }',
      },
      404: { description: 'Событие не найдено' },
      429: { description: 'Слишком много запросов (rate_limited)' },
    },
  },
})

/**
 * Публичное событие по slug (20.6.1, P-17). Маршрут без опции уровня в составе: уровни игроков публичная
 * страница не показывает (решение владельца 2026-10-14, 20.4.10) — состав читает `readPublicEvent`.
 */
export default defineApiHandler(async (event) => {
  const view = await readPublicEvent(getRouterParam(event, 'slug') ?? '')
  // JSON-ответ не индексируется; индексирование HTML-страницы решает она сама (`indexable`)
  setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
  if (!view) {
    setResponseHeader(event, 'cache-control', 'no-store')
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  // публичные данные одинаковы для всех посетителей: короткий общий кеш (занятость меняется)
  setResponseHeader(
    event,
    'cache-control',
    'public, max-age=15, s-maxage=15, stale-while-revalidate=30',
  )
  const { startParam, ...rest } = view
  let telegramUrl: string | null = null
  try {
    telegramUrl = buildBotDeeplink(getServerConfig().telegramBotUsername, startParam)
  } catch {
    // бот не настроен: страница работает, кнопка записи недоступна
    console.error('[config] TELEGRAM_BOT_USERNAME is not configured')
  }
  return { ...rest, telegramUrl }
})
