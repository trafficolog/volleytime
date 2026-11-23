import {
  defaultGroupPageContent,
  defaultJoinText,
  defaultMetaDescription,
  defaultMetaTitle,
  GROUP_PAGE_SECTION_KINDS,
  GroupPageContent,
  GroupPageSection,
  type GroupPageSectionKind,
  type GroupPageVenue,
} from './contract'

/**
 * Публичный рендер страницы группы (24.1.2, W-14). Анонимный посетитель получает не ответ
 * конструктора (`GroupPageView`), а эту проекцию: только включённые и непустые секции, только
 * публичные поля. Решения (владелец, 2026-11-23): события «по приглашению» на странице не
 * показываются; архивный зал не показывается; секция «Зал» без залов не рисуется; сохранённые
 * данные, не прошедшие схему, заменяются секциями по умолчанию и страницу не роняют.
 */

/** Событие секции «Расписание»: без id, цен и состава; ссылка — `/e/<publicSlug>`. */
export interface PublicGroupPageEvent {
  title: string
  startsAt: string
  endsAt: string
  status: 'published' | 'closed'
  publicSlug: string
  place: { name: string | null; address: string | null }
}

export interface PublicGroupPageVenue {
  name: string
  address: string | null
}

export type PublicGroupPageSection =
  | { kind: 'cover'; headline: string; subtitle: string | null }
  | { kind: 'about'; text: string | null; place: string | null }
  | { kind: 'schedule'; events: PublicGroupPageEvent[] }
  | { kind: 'formats'; levels: string[]; text: string | null }
  /** Цены — только текст, который ввела группа: суммы событий страница не считает. */
  | { kind: 'prices'; text: string }
  | { kind: 'venues'; venues: PublicGroupPageVenue[] }
  | { kind: 'join'; text: string }
  | { kind: 'faq'; items: { question: string; answer: string }[] }

/** Ответ `GET /api/public/groups/{slug}`. */
export interface PublicGroupPageView {
  slug: string
  /** `organizations.seoIndex`: иначе noindex, страницы нет в sitemap и каталоге. */
  indexable: boolean
  /** Последнее изменение содержимого или группы (ISO) — `lastmod` в sitemap. */
  updatedAt: string
  meta: { title: string; description: string }
  group: {
    id: number
    name: string
    city: string | null
    district: string | null
    /** Заголовки уровней группы (В1–В4+). */
    levels: string[]
    logoUpdatedAt: string | null
    /** Короткая ссылка `volleytime.by/<имя>` (21.2.16); null — не задана. */
    shortLink: string | null
    timezone: string
  }
  sections: PublicGroupPageSection[]
}

/** Карточка группы в каталоге «Волейбол в городе {город}». */
export interface PublicCatalogGroup {
  slug: string
  name: string
  district: string | null
  levels: string[]
  logoUpdatedAt: string | null
  id: number
}

export interface PublicCatalogView {
  city: string
  groups: PublicCatalogGroup[]
}

/** Ключ города каталога: trim, схлопнутые пробелы, нижний регистр. */
export function cityKey(city: string): string {
  return city.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru')
}

/**
 * Безопасный разбор сохранённого содержимого. Валидное — как есть. Иначе: секция, не прошедшая
 * схему, или повтор вида заменяется секцией по умолчанию на своём месте; недостающие виды —
 * по умолчанию в конец; мета, не прошедшая схему, — null (значения по умолчанию).
 */
export function sanitizeGroupPageContent(raw: unknown): GroupPageContent {
  const whole = GroupPageContent.safeParse(raw)
  if (whole.success) return whole.data
  const defaults = new Map(defaultGroupPageContent().sections.map((s) => [s.kind, s]))
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const list = Array.isArray(obj.sections) ? (obj.sections as unknown[]) : []
  const seen = new Set<GroupPageSectionKind>()
  const sections: GroupPageSection[] = []
  for (const item of list) {
    const parsed = GroupPageSection.safeParse(item)
    let kind: GroupPageSectionKind | undefined = parsed.success ? parsed.data.kind : undefined
    if (!kind && item && typeof item === 'object') {
      const k = (item as { kind?: unknown }).kind
      if (typeof k === 'string' && (GROUP_PAGE_SECTION_KINDS as readonly string[]).includes(k))
        kind = k as GroupPageSectionKind
    }
    if (!kind || seen.has(kind)) continue
    seen.add(kind)
    sections.push(parsed.success ? parsed.data : defaults.get(kind)!)
  }
  for (const kind of GROUP_PAGE_SECTION_KINDS)
    if (!seen.has(kind)) sections.push(defaults.get(kind)!)
  const meta = (key: 'metaTitle' | 'metaDescription') => {
    const shape = GroupPageContent.shape[key]
    const parsed = shape.safeParse(obj[key] ?? null)
    return parsed.success ? parsed.data : null
  }
  return { sections, metaTitle: meta('metaTitle'), metaDescription: meta('metaDescription') }
}

export interface PublicGroupPageInput {
  /** Сохранённое содержимое (`undefined` — строки нет). */
  content: unknown
  group: {
    name: string
    city: string | null
    district: string | null
    defaultJoinMode: 'open' | 'invite'
  }
  /** Заголовки уровней группы в порядке шкалы. */
  levels: string[]
  /** Только активные залы группы. */
  activeVenues: GroupPageVenue[]
  /** Только открытые (не «по приглашению») ближайшие события. */
  events: PublicGroupPageEvent[]
}

/** Собирает секции и мета публичной страницы из сохранённого содержимого и данных группы. */
export function buildPublicGroupPage(input: PublicGroupPageInput): {
  meta: PublicGroupPageView['meta']
  sections: PublicGroupPageSection[]
} {
  const content =
    input.content === undefined
      ? defaultGroupPageContent()
      : sanitizeGroupPageContent(input.content)
  const { group } = input
  const place = [group.city, group.district].filter(Boolean).join(', ') || null
  const venuesById = new Map(input.activeVenues.map((v) => [v.id, v]))
  const sections: PublicGroupPageSection[] = []
  for (const s of content.sections) {
    if (!s.enabled) continue
    switch (s.kind) {
      case 'cover':
        sections.push({ kind: 'cover', headline: s.headline ?? group.name, subtitle: s.subtitle })
        break
      case 'about':
        if (s.text || place) sections.push({ kind: 'about', text: s.text, place })
        break
      case 'schedule':
        sections.push({ kind: 'schedule', events: input.events })
        break
      case 'formats':
        if (s.text || input.levels.length > 0)
          sections.push({ kind: 'formats', levels: input.levels, text: s.text })
        break
      case 'prices':
        if (s.text) sections.push({ kind: 'prices', text: s.text })
        break
      case 'venues': {
        // архивный, удалённый или чужой зал отбрасывается: показываются только активные залы группы
        const venues = s.venueIds.flatMap((id) => {
          const v = venuesById.get(id)
          return v ? [{ name: v.name, address: v.address }] : []
        })
        if (venues.length > 0) sections.push({ kind: 'venues', venues })
        break
      }
      case 'join':
        sections.push({ kind: 'join', text: s.text ?? defaultJoinText(group.defaultJoinMode) })
        break
      case 'faq':
        if (s.items.length > 0) sections.push({ kind: 'faq', items: s.items })
        break
    }
  }
  return {
    meta: {
      title: content.metaTitle ?? defaultMetaTitle(group.name, group.city),
      description: content.metaDescription ?? defaultMetaDescription(group.name, group.city),
    },
    sections,
  }
}

/**
 * Гео-текст для поисковых и ИИ-ассистентов: одно-два предложения фактов о группе (город, район,
 * уровни, залы, ближайшая игра). Только публичные данные страницы.
 */
export function groupGeoSummary(view: PublicGroupPageView, formatDate: (iso: string) => string) {
  const { group } = view
  const where = [
    group.city && `в городе ${group.city}`,
    group.district && `район ${group.district}`,
  ]
    .filter(Boolean)
    .join(', ')
  const parts = [`${group.name} — волейбольная группа${where ? ` ${where}` : ''}.`]
  if (group.levels.length > 0) parts.push(`Уровни игроков: ${group.levels.join(', ')}.`)
  const venues = view.sections.find((s) => s.kind === 'venues')
  if (venues && venues.kind === 'venues')
    parts.push(
      `Залы: ${venues.venues.map((v) => (v.address ? `${v.name} (${v.address})` : v.name)).join('; ')}.`,
    )
  const schedule = view.sections.find((s) => s.kind === 'schedule')
  const next = schedule && schedule.kind === 'schedule' ? schedule.events[0] : undefined
  if (next) parts.push(`Ближайшая игра: ${next.title}, ${formatDate(next.startsAt)}.`)
  return parts.join(' ')
}
