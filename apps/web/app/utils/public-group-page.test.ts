import type { PublicGroupPageView } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import { catalogPath, groupPageJsonLd, jsonLdText } from './public-group-page'

const view: PublicGroupPageView = {
  slug: 'friday',
  path: '/minsk/friday',
  indexable: true,
  updatedAt: '2026-11-01T00:00:00.000Z',
  meta: { title: 'Пятница — волейбол, Минск', description: 'Описание' },
  group: {
    id: 3,
    name: 'Пятница',
    city: 'Минск',
    district: null,
    levels: ['В2'],
    logoUpdatedAt: null,
    shortLink: null,
    timezone: 'Europe/Minsk',
  },
  sections: [
    { kind: 'venues', venues: [{ name: 'Зал', address: 'ул. Мира, 1' }] },
    {
      kind: 'schedule',
      events: [
        {
          title: 'Игра',
          startsAt: '2026-12-01T16:00:00.000Z',
          endsAt: '2026-12-01T18:00:00.000Z',
          status: 'published',
          publicSlug: 'abcdefabcdef',
          place: { name: 'Зал', address: 'ул. Мира, 1' },
        },
      ],
    },
    { kind: 'faq', items: [{ question: 'Где?', answer: '</script><b>Тут</b>' }] },
  ],
}

/** Task 24.1.2 (W-14): schema.org и адреса публичной страницы группы. */
describe('public group page helpers', () => {
  it('emits SportsActivityLocation, Event and FAQPage from what the page shows', () => {
    const ld = groupPageJsonLd(view, 'https://volleytime.by')
    expect(ld.map((x) => x['@type'])).toEqual(['SportsActivityLocation', 'Event', 'FAQPage'])
    expect(ld[0]).toMatchObject({
      url: 'https://volleytime.by/minsk/friday',
      address: { streetAddress: 'ул. Мира, 1', addressLocality: 'Минск' },
    })
    expect(ld[1]).toMatchObject({
      url: 'https://volleytime.by/e/abcdefabcdef',
      startDate: '2026-12-01T16:00:00.000Z',
    })
    expect(JSON.stringify(ld)).not.toMatch(/price|offers/i)
  })

  it('no FAQ items — no FAQPage', () => {
    const ld = groupPageJsonLd({ ...view, sections: [] }, 'https://x')
    expect(ld.map((x) => x['@type'])).toEqual(['SportsActivityLocation'])
  })

  it('SECURITY: group texts cannot close the JSON-LD script tag', () => {
    const text = jsonLdText(groupPageJsonLd(view, 'https://x'))
    expect(text).not.toContain('</script>')
    expect(JSON.parse(text)[2].mainEntity[0].acceptedAnswer.text).toBe('</script><b>Тут</b>')
  })

  it('catalog path: a catalog city by its slug (24.2.1), another city readable and encoded', () => {
    expect(catalogPath('Пинск')).toBe('/pinsk')
    expect(catalogPath(' марьина  горка ')).toBe('/marina-gorka')
    expect(catalogPath(' Нижний  Новгород ')).toBe(
      `/volleyball/${encodeURIComponent('Нижний Новгород')}`,
    )
  })
})
