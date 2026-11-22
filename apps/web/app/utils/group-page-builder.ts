import {
  GROUP_PAGE_LIMITS,
  type GroupPageContent,
  type GroupPageContentInput,
  type GroupPageMetaWarning,
  type GroupPageSectionKind,
} from '@volley-time/shared'

/**
 * Модель формы конструктора страницы группы (24.1.1, W-13, D-24). Форма хранит тексты строками
 * (пусто = «не задано»), у пунктов FAQ есть локальный `uid` для стабильных ключей списка.
 * В API уходит `GroupPageContent` (`formToPayload`): пустые тексты — null, «Как записаться»
 * без правок — null (текст по режиму записи).
 */
export interface FaqItemForm {
  uid: number
  question: string
  answer: string
}

export type SectionForm =
  | { kind: 'cover'; enabled: boolean; headline: string; subtitle: string }
  | { kind: 'about' | 'formats' | 'prices' | 'join'; enabled: boolean; text: string }
  | { kind: 'schedule'; enabled: boolean }
  | { kind: 'venues'; enabled: boolean; venueIds: number[] }
  | { kind: 'faq'; enabled: boolean; items: FaqItemForm[] }

export interface PageForm {
  sections: SectionForm[]
  metaTitle: string
  metaDescription: string
}

/** Данные группы, нужные, чтобы привести сохранённое содержимое к форме и обратно. */
export interface FormContext {
  /** Активные залы группы: выбранные залы вне списка отбрасываются. */
  venueIds: number[]
  /** Действующий текст «Как записаться» по умолчанию (`resolved.joinText` / `defaultJoinText`). */
  joinText: string
}

export const SECTION_TITLES: Record<GroupPageSectionKind, string> = {
  cover: 'Обложка',
  about: 'Коротко о группе',
  schedule: 'Расписание',
  formats: 'Форматы и уровни',
  prices: 'Цены',
  venues: 'Зал',
  join: 'Как записаться',
  faq: 'Вопросы и ответы',
}

export const META_WARNING_TEXT: Record<GroupPageMetaWarning, string> = {
  'meta.title_too_short': 'Заголовок короче 10 символов: поисковику будет мало для сниппета.',
  'meta.title_too_long': 'Заголовок длиннее 60 символов: поисковик может его обрезать.',
  'meta.description_too_short': 'Описание короче 50 символов: поисковик может заменить его своим.',
  'meta.description_too_long': 'Описание длиннее 160 символов: поисковик может его обрезать.',
  'meta.city_missing':
    'В настройках группы не указан город: заголовок по умолчанию без города хуже находится в поиске.',
}

let uidSeq = 0
export const nextUid = () => ++uidSeq

export function contentToForm(content: GroupPageContent, ctx: FormContext): PageForm {
  return {
    sections: content.sections.map((s): SectionForm => {
      switch (s.kind) {
        case 'cover':
          return {
            kind: 'cover',
            enabled: s.enabled,
            headline: s.headline ?? '',
            subtitle: s.subtitle ?? '',
          }
        case 'schedule':
          return { kind: 'schedule', enabled: s.enabled }
        case 'venues':
          return {
            kind: 'venues',
            enabled: s.enabled,
            venueIds: s.venueIds.filter((id) => ctx.venueIds.includes(id)),
          }
        case 'faq':
          return {
            kind: 'faq',
            enabled: s.enabled,
            items: s.items.map((i) => ({ uid: nextUid(), ...i })),
          }
        case 'join':
          return { kind: 'join', enabled: s.enabled, text: s.text ?? ctx.joinText }
        default:
          return { kind: s.kind, enabled: s.enabled, text: s.text ?? '' }
      }
    }),
    metaTitle: content.metaTitle ?? '',
    metaDescription: content.metaDescription ?? '',
  }
}

const orNull = (value: string): string | null => value.trim() || null

export function formToPayload(form: PageForm, joinDefault: string): GroupPageContent {
  return {
    sections: form.sections.map((s): GroupPageContent['sections'][number] => {
      switch (s.kind) {
        case 'cover':
          return {
            kind: 'cover',
            enabled: s.enabled,
            headline: orNull(s.headline),
            subtitle: orNull(s.subtitle),
          }
        case 'schedule':
          return { kind: 'schedule', enabled: s.enabled }
        case 'venues':
          return { kind: 'venues', enabled: s.enabled, venueIds: [...s.venueIds] }
        case 'faq':
          return {
            kind: 'faq',
            enabled: s.enabled,
            items: s.items.map((i) => ({ question: i.question.trim(), answer: i.answer.trim() })),
          }
        case 'join': {
          const text = orNull(s.text)
          return { kind: 'join', enabled: s.enabled, text: text === joinDefault ? null : text }
        }
        default:
          return { kind: s.kind, enabled: s.enabled, text: orNull(s.text) }
      }
    }),
    metaTitle: orNull(form.metaTitle),
    metaDescription: orNull(form.metaDescription),
  }
}

/** Есть ли несохранённые правки: сравнение действующего содержимого формы с сохранённым. */
export function isFormDirty(form: PageForm, saved: GroupPageContent, ctx: FormContext): boolean {
  const baseline = formToPayload(contentToForm(saved, ctx), ctx.joinText)
  return JSON.stringify(formToPayload(form, ctx.joinText)) !== JSON.stringify(baseline)
}

export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  const next = [...list]
  if (target < 0 || target >= next.length) return next
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  return next
}

/** Ключ поля формы для ошибок: `sections.<индекс>.<поле>` (индекс — позиция в форме). */
export function validateForm(form: PageForm): Record<string, string> {
  const errors: Record<string, string> = {}
  form.sections.forEach((s, i) => {
    if (s.kind !== 'faq') return
    s.items.forEach((item, j) => {
      if (!item.question.trim()) errors[`sections.${i}.items.${j}.question`] = 'Заполните вопрос'
      if (!item.answer.trim()) errors[`sections.${i}.items.${j}.answer`] = 'Заполните ответ'
    })
  })
  return errors
}

/** Ошибки сохранения (422) → ошибки полей формы. Прочие ошибки — пустой объект. */
export function issuesToErrors(cause: unknown, form: PageForm): Record<string, string> {
  const data = (cause as { data?: { data?: { code?: string; issues?: unknown } } })?.data?.data
  if (data?.code === 'group_page.venue_invalid') {
    const i = form.sections.findIndex((s) => s.kind === 'venues')
    return i < 0 ? {} : { [`sections.${i}.venueIds`]: 'Выберите залы из списка залов группы' }
  }
  if (data?.code !== 'validation_failed' || !Array.isArray(data.issues)) return {}
  const errors: Record<string, string> = {}
  for (const issue of data.issues as { path?: unknown }[]) {
    if (!Array.isArray(issue.path) || issue.path.length === 0) continue
    const key = issue.path.join('.')
    errors[key] ??= 'Слишком длинный текст или неверное значение'
  }
  return errors
}

export const LIMITS = GROUP_PAGE_LIMITS

export type { GroupPageContentInput }
