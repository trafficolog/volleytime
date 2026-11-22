import { z } from 'zod'

/**
 * Контракт страницы группы (24.1.1, W-13, решение D-24). Один источник формы данных для
 * конструктора кабинета (24.1.1), API и публичного рендера (24.1.2).
 *
 * Хранится только содержимое, которое пишет владелец: тексты, порядок и включение секций, выбор
 * залов, FAQ, мета. Город, район, уровни, логотип, режим записи и ближайшие события берутся из
 * настроек и данных группы в момент чтения и в строке страницы не дублируются.
 */

/** Секции в порядке по умолчанию (W-13). Порядок на странице — порядок массива `sections`. */
export const GROUP_PAGE_SECTION_KINDS = [
  'cover',
  'about',
  'schedule',
  'formats',
  'prices',
  'venues',
  'join',
  'faq',
] as const
export type GroupPageSectionKind = (typeof GROUP_PAGE_SECTION_KINDS)[number]

/**
 * Жёсткие пределы (символы после trim). Превышение — 422; это защита хранилища и рендера,
 * а не SEO-рекомендация: рекомендации — `GROUP_PAGE_META_RECOMMENDED`, только предупреждения.
 */
export const GROUP_PAGE_LIMITS = {
  headline: 80,
  subtitle: 160,
  about: 2000,
  formats: 1000,
  prices: 1000,
  join: 1000,
  faqItems: 15,
  faqQuestion: 200,
  faqAnswer: 1000,
  venues: 10,
  metaTitle: 120,
  metaDescription: 320,
} as const

/** Рекомендуемые длины мета-тегов: вне диапазона — предупреждение, сохранение не блокируется (D-24). */
export const GROUP_PAGE_META_RECOMMENDED = {
  titleMin: 10,
  titleMax: 60,
  descriptionMin: 50,
  descriptionMax: 160,
} as const

/** Секция «Расписание» показывает столько ближайших событий (D-24). */
export const GROUP_PAGE_SCHEDULE_EVENTS = 5

/** Необязательный текст: trim, пустая строка → null (null — «не задано» / «по умолчанию»). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === '' ? null : v))

const requiredText = (max: number) => z.string().trim().min(1).max(max)

const base = { enabled: z.boolean() }

export const GroupPageSection = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('cover'),
      ...base,
      /** null — название группы. */
      headline: optionalText(GROUP_PAGE_LIMITS.headline),
      subtitle: optionalText(GROUP_PAGE_LIMITS.subtitle),
    })
    .strict(),
  z
    .object({ kind: z.literal('about'), ...base, text: optionalText(GROUP_PAGE_LIMITS.about) })
    .strict(),
  z.object({ kind: z.literal('schedule'), ...base }).strict(),
  z
    .object({ kind: z.literal('formats'), ...base, text: optionalText(GROUP_PAGE_LIMITS.formats) })
    .strict(),
  z
    .object({ kind: z.literal('prices'), ...base, text: optionalText(GROUP_PAGE_LIMITS.prices) })
    .strict(),
  z
    .object({
      kind: z.literal('venues'),
      ...base,
      /** Залы группы в порядке показа; проверка принадлежности — на сервере. */
      venueIds: z
        .array(z.number().int().positive())
        .max(GROUP_PAGE_LIMITS.venues)
        .refine((ids) => new Set(ids).size === ids.length, 'venueIds must be unique'),
    })
    .strict(),
  z
    .object({
      kind: z.literal('join'),
      ...base,
      /** null — текст по умолчанию из режима записи группы (`defaultJoinText`). */
      text: optionalText(GROUP_PAGE_LIMITS.join),
    })
    .strict(),
  z
    .object({
      kind: z.literal('faq'),
      ...base,
      items: z
        .array(
          z
            .object({
              question: requiredText(GROUP_PAGE_LIMITS.faqQuestion),
              answer: requiredText(GROUP_PAGE_LIMITS.faqAnswer),
            })
            .strict(),
        )
        .max(GROUP_PAGE_LIMITS.faqItems),
    })
    .strict(),
])
export type GroupPageSection = z.output<typeof GroupPageSection>

/**
 * Содержимое страницы: тело PUT и поле `content` ответа. Все восемь секций ровно по одному разу;
 * порядок массива — порядок на странице.
 */
export const GroupPageContent = z
  .object({
    sections: z
      .array(GroupPageSection)
      .length(GROUP_PAGE_SECTION_KINDS.length)
      .refine(
        (s) => new Set(s.map((x) => x.kind)).size === GROUP_PAGE_SECTION_KINDS.length,
        'each section kind must appear exactly once',
      ),
    /** null — `defaultMetaTitle`. */
    metaTitle: optionalText(GROUP_PAGE_LIMITS.metaTitle),
    /** null — `defaultMetaDescription`. */
    metaDescription: optionalText(GROUP_PAGE_LIMITS.metaDescription),
  })
  .strict()
export type GroupPageContent = z.output<typeof GroupPageContent>
export type GroupPageContentInput = z.input<typeof GroupPageContent>

/** Страница без строки в БД: все секции включены, в порядке W-13, тексты не заданы. */
export function defaultGroupPageContent(): GroupPageContent {
  return {
    sections: GROUP_PAGE_SECTION_KINDS.map((kind): GroupPageSection => {
      switch (kind) {
        case 'cover':
          return { kind, enabled: true, headline: null, subtitle: null }
        case 'schedule':
          return { kind, enabled: true }
        case 'venues':
          return { kind, enabled: true, venueIds: [] }
        case 'faq':
          return { kind, enabled: true, items: [] }
        default:
          return { kind, enabled: true, text: null }
      }
    }),
    metaTitle: null,
    metaDescription: null,
  }
}

/** Title по умолчанию (D-24): «<Название группы> — волейбол, <Город>»; без города — без хвоста. */
export function defaultMetaTitle(groupName: string, city: string | null): string {
  return city ? `${groupName} — волейбол, ${city}` : `${groupName} — волейбол`
}

export function defaultMetaDescription(groupName: string, city: string | null): string {
  const where = city ? ` в городе ${city}` : ''
  return `${groupName} — волейбольная группа${where}. Расписание игр, цены, залы и запись онлайн.`
}

/** Текст «Как записаться» по умолчанию из режима записи группы (`defaultJoinMode`). */
export function defaultJoinText(joinMode: 'open' | 'invite'): string {
  return joinMode === 'invite'
    ? 'Запись по приглашению: оставьте заявку на игру в Telegram, организатор подтвердит участие.'
    : 'Откройте ближайшую игру в Telegram и нажмите «Записаться» — место закрепится сразу.'
}

export type GroupPageMetaWarning =
  | 'meta.title_too_short'
  | 'meta.title_too_long'
  | 'meta.description_too_short'
  | 'meta.description_too_long'
  | 'meta.city_missing'

/**
 * Проверки мета-тегов (D-24): только предупреждения, сохранение не блокируют. Проверяются
 * действующие значения (заданные или по умолчанию), город — из настроек группы.
 */
export function checkGroupPageMeta(input: {
  title: string
  description: string
  city: string | null
}): GroupPageMetaWarning[] {
  const r = GROUP_PAGE_META_RECOMMENDED
  const warnings: GroupPageMetaWarning[] = []
  const t = input.title.trim().length
  const d = input.description.trim().length
  if (t < r.titleMin) warnings.push('meta.title_too_short')
  if (t > r.titleMax) warnings.push('meta.title_too_long')
  if (d < r.descriptionMin) warnings.push('meta.description_too_short')
  if (d > r.descriptionMax) warnings.push('meta.description_too_long')
  if (!input.city?.trim()) warnings.push('meta.city_missing')
  return warnings
}

/** Ближайшее событие для секции «Расписание». */
export interface GroupPageEvent {
  id: number
  title: string
  startsAt: string
  endsAt: string
  status: 'published' | 'closed'
  joinMode: 'open' | 'invite'
  venueId: number | null
  /** Slug публичной страницы события (`/e/<slug>`). */
  publicSlug: string
}

export interface GroupPageVenue {
  id: number
  name: string
  address: string | null
}

/** Ответ GET/PUT `/api/organizations/{orgId}/group-page`: `{ page: GroupPageView }`. */
export interface GroupPageView {
  /** Сохранённое содержимое или `defaultGroupPageContent()`, если строки нет. */
  content: GroupPageContent
  /** Строки нет: страница ещё не сохранялась. */
  isDefault: boolean
  updatedAt: string | null
  /** `organizations.seoIndex`; меняется через `PATCH …/settings { seoIndex }` (владелец). */
  seoIndex: boolean
  group: {
    id: number
    name: string
    slug: string
    city: string | null
    district: string | null
    levels: string[]
    defaultJoinMode: 'open' | 'invite'
    timezone: string
    /** Версия логотипа (ISO); null — логотипа нет. Картинка — `GET …/logo`. */
    logoUpdatedAt: string | null
  }
  /** Активные залы группы: выбор для секции «Зал» и адреса для рендера. */
  venues: GroupPageVenue[]
  /** Ближайшие `GROUP_PAGE_SCHEDULE_EVENTS` событий (опубликованные или закрытые, ещё не начались). */
  upcomingEvents: GroupPageEvent[]
  /** Действующие значения: заданные владельцем или по умолчанию. */
  resolved: { metaTitle: string; metaDescription: string; joinText: string }
  warnings: GroupPageMetaWarning[]
}
