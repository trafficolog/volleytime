import {
  cityCatalogPath,
  formatEventDate,
  groupGeoSummary,
  type PublicCatalogView,
  type PublicGroupPageView,
} from '@volley-time/shared'

/**
 * Адрес каталога города (24.2.1): `/<город>` для города справочника, иначе `/volleyball/<город>`.
 * Адрес страницы группы — `view.path` из ответа API (`/{город}/{группа}` или `/g/<slug>`).
 */
export const catalogPath = cityCatalogPath

/** Заголовок каталога (W-14 «Волейбол в {город}»): без склонения города — «в городе {город}». */
export const catalogTitle = (city: string) => `Волейбол в городе ${city} — группы и тренировки`

export function groupGeoText(view: PublicGroupPageView): string {
  return groupGeoSummary(view, (iso) => formatEventDate(iso, view.group.timezone))
}

type JsonLd = Record<string, unknown>

/**
 * schema.org страницы группы (W-14): SportsActivityLocation (группа, город, залы), Event на каждое
 * ближайшее открытое событие и FAQPage из секции FAQ. Только данные, видимые на странице.
 */
export function groupPageJsonLd(view: PublicGroupPageView, origin: string): JsonLd[] {
  const url = `${origin}${view.path}`
  const venues = view.sections.find((s) => s.kind === 'venues')
  const venueList = venues?.kind === 'venues' ? venues.venues : []
  const address = (street: string | null) => ({
    '@type': 'PostalAddress',
    ...(street ? { streetAddress: street } : {}),
    ...(view.group.city ? { addressLocality: view.group.city } : {}),
    ...(view.group.district ? { addressRegion: view.group.district } : {}),
  })
  const location: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    '@id': `${url}#group`,
    name: view.group.name,
    description: view.meta.description,
    url,
    sport: 'Volleyball',
    address: address(venueList[0]?.address ?? null),
    ...(view.group.logoUpdatedAt
      ? { logo: `${origin}/api/organizations/${view.group.id}/logo` }
      : {}),
    ...(venueList.length > 1
      ? {
          containsPlace: venueList.map((v) => ({
            '@type': 'SportsActivityLocation',
            name: v.name,
            address: address(v.address),
          })),
        }
      : {}),
  }
  const out: JsonLd[] = [location]
  const schedule = view.sections.find((s) => s.kind === 'schedule')
  for (const e of schedule?.kind === 'schedule' ? schedule.events : []) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: e.title,
      startDate: e.startsAt,
      endDate: e.endsAt,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      url: `${origin}/e/${e.publicSlug}`,
      sport: 'Volleyball',
      organizer: { '@id': `${url}#group` },
      location: {
        '@type': 'Place',
        name: e.place.name ?? view.group.name,
        address: address(e.place.address),
      },
    })
  }
  const faq = view.sections.find((s) => s.kind === 'faq')
  if (faq?.kind === 'faq' && faq.items.length > 0) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.items.map((i) => ({
        '@type': 'Question',
        name: i.question,
        acceptedAnswer: { '@type': 'Answer', text: i.answer },
      })),
    })
  }
  return out
}

/** schema.org каталога: ItemList страниц групп города. */
export function catalogJsonLd(view: PublicCatalogView, origin: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: catalogTitle(view.city),
    itemListElement: view.groups.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${origin}${g.path}`,
      name: g.name,
    })),
  }
}

/** JSON для `<script type="application/ld+json">`: `<` экранируется, тексты группы не закрывают тег. */
export const jsonLdText = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')

/**
 * Клиентский переход на прежний адрес группы (24.2.1): API ищет только по действующему slug и
 * отвечает 404, а историю адресов знает серверный middleware `group-address`. Поэтому клиентский
 * 404 вне гидратации повторяем полным переходом: сервер ответит 301 на действующий адрес или
 * отрендерит 404 сам (тогда это гидратация, и повтора нет).
 */
export function reloadForPreviousAddress(state: {
  client: boolean
  hydrating: boolean
  status: number | undefined
}): boolean {
  return state.client && !state.hydrating && state.status === 404
}
