import { readPublicGroupPage } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['public'],
    summary: 'Публичная страница группы (W-14)',
    description:
      'Без авторизации. Только публичные поля: включённые и непустые секции, мета, город, уровни, ' +
      'активные залы, ближайшие открытые события (события «по приглашению» не показываются), цены — ' +
      'только текст группы. Без участников, состава и оплат. Выключенная страница ' +
      '(publicPageEnabled), группа не active, удалённая группа и неизвестный slug отвечают одинаково: 404.',
    parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
    responses: {
      200: { description: 'PublicGroupPageView (тип в @volley-time/shared)' },
      404: { description: 'Страница не найдена' },
      429: { description: 'Слишком много запросов (rate_limited)' },
    },
  },
})

/** Публичная страница группы по slug (24.1.2): HTML-страница `/{город}/{группа}` (24.2.1) читает этот ответ. */
export default defineApiHandler(async (event) => {
  const view = await readPublicGroupPage(getRouterParam(event, 'slug') ?? '')
  // JSON не индексируется; индексирование HTML решает страница (`indexable`)
  setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
  if (!view) {
    setResponseHeader(event, 'cache-control', 'no-store')
    throw createError({ statusCode: 404, statusMessage: 'Group page not found' })
  }
  // одинаково для всех посетителей: короткий общий кеш, как у публичного события (20.6.1)
  setResponseHeader(
    event,
    'cache-control',
    'public, max-age=15, s-maxage=15, stale-while-revalidate=30',
  )
  return view
})
