// @vitest-environment happy-dom
import type { PublicGroupPageView } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PublicGroupPage from './PublicGroupPage.vue'

const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' },
  GroupLogo: { template: '<span data-logo />' },
}

function data(over: Partial<PublicGroupPageView> = {}): PublicGroupPageView {
  return {
    slug: 'friday',
    indexable: true,
    updatedAt: '2026-11-01T00:00:00.000Z',
    meta: { title: 't', description: 'd' },
    group: {
      id: 3,
      name: 'Пятница',
      city: 'Минск',
      district: 'Центр',
      levels: ['В2'],
      logoUpdatedAt: null,
      shortLink: 'friday-minsk',
      timezone: 'Europe/Minsk',
    },
    sections: [
      { kind: 'cover', headline: 'Волейбол по пятницам', subtitle: 'Для всех уровней' },
      {
        kind: 'schedule',
        events: [
          {
            title: 'Игра',
            startsAt: '2026-12-04T16:00:00.000Z',
            endsAt: '2026-12-04T18:00:00.000Z',
            status: 'published',
            publicSlug: 'abcdefabcdef',
            place: { name: 'Зал', address: null },
          },
        ],
      },
      { kind: 'prices', text: 'Разовое — 15 BYN' },
      { kind: 'faq', items: [{ question: 'Где?', answer: 'В зале' }] },
    ],
    ...over,
  }
}

const mountPage = (d = data()) =>
  mount(PublicGroupPage, { props: { data: d, host: 'volleytime.by' }, global: { stubs } })

/** Task 24.1.2 (W-14): публичная страница группы. */
describe('PublicGroupPage', () => {
  it('renders one h1 from the cover and the sections in the server order', () => {
    const w = mountPage()
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.find('h1').text()).toBe('Волейбол по пятницам')
    expect(w.findAll('[data-gp-block]').map((b) => b.attributes('data-gp-block'))).toEqual([
      'cover',
      'schedule',
      'prices',
      'faq',
    ])
  })

  it('links events to their public pages and shows the short link address', () => {
    const w = mountPage()
    expect(w.find('[data-gp-block="schedule"] a').attributes('href')).toBe('/e/abcdefabcdef')
    expect(w.find('[data-testid="group-address"]').text()).toBe('volleytime.by/friday-minsk')
    expect(w.find('[data-gp-block="prices"]').text()).toContain('Разовое — 15 BYN')
  })

  it('shows the geo text and links the city catalog only for an indexable page', () => {
    const w = mountPage()
    expect(w.find('[data-testid="geo-text"]').text()).toContain('в городе Минск')
    expect(w.find('[data-testid="catalog-link"]').attributes('href')).toBe(
      `/volleyball/${encodeURIComponent('Минск')}`,
    )
    expect(
      mountPage(data({ indexable: false }))
        .find('[data-testid="catalog-link"]')
        .exists(),
    ).toBe(false)
  })

  it('without a cover section the group name is the heading', () => {
    const d = data()
    d.sections = d.sections.filter((s) => s.kind !== 'cover')
    expect(mountPage(d).find('h1').text()).toBe('Пятница')
  })
})
