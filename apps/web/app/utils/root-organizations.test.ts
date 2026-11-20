import type { PlatformOrganizationDetail, PlatformOrganizationRow } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ORG_FILTERS,
  ORG_PAGE_SIZE,
  activityTone,
  orgApiQuery,
  orgChips,
  orgCounter,
  orgCreateBody,
  orgCreateErrorMessage,
  orgCreateErrors,
  orgDetailView,
  orgFiltersFromQuery,
  orgFiltersToQuery,
  orgPanelFilterCount,
  orgRowView,
  orgSubtitle,
  ownerLabel,
  relativeShort,
} from './root-organizations'

const now = new Date('2026-11-18T12:00:00.000Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

const row = (over: Partial<PlatformOrganizationRow> = {}): PlatformOrganizationRow => ({
  id: 4,
  slug: 'vt-minsk',
  name: 'VolleyTime Минск',
  city: 'Минск',
  status: 'active',
  owner: { id: 9, name: 'Иван П.', email: 'ivan@vt.by', telegramUsername: 'ivan_p' },
  balance: 32,
  lowBalance: false,
  unlimited: null,
  members: 14,
  eventsMonth: 12,
  lastActivityAt: ago(5 * MIN),
  createdAt: ago(60 * DAY),
  ...over,
})

describe('filters in the URL', () => {
  it('round-trips every filter and writes nothing for defaults', () => {
    expect(orgFiltersToQuery(DEFAULT_ORG_FILTERS)).toEqual({})
    const filters = {
      status: 'risk',
      lowBalance: true,
      inactive: true,
      sort: 'events',
      q: ' vt ',
      page: 3,
    } as const
    const query = orgFiltersToQuery(filters)
    expect(query).toEqual({
      status: 'risk',
      lowBalance: '1',
      inactive: '1',
      sort: 'events',
      q: 'vt',
      page: '3',
    })
    expect(orgFiltersFromQuery(query)).toEqual({ ...filters, q: 'vt' })
  })

  it('falls back to defaults for unknown, repeated or malformed values', () => {
    expect(
      orgFiltersFromQuery({
        status: 'nope',
        sort: ['events', 'activity'],
        lowBalance: 'true',
        inactive: '0',
        q: 'x'.repeat(300),
        page: '-2',
      }),
    ).toEqual({
      ...DEFAULT_ORG_FILTERS,
      sort: 'events',
      q: 'x'.repeat(100),
    })
    expect(orgFiltersFromQuery({ page: '1.5' }).page).toBe(1)
    expect(orgFiltersFromQuery({}).status).toBe('all')
  })

  it('sends the same filters to the API plus the page size', () => {
    expect(orgApiQuery({ ...DEFAULT_ORG_FILTERS, status: 'blocked' })).toEqual({
      status: 'blocked',
      pageSize: ORG_PAGE_SIZE,
    })
  })

  it('counts the filters of the panel, not the chips or the search', () => {
    expect(orgPanelFilterCount(DEFAULT_ORG_FILTERS)).toBe(0)
    expect(
      orgPanelFilterCount({
        ...DEFAULT_ORG_FILTERS,
        status: 'risk',
        q: 'a',
        lowBalance: true,
        sort: 'events',
      }),
    ).toBe(2)
  })
})

describe('list texts', () => {
  it('builds the chips, the subtitle and the counter', () => {
    const counts = { all: 5, active: 4, risk: 1, blocked: 0 }
    expect(orgChips(counts).map((c) => [c.value, c.label, c.count, c.tint])).toEqual([
      ['all', 'Все', 5, null],
      ['active', 'Активные', 4, null],
      ['risk', 'В риске', 1, 'amber'],
      ['blocked', 'Заблокированы', 0, null],
    ])
    expect(orgSubtitle(counts)).toBe('5 всего · 4 активных за неделю · 1 в риске')
    expect(orgCounter(0, 0)).toBe('Организаций нет')
    expect(orgCounter(50, 1234)).toBe('Показано 50 из 1 234')
  })

  it('shows activity age shortly and picks a tone by it', () => {
    expect(relativeShort(ago(10_000), now)).toBe('сейчас')
    expect(relativeShort(ago(5 * MIN), now)).toBe('5 мин')
    expect(relativeShort(ago(3 * HOUR + 5 * MIN), now)).toBe('3 ч')
    expect(relativeShort(ago(2 * DAY + HOUR), now)).toBe('2 д')
    expect(relativeShort(ago(-HOUR), now)).toBe('сейчас')
    expect(activityTone(ago(2 * HOUR), now)).toBe('grass')
    expect(activityTone(ago(3 * DAY), now)).toBe('amber')
    expect(activityTone(ago(14 * DAY), now)).toBe('mute')
  })

  it('maps a row to the table view', () => {
    expect(orgRowView(row(), now)).toMatchObject({
      code: 'org_vt-minsk',
      initials: 'VO',
      owner: 'Иван П.',
      balance: 32,
      members: 14,
      eventsMonth: 12,
      eventsPercent: 60,
      activity: '5 мин',
      tone: 'grass',
      blocked: false,
    })
    expect(orgRowView(row({ eventsMonth: 40, status: 'suspended' }), now)).toMatchObject({
      eventsPercent: 100,
      blocked: true,
    })
  })

  it('names the owner by name, email, username or id', () => {
    expect(ownerLabel(null)).toBe('—')
    const base = { id: 3, name: '', email: null, telegramUsername: null }
    expect(ownerLabel({ ...base, email: 'a@b.c' })).toBe('a@b.c')
    expect(ownerLabel({ ...base, telegramUsername: 'tg' })).toBe('@tg')
    expect(ownerLabel(base)).toBe('#3')
  })
})

describe('manual creation form', () => {
  const form = { name: ' VolleyTime Гомель ', slug: ' ', city: '', owner: ' @owner ' }

  it('trims the body and leaves out empty optional fields', () => {
    expect(orgCreateBody(form)).toEqual({ name: 'VolleyTime Гомель', owner: '@owner' })
    expect(orgCreateBody({ ...form, slug: 'vt-gomel', city: 'Гомель' })).toEqual({
      name: 'VolleyTime Гомель',
      owner: '@owner',
      slug: 'vt-gomel',
      city: 'Гомель',
    })
  })

  it('validates like the server before the request', () => {
    expect(orgCreateErrors(form)).toEqual({})
    expect(
      Object.keys(
        orgCreateErrors({ name: 'x', slug: 'Bad Slug', city: 'c'.repeat(101), owner: 'a' }),
      ),
    ).toEqual(['name', 'slug', 'city', 'owner'])
  })

  it('explains the server answers', () => {
    expect(orgCreateErrorMessage('organization.slug_taken')).toBe('Такой код уже занят')
    expect(orgCreateErrorMessage('platform.owner_not_found')).toMatch(/не найден/)
    expect(orgCreateErrorMessage('platform.owner_ambiguous')).toMatch(/email/)
    expect(orgCreateErrorMessage('platform.owner_inactive')).toMatch(/отключён/)
    expect(orgCreateErrorMessage(undefined)).toBe('Не удалось создать организацию')
  })
})

describe('organization card view', () => {
  const detail = (over: Partial<PlatformOrganizationDetail> = {}): PlatformOrganizationDetail => ({
    id: 4,
    slug: 'vt-minsk',
    name: 'VolleyTime Минск',
    description: null,
    city: 'Минск',
    timezone: 'Europe/Minsk',
    currency: 'BYN',
    status: 'active',
    deletedAt: null,
    createdAt: '2026-03-18T21:30:00.000Z',
    owner: { id: 9, name: 'Иван П.', email: 'ivan@vt.by', telegramUsername: 'ivan_p' },
    modules: { subscriptions: true, publicPage: false, seoIndex: false },
    unlimited: null,
    stats: {
      balance: 7,
      lowBalance: true,
      members: 14,
      eventsMonth: 12,
      lastActivityAt: ago(2 * HOUR),
    },
    recentAudit: [
      {
        id: 2,
        createdAt: '2026-11-18T11:22:00.000Z',
        action: 'plan.updated',
        actor: null,
        newValue: null,
      },
    ],
    balanceHistory: [
      { id: 1, createdAt: '2026-11-17T09:05:00.000Z', delta: -1, balanceAfter: 7, reason: 'spend' },
      { id: 0, createdAt: '2026-11-10T09:05:00.000Z', delta: 10, balanceAfter: 8, reason: 'grant' },
    ],
    ...over,
  })

  it('formats dates in the group time zone and the history with signs', () => {
    const view = orgDetailView(detail(), now)
    // 21:30 UTC 18 марта — уже 19 марта по Минску
    expect(view.subtitle).toBe('org_vt-minsk · создана 19 марта 2026 г.')
    expect(view.statusLabel).toBeNull()
    expect(view.profile.find((p) => p.label === 'Владелец')!.value).toBe(
      'Иван П. · @ivan_p · ivan@vt.by · usr_9',
    )
    expect(view.profile.find((p) => p.label === 'Город / TZ')!.value).toBe('Минск · Europe/Minsk')
    expect(view.history.map((h) => [h.reason, h.delta, h.after])).toEqual([
      ['Списание за событие', '−1', 7],
      ['Начисление', '+10', 8],
    ])
    expect(view.audit[0]).toMatchObject({
      action: 'plan.updated',
      actor: 'system',
      time: '18.11 14:22',
    })
    expect(view.modules.map((m) => [m.label, m.on])).toEqual([
      ['subscriptions', true],
      ['public_page', false],
      ['seo_index', false],
    ])
    expect(view.kpis.map((k) => [k.label, k.value])).toEqual([
      ['Баланс событий', '7'],
      ['Игроков', '14'],
      ['Событий за 30 дней', '12'],
      ['Активность', '2 ч'],
    ])
    expect(view.kpis[0]!.tone).toBe('flame')
  })

  it('marks suspended, archived and deleted groups and survives a bad zone', () => {
    expect(orgDetailView(detail({ status: 'suspended' }), now).statusLabel).toBe('заблокирована')
    expect(orgDetailView(detail({ status: 'archived' }), now).statusLabel).toBe('в архиве')
    expect(orgDetailView(detail({ deletedAt: '2026-11-17T00:00:00.000Z' }), now).statusLabel).toBe(
      'удалена',
    )
    expect(() => orgDetailView(detail({ timezone: 'Nowhere/Land' }), now)).not.toThrow()
    expect(orgDetailView(detail({ owner: null, city: null }), now).profile[1]!.value).toBe('—')
  })
})
