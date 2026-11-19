import type { PlatformUserDetail, PlatformUserRow, PlatformUsersCounts } from '@volley-time/shared'
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_USER_FILTERS,
  USER_PAGE_SIZE,
  blockErrorMessage,
  userApiQuery,
  userChips,
  userCounter,
  userDetailView,
  userFiltersFromQuery,
  userFiltersToQuery,
  userKpis,
  userRowView,
  userSubtitle,
} from './root-users'

const now = new Date('2026-11-18T12:00:00.000Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

const row = (over: Partial<PlatformUserRow> = {}): PlatformUserRow => ({
  id: 90,
  name: 'Иван Петренко',
  email: 'ivan@vt.by',
  telegramUsername: 'ivan_p',
  telegramLinked: true,
  groups: 1,
  topRole: 'owner',
  bookings: 34,
  lastActivityAt: ago(5 * MIN),
  createdAt: ago(60 * DAY),
  blocked: false,
  isRootAdmin: false,
  ...over,
})

const counts: PlatformUsersCounts = {
  all: 148,
  telegram: 142,
  email: 76,
  active: 87,
  blocked: 2,
  newThisWeek: 12,
}

describe('filters in the URL', () => {
  it('round-trips every filter and writes nothing for defaults', () => {
    expect(userFiltersToQuery(DEFAULT_USER_FILTERS)).toEqual({})
    const filters = { status: 'blocked', q: ' ivan ', page: 3 } as const
    const query = userFiltersToQuery(filters)
    expect(query).toEqual({ status: 'blocked', q: 'ivan', page: '3' })
    expect(userFiltersFromQuery(query)).toEqual({ ...filters, q: 'ivan' })
  })

  it('falls back to defaults for unknown, repeated or malformed values', () => {
    expect(userFiltersFromQuery({ status: 'nope', q: 'x'.repeat(300), page: '-2' })).toEqual({
      ...DEFAULT_USER_FILTERS,
      q: 'x'.repeat(100),
    })
    expect(userFiltersFromQuery({ status: ['active', 'blocked'], page: '2.5' })).toEqual({
      ...DEFAULT_USER_FILTERS,
      status: 'active',
    })
    expect(userFiltersFromQuery({ page: '10001' }).page).toBe(1)
  })

  it('adds the page size to the API query only', () => {
    expect(userApiQuery({ ...DEFAULT_USER_FILTERS, status: 'active' })).toEqual({
      status: 'active',
      pageSize: USER_PAGE_SIZE,
    })
  })
})

describe('summary and chips', () => {
  it('builds the subtitle, the four tiles and the status chips from the counters', () => {
    expect(userSubtitle(counts)).toBe('148 учётных записей · 87 активных за неделю')
    expect(userKpis(counts)).toEqual([
      { label: 'Всего', value: '148', note: '+12 за неделю' },
      { label: 'Связаны Telegram', value: '142', note: '96%' },
      { label: 'Связан email', value: '76', note: '51%' },
      { label: 'Активны 7д', value: '87', note: 'WAU 59%' },
    ])
    expect(userChips(counts).map((c) => [c.value, c.label, c.count])).toEqual([
      ['all', 'Все', 148],
      ['active', 'Активные', 87],
      ['blocked', 'Заблокированные', 2],
    ])
  })

  it('does not divide by zero on an empty platform', () => {
    const empty: PlatformUsersCounts = { ...counts, all: 0, telegram: 0, email: 0, active: 0 }
    expect(userKpis(empty).map((k) => k.note)).toEqual(['+12 за неделю', '0%', '0%', 'WAU 0%'])
    expect(userCounter(0, 0)).toBe('Пользователей нет')
    expect(userCounter(50, 1234)).toBe('Показано 50 из 1 234')
  })
})

describe('row view', () => {
  it('shows contacts, group count with the role and the activity tone', () => {
    const view = userRowView(row(), now)
    expect(view).toMatchObject({
      id: 90,
      name: 'Иван Петренко',
      code: 'usr_90',
      initials: 'ИП',
      telegram: '@ivan_p',
      email: 'ivan@vt.by',
      groups: 1,
      role: 'админ группы',
      bookings: 34,
      activity: '5 мин',
      tone: 'grass',
      blocked: false,
    })
  })

  it('uses dashes for missing contacts, a fallback name and the pending and empty roles', () => {
    const bare = userRowView(
      row({
        name: '',
        email: null,
        telegramUsername: null,
        telegramLinked: false,
        groups: 0,
        topRole: null,
        lastActivityAt: ago(3 * DAY),
      }),
      now,
    )
    expect(bare).toMatchObject({
      name: 'Без имени',
      initials: '?',
      telegram: '—',
      email: '—',
      role: '',
      tone: 'amber',
    })
    expect(userRowView(row({ topRole: 'pending', groups: 0 }), now).role).toBe('заявка')
    expect(userRowView(row({ telegramUsername: null, telegramLinked: true }), now).telegram).toBe(
      'привязан',
    )
    expect(userRowView(row({ lastActivityAt: ago(2 * HOUR) }), now).activity).toBe('2 ч')
    expect(userRowView(row({ lastActivityAt: ago(9 * DAY) }), now).tone).toBe('mute')
  })

  it('flags blocked users and roots', () => {
    expect(userRowView(row({ blocked: true }), now).blocked).toBe(true)
    expect(userRowView(row({ isRootAdmin: true }), now).root).toBe(true)
  })
})

describe('card view', () => {
  const detail = (over: Partial<PlatformUserDetail> = {}): PlatformUserDetail => ({
    ...row(),
    memberships: [
      {
        organizationId: 4,
        organizationName: 'VolleyTime Минск',
        organizationSlug: 'vt-minsk',
        role: 'organizer',
        status: 'active',
      },
      {
        organizationId: 5,
        organizationName: 'Spike Club',
        organizationSlug: 'spike',
        role: 'player',
        status: 'blocked',
      },
    ],
    recentAudit: [
      {
        id: 7,
        createdAt: '2026-11-18T09:05:00.000Z',
        action: 'user.blocked',
        actor: { id: 1, name: 'Root' },
      },
      { id: 6, createdAt: '2026-11-17T09:05:00.000Z', action: 'user.unblocked', actor: null },
    ],
    ...over,
  })

  it('describes the profile, the memberships and the journal in Russian', () => {
    const view = userDetailView(detail({ blocked: true, isRootAdmin: true }), 'UTC')
    expect(view.title).toBe('Иван Петренко')
    expect(view.statusLabel).toBe('заблокирован')
    expect(view.canBlock).toBe(false)
    expect(view.canUnblock).toBe(true)
    expect(view.profile.map((p) => p.label)).toEqual([
      'ID',
      'Telegram',
      'Email',
      'Роль на платформе',
      'Зарегистрирован',
    ])
    expect(view.profile.find((p) => p.label === 'Роль на платформе')!.value).toBe(
      'администратор платформы',
    )
    expect(view.memberships).toEqual([
      {
        key: '4',
        name: 'VolleyTime Минск',
        code: 'org_vt-minsk',
        role: 'организатор',
        status: 'активен',
      },
      { key: '5', name: 'Spike Club', code: 'org_spike', role: 'игрок', status: 'заблокирован' },
    ])
    expect(view.audit.map((a) => [a.action, a.actor])).toEqual([
      ['Блокировка', 'Root'],
      ['Разблокировка', 'система'],
    ])
  })

  it('allows blocking an active non-root user and nobody else', () => {
    expect(userDetailView(detail(), 'UTC')).toMatchObject({
      canBlock: true,
      canUnblock: false,
      statusLabel: null,
    })
    expect(userDetailView(detail({ isRootAdmin: true }), 'UTC').canBlock).toBe(false)
  })

  it('formats timestamps in UTC so the output does not depend on the machine', () => {
    const view = userDetailView(detail(), 'UTC')
    expect(view.audit[0]!.time).toBe('18.11 09:05')
    expect(view.profile.find((p) => p.label === 'Зарегистрирован')!.value).toBe(
      '19 сентября 2026 г.',
    )
  })
})

describe('block errors', () => {
  it('maps API codes to Russian messages with a safe fallback', () => {
    expect(blockErrorMessage('platform.user_cannot_block_self')).toMatch(/себя/)
    expect(blockErrorMessage('platform.user_cannot_block_root')).toMatch(/администратор/)
    expect(blockErrorMessage('platform.user_already_blocked')).toMatch(/уже заблокирован/)
    expect(blockErrorMessage('platform.user_not_blocked')).toMatch(/не заблокирован/)
    expect(blockErrorMessage('platform.user_not_found')).toMatch(/не найден/)
    expect(blockErrorMessage(undefined)).toBe('Не удалось выполнить действие')
    expect(blockErrorMessage('weird')).toBe('Не удалось выполнить действие')
  })
})
