import { readEventBalanceCatalog } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['public'],
    summary: 'Публичный каталог пакетов баланса событий (лендинг, D-11)',
    description:
      'Без авторизации. Видимые неархивные пакеты каталога Root Admin в порядке витрины: код, ' +
      'количество событий, цена в minor units, валюта и бейдж каталога (popular, discount, ' +
      'best_price или null). Вычисляемых скидок нет (D-19).',
    responses: {
      200: { description: '{ packages: [{ code, units, amount, currency, badge }] }' },
      429: { description: 'Слишком много запросов (rate_limited)' },
    },
  },
})

/** Витрина тарифов лендинга (24.1.4): тот же каталог, что в кабинете организатора. */
export default defineApiHandler(async (event) => {
  setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
  // цены меняет root без деплоя: короткий общий кеш
  setResponseHeader(
    event,
    'cache-control',
    'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
  )
  return { packages: await readEventBalanceCatalog() }
})
