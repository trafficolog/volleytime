import { describe, expect, it } from 'vitest'

import {
  checkGroupPageMeta,
  defaultGroupPageContent,
  defaultJoinText,
  defaultMetaTitle,
  GROUP_PAGE_LIMITS,
  GROUP_PAGE_SECTION_KINDS,
  GroupPageContent,
} from './contract'

type Loose = { sections: Record<string, unknown>[] } & Record<string, unknown>

/** Task 24.1.1 (D-24): контракт страницы группы. */
describe('group page contract', () => {
  const valid = () => structuredClone(defaultGroupPageContent()) as unknown as Loose
  const ok = (c: unknown) => GroupPageContent.safeParse(c).success

  it('default content has all eight sections enabled in W-13 order and passes the schema', () => {
    const d = defaultGroupPageContent()
    expect(d.sections.map((s) => s.kind)).toEqual([...GROUP_PAGE_SECTION_KINDS])
    expect(d.sections.every((s) => s.enabled)).toBe(true)
    expect(GroupPageContent.parse(d)).toEqual(d)
  })

  it('keeps a custom order and trims texts, empty text becomes null', () => {
    const c = valid()
    c.sections.reverse()
    c.sections.find((s) => s.kind === 'about')!.text = '  Играем по средам  '
    c.sections.find((s) => s.kind === 'cover')!.subtitle = '   '
    const parsed = GroupPageContent.parse(c)
    expect(parsed.sections[0]!.kind).toBe('faq')
    expect(parsed.sections.find((s) => s.kind === 'about')).toMatchObject({
      text: 'Играем по средам',
    })
    expect(parsed.sections.find((s) => s.kind === 'cover')).toMatchObject({ subtitle: null })
  })

  it('rejects a missing or duplicated section and unknown keys', () => {
    const missing = valid()
    missing.sections.pop()
    expect(ok(missing)).toBe(false)
    const dup = valid()
    dup.sections[7] = { kind: 'about', enabled: true, text: null }
    expect(ok(dup)).toBe(false)
    expect(ok({ ...valid(), extra: 1 })).toBe(false)
    const extraField = valid()
    extraField.sections[2]!.text = 'x'
    expect(ok(extraField)).toBe(false)
  })

  it('enforces text, FAQ and venue limits', () => {
    const long = valid()
    long.sections[1]!.text = 'a'.repeat(GROUP_PAGE_LIMITS.about + 1)
    expect(ok(long)).toBe(false)

    const faq = valid()
    const item = { question: 'Вопрос?', answer: 'Ответ' }
    faq.sections[7]!.items = Array(GROUP_PAGE_LIMITS.faqItems).fill(item)
    expect(ok(faq)).toBe(true)
    faq.sections[7]!.items = Array(GROUP_PAGE_LIMITS.faqItems + 1).fill(item)
    expect(ok(faq)).toBe(false)

    const emptyAnswer = valid()
    emptyAnswer.sections[7]!.items = [{ question: 'Q', answer: ' ' }]
    expect(ok(emptyAnswer)).toBe(false)

    const venues = valid()
    venues.sections[5]!.venueIds = [1, 1]
    expect(ok(venues)).toBe(false)
    venues.sections[5]!.venueIds = Array.from(
      { length: GROUP_PAGE_LIMITS.venues + 1 },
      (_, i) => i + 1,
    )
    expect(ok(venues)).toBe(false)

    expect(ok({ ...valid(), metaTitle: 'a'.repeat(GROUP_PAGE_LIMITS.metaTitle + 1) })).toBe(false)
    expect(
      ok({ ...valid(), metaDescription: 'a'.repeat(GROUP_PAGE_LIMITS.metaDescription + 1) }),
    ).toBe(false)
  })

  it('default title and join text follow D-24', () => {
    expect(defaultMetaTitle('Волна', 'Минск')).toBe('Волна — волейбол, Минск')
    expect(defaultMetaTitle('Волна', null)).toBe('Волна — волейбол')
    expect(defaultJoinText('open')).not.toBe(defaultJoinText('invite'))
  })

  it('meta checks are warnings for length and missing city', () => {
    const description = 'd'.repeat(100)
    expect(
      checkGroupPageMeta({ title: 'Волна — волейбол, Минск', description, city: 'Минск' }),
    ).toEqual([])
    expect(checkGroupPageMeta({ title: 'Ab', description: 'short', city: null })).toEqual([
      'meta.title_too_short',
      'meta.description_too_short',
      'meta.city_missing',
    ])
    expect(
      checkGroupPageMeta({ title: 't'.repeat(61), description: 'd'.repeat(161), city: ' ' }),
    ).toEqual(['meta.title_too_long', 'meta.description_too_long', 'meta.city_missing'])
  })
})
