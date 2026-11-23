import { describe, expect, it } from 'vitest'

import { defaultGroupPageContent, GROUP_PAGE_SECTION_KINDS } from './contract'
import {
  buildPublicGroupPage,
  cityKey,
  groupGeoSummary,
  sanitizeGroupPageContent,
  type PublicGroupPageInput,
  type PublicGroupPageView,
} from './public'

const group = {
  name: 'Пятничный волейбол',
  city: 'Минск',
  district: 'Центр',
  defaultJoinMode: 'open' as const,
}

function input(content: unknown, extra: Partial<PublicGroupPageInput> = {}): PublicGroupPageInput {
  return { content, group, levels: [], activeVenues: [], events: [], ...extra }
}

function withSection(kind: string, patch: Record<string, unknown>) {
  const c = structuredClone(defaultGroupPageContent()) as unknown as {
    sections: Record<string, unknown>[]
  }
  Object.assign(
    c.sections.find((s) => s.kind === kind)!,
    patch,
  )
  return c
}

/** Task 24.1.2 (W-14): публичная проекция страницы группы. */
describe('public group page projection', () => {
  it('a valid stored page is used as is', () => {
    const c = withSection('prices', { text: 'Разовое — 15 BYN' })
    expect(sanitizeGroupPageContent(c)).toEqual(c)
  })

  it('a section that fails the schema becomes the default of its kind in place, the page survives', () => {
    const c = withSection('prices', { text: 42 }) as { sections: Record<string, unknown>[] }
    c.sections.find((s) => s.kind === 'about')!.text = 'Играем по пятницам'
    const out = sanitizeGroupPageContent(c)
    expect(out.sections.map((s) => s.kind)).toEqual([...GROUP_PAGE_SECTION_KINDS])
    expect(out.sections.find((s) => s.kind === 'prices')).toEqual({
      kind: 'prices',
      enabled: true,
      text: null,
    })
    expect(out.sections.find((s) => s.kind === 'about')).toMatchObject({
      text: 'Играем по пятницам',
    })
  })

  it('garbage, unknown kinds, duplicates and bad meta fall back to defaults without throwing', () => {
    for (const raw of [
      null,
      'x',
      7,
      { sections: 'nope' },
      { sections: [null, { kind: 'evil' }] },
    ]) {
      const out = sanitizeGroupPageContent(raw)
      expect(out.sections.map((s) => s.kind)).toEqual([...GROUP_PAGE_SECTION_KINDS])
      expect(out.metaTitle).toBeNull()
    }
    const dup = defaultGroupPageContent()
    const twice = {
      ...dup,
      sections: [{ kind: 'faq', enabled: false, items: [] }, ...dup.sections],
      metaTitle: { x: 1 },
      metaDescription: '  Свой текст  ',
    }
    const out = sanitizeGroupPageContent(twice)
    expect(out.sections.filter((s) => s.kind === 'faq')).toHaveLength(1)
    expect(out.sections[0]).toMatchObject({ kind: 'faq', enabled: false })
    expect(out.metaTitle).toBeNull()
    expect(out.metaDescription).toBe('Свой текст')
  })

  it('archived or foreign venues are dropped; a venues section without venues is not rendered', () => {
    const c = withSection('venues', { venueIds: [9, 2, 5] })
    const venues = [
      { id: 2, name: 'Зал 2', address: 'ул. Ленина, 1' },
      { id: 5, name: 'Зал 5', address: null },
    ]
    const page = buildPublicGroupPage(input(c, { activeVenues: venues }))
    expect(page.sections.find((s) => s.kind === 'venues')).toEqual({
      kind: 'venues',
      venues: [
        { name: 'Зал 2', address: 'ул. Ленина, 1' },
        { name: 'Зал 5', address: null },
      ],
    })
    const none = buildPublicGroupPage(
      input(withSection('venues', { venueIds: [9] }), { activeVenues: venues }),
    )
    expect(none.sections.some((s) => s.kind === 'venues')).toBe(false)
  })

  it('disabled and empty sections are not rendered; defaults fill cover, join and meta', () => {
    const c = withSection('cover', { enabled: false })
    const page = buildPublicGroupPage(input(c, { group: { ...group, city: null, district: null } }))
    expect(page.sections.map((s) => s.kind)).toEqual(['schedule', 'join'])
    expect(page.meta.title).toBe('Пятничный волейбол — волейбол')
    const full = buildPublicGroupPage(input(undefined))
    expect(full.sections[0]).toEqual({ kind: 'cover', headline: group.name, subtitle: null })
    expect(full.sections.find((s) => s.kind === 'join')).toMatchObject({
      text: expect.stringContaining('Записаться'),
    })
    expect(full.sections.find((s) => s.kind === 'about')).toEqual({
      kind: 'about',
      text: null,
      place: 'Минск, Центр',
    })
  })

  it('prices are only the text the group entered', () => {
    const page = buildPublicGroupPage(input(withSection('prices', { text: 'От 12 BYN' })))
    expect(page.sections.find((s) => s.kind === 'prices')).toEqual({
      kind: 'prices',
      text: 'От 12 BYN',
    })
  })

  it('city key ignores case and spacing', () => {
    expect(cityKey('  Минск ')).toBe(cityKey('минск'))
    expect(cityKey('Нижний   Новгород')).toBe('нижний новгород')
  })

  it('geo summary lists city, levels, venues and the next game', () => {
    const view: PublicGroupPageView = {
      slug: 'g',
      indexable: true,
      updatedAt: '2026-11-01T00:00:00.000Z',
      meta: { title: 't', description: 'd' },
      group: {
        id: 1,
        name: 'Группа',
        city: 'Минск',
        district: null,
        levels: ['В2', 'В3'],
        logoUpdatedAt: null,
        shortLink: null,
        timezone: 'Europe/Minsk',
      },
      sections: [
        { kind: 'venues', venues: [{ name: 'Зал', address: 'пр. Победителей, 5' }] },
        {
          kind: 'schedule',
          events: [
            {
              title: 'Игра',
              startsAt: '2026-12-01T16:00:00.000Z',
              endsAt: '2026-12-01T18:00:00.000Z',
              status: 'published',
              publicSlug: 'abcdefabcdef',
              place: { name: 'Зал', address: null },
            },
          ],
        },
      ],
    }
    expect(groupGeoSummary(view, () => '1 декабря')).toBe(
      'Группа — волейбольная группа в городе Минск. Уровни игроков: В2, В3. ' +
        'Залы: Зал (пр. Победителей, 5). Ближайшая игра: Игра, 1 декабря.',
    )
  })
})
