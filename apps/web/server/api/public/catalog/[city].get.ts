import { readPublicCatalog } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['public'],
    summary: 'Каталог групп города (W-14)',
    description:
      'Без авторизации. «Волейбол в городе {город}»: только индексируемые группы (страница ' +
      'опубликована и seoIndex), город без учёта регистра и лишних пробелов. Групп нет — 404.',
    parameters: [{ in: 'path', name: 'city', required: true, schema: { type: 'string' } }],
    responses: {
      200: { description: 'PublicCatalogView: { city, groups }' },
      404: { description: 'В городе нет индексируемых групп' },
      429: { description: 'Слишком много запросов (rate_limited)' },
    },
  },
})

/** Каталог «Волейбол в городе {город}» (24.1.2): HTML-страница `/volleyball/<город>`. */
export default defineApiHandler(async (event) => {
  const view = await readPublicCatalog(getRouterParam(event, 'city', { decode: true }) ?? '')
  setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
  if (!view) {
    setResponseHeader(event, 'cache-control', 'no-store')
    throw createError({ statusCode: 404, statusMessage: 'Catalog not found' })
  }
  setResponseHeader(event, 'cache-control', 'public, max-age=60, s-maxage=60')
  return view
})
