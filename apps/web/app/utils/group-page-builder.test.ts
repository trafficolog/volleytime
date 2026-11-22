import { defaultGroupPageContent, type GroupPageContent } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  contentToForm,
  formToPayload,
  isFormDirty,
  issuesToErrors,
  META_WARNING_TEXT,
  moveItem,
  validateForm,
} from './group-page-builder'

const JOIN_DEFAULT = 'Откройте ближайшую игру.'
const ctx = { venueIds: [1, 2], joinText: JOIN_DEFAULT }

function form(content: GroupPageContent = defaultGroupPageContent()) {
  return contentToForm(content, ctx)
}

describe('group page form model', () => {
  it('round-trips the default content to an identical payload', () => {
    expect(formToPayload(form(), JOIN_DEFAULT)).toEqual(defaultGroupPageContent())
  })

  it('shows the resolved default join text and sends null while it is unchanged', () => {
    const f = form()
    const join = f.sections.find((s) => s.kind === 'join')!
    expect('text' in join && join.text).toBe(JOIN_DEFAULT)
    expect(formToPayload(f, JOIN_DEFAULT).sections.find((s) => s.kind === 'join')).toMatchObject({
      text: null,
    })
    if ('text' in join) join.text = 'Пишите в чат'
    expect(formToPayload(f, JOIN_DEFAULT).sections.find((s) => s.kind === 'join')).toMatchObject({
      text: 'Пишите в чат',
    })
  })

  it('trims text and turns blank text into null', () => {
    const f = form()
    const about = f.sections.find((s) => s.kind === 'about')!
    if ('text' in about) about.text = '   '
    f.metaTitle = '  Мой заголовок  '
    const payload = formToPayload(f, JOIN_DEFAULT)
    expect(payload.sections.find((s) => s.kind === 'about')).toMatchObject({ text: null })
    expect(payload.metaTitle).toBe('Мой заголовок')
  })

  it('drops venues that are no longer active venues of the group', () => {
    const content = defaultGroupPageContent()
    const venues = content.sections.find((s) => s.kind === 'venues')!
    if (venues.kind === 'venues') venues.venueIds = [2, 99]
    expect(
      formToPayload(form(content), JOIN_DEFAULT).sections.find((s) => s.kind === 'venues'),
    ).toMatchObject({ venueIds: [2] })
  })

  it('detects unsaved changes against the saved content and not for equivalent edits', () => {
    const saved = defaultGroupPageContent()
    const f = form(saved)
    expect(isFormDirty(f, saved, ctx)).toBe(false)
    f.metaDescription = 'Новое описание'
    expect(isFormDirty(f, saved, ctx)).toBe(true)
    f.metaDescription = ''
    expect(isFormDirty(f, saved, ctx)).toBe(false)
  })
})

describe('moveItem', () => {
  it('moves an element by one and ignores moves past the edges', () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3])
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 3, 2])
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3])
  })
})

describe('validateForm', () => {
  it('requires both question and answer in every FAQ item', () => {
    const f = form()
    const faq = f.sections.find((s) => s.kind === 'faq')!
    if (faq.kind === 'faq') faq.items.push({ uid: 1, question: 'Вопрос?', answer: '  ' })
    const idx = f.sections.indexOf(faq)
    expect(validateForm(f)).toEqual({ [`sections.${idx}.items.0.answer`]: 'Заполните ответ' })
  })

  it('reports nothing for a valid form', () => {
    expect(validateForm(form())).toEqual({})
  })
})

describe('issuesToErrors', () => {
  it('maps server issues to field keys and a venue error to the venues section', () => {
    const issue = { path: ['sections', 0, 'headline'], message: 'Too big' }
    expect(
      issuesToErrors({ data: { data: { code: 'validation_failed', issues: [issue] } } }, form()),
    ).toEqual({ 'sections.0.headline': 'Слишком длинный текст или неверное значение' })
    const f = form()
    const idx = f.sections.findIndex((s) => s.kind === 'venues')
    expect(issuesToErrors({ data: { data: { code: 'group_page.venue_invalid' } } }, f)).toEqual({
      [`sections.${idx}.venueIds`]: 'Выберите залы из списка залов группы',
    })
  })

  it('returns nothing for unrelated errors', () => {
    expect(issuesToErrors(new Error('x'), form())).toEqual({})
  })
})

describe('meta warning texts', () => {
  it('has a text for each warning code', () => {
    expect(Object.keys(META_WARNING_TEXT).sort()).toEqual([
      'meta.city_missing',
      'meta.description_too_long',
      'meta.description_too_short',
      'meta.title_too_long',
      'meta.title_too_short',
    ])
  })
})
