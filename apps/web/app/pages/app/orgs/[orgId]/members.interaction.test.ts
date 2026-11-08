// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, Suspense, watch } from 'vue'

import Members from './members.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import PlayerDrawer from '~/components/desktop/PlayerDrawer.vue'
import { apiErrorMessage } from '~/utils/api-error'

const levels = [
  { code: 'v1', title: 'В1', description: 'Полупрофи', sortOrder: 1 },
  { code: 'v2', title: 'В2', description: 'Сильный любитель', sortOrder: 2 },
]

type Status = 'active' | 'pending' | 'guest' | 'blocked' | 'left' | 'rejected'
function row(
  id: number,
  name: string,
  status: Status,
  level: string | null = null,
  username: string | null = null,
) {
  return {
    id,
    organizationId: 30,
    role: 'player' as 'player' | 'assistant',
    status,
    level,
    joinedAt: '2026-09-29T07:00:00.000Z',
    createdAt: '2026-09-29T07:00:00.000Z',
    user: { id: id + 100, name, telegramUsername: username, image: null },
  }
}

const all = [
  row(1, 'Синтетический Игрок Один', 'active', 'v1', 'synthetic_one'),
  row(2, 'Синтетический Игрок Два', 'active'),
  row(3, 'Синтетический Игрок Три', 'pending'),
  row(4, 'Синтетический Игрок Четыре', 'guest'),
  row(5, 'Синтетический Игрок Пять', 'blocked'),
  row(6, 'Синтетический Вышедший', 'left'),
]

const route = reactive({ params: { orgId: '30' }, path: '/app/orgs/30/members' })
const apiFetch = vi.fn()
const writeText = vi.fn()
let wrapper: VueWrapper | undefined
let invites: unknown[] = []
let actorRole = 'owner'
let withStats = false
let excludeFails = false
const excludedRows = [
  {
    ...row(7, 'Синтетический Исключённый', 'left'),
    excludedAt: '2026-11-05T10:00:00.000Z',
    excludedBy: { id: 9, name: 'Синтетический Владелец', telegramUsername: null },
    reason: 'Спор о взносах',
  },
]

const STATS_PERIOD = { from: '2026-02-20', to: '2026-05-20' }
const emptyStats = {
  attendance: { visits: 0, noShows: 0, cancellations: 0, ratePercent: null, lastVisitAt: null },
  subscription: null,
  debt: { amount: 0, seats: 0, currency: 'BYN' },
}
/** Агрегаты API 21.2.20: у игрока 1 — визиты, абонемент и долг; у остальных пусто. */
function statsFor(id: number) {
  if (id !== 1) return emptyStats
  return {
    attendance: {
      visits: 24,
      noShows: 2,
      cancellations: 1,
      ratePercent: 92,
      lastVisitAt: '2026-04-30T21:30:00.000Z',
    },
    subscription: { remaining: 5, total: 8, expiresAt: '2026-06-30T00:00:00.000Z', count: 1 },
    debt: { amount: 3700, seats: 3, currency: 'BYN' },
  }
}

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  invites = []
  actorRole = 'owner'
  withStats = false
  excludeFails = false
  apiFetch.mockReset().mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (url === '/api/organizations/30/members')
      return withStats
        ? {
            members: structuredClone(all).map((m) => ({ ...m, stats: statsFor(m.id) })),
            statsPeriod: STATS_PERIOD,
          }
        : { members: structuredClone(all) }
    if (url === '/api/organizations/30/invites' && !opts?.method) return { invites }
    if (url === '/api/organizations/30/invites')
      return { deeplinkUrl: 'https://t.me/bot?start=new' }
    if (url === '/api/organizations/30/members/excluded')
      return { members: structuredClone(excludedRows) }
    if (url.endsWith('/level')) return { member: { level: 'v2' } }
    if (url.endsWith('/position')) return { member: { position: 'libero' } }
    if (url.endsWith('/exclude')) {
      if (excludeFails) throw { statusCode: 403, data: { code: 'forbidden.exclude' } }
      return { member: {}, cancelledBookings: 2, paidSeats: 1, revokedInvites: 0 }
    }
    return {}
  })
  vi.stubGlobal('window', Object.assign(window, { confirm: () => true }))
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
  vi.stubGlobal('useFetch', async (url: string | (() => string)) => {
    const path = typeof url === 'function' ? url() : url
    if (path === '/api/levels') return { data: ref({ levels }) }
    return {
      data: ref({
        myMember: { role: actorRole, status: 'active', userId: 9 },
        organization: { defaultMemberStatus: 'active' },
      }),
    }
  })
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
  vi.stubGlobal('$fetch', apiFetch)
  vi.stubGlobal('apiErrorMessage', apiErrorMessage)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Members) }) }),
    {
      attachTo: document.body,
      global: {
        components: { EmptyState, ErrorState, SkeletonList, DesktopPlayerDrawer: PlayerDrawer },
        stubs: {
          VtIcon: { template: '<span />' },
          VtAvatar: { template: '<span />' },
          VtChip: { template: '<span><slot /></span>' },
          VtSheet: {
            props: ['modelValue', 'id', 'title'],
            template: '<div v-if="modelValue" role="dialog"><slot /></div>',
          },
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

const tabButton = (w: VueWrapper, text: string) =>
  w.findAll('[aria-label="Статус участников"] button').find((b) => b.text().startsWith(text))!
const names = (w: VueWrapper) => w.findAll('tbody .vt-desktop-members__name').map((n) => n.text())

describe('desktop players (W-06)', () => {
  it('loads every status in one request and counts the tabs on the client', async () => {
    const w = await render()
    const calls = apiFetch.mock.calls.filter(([url]) => url === '/api/organizations/30/members')
    expect(calls).toHaveLength(1)
    expect(calls[0]![1].query.statuses).toBe('active,pending,guest,blocked,left,rejected')
    const counts = Object.fromEntries(
      ['Все', 'Активные', 'Заявки', 'Гости', 'Заблокированы'].map((t) => [
        t,
        tabButton(w, t).text(),
      ]),
    )
    expect(counts).toEqual({
      Все: 'Все 5',
      Активные: 'Активные 2',
      Заявки: 'Заявки 1',
      Гости: 'Гости 1',
      Заблокированы: 'Заблокированы 1',
    })
    expect(w.text()).toContain('2 активных · 1 на модерации · 1 заблокирован')
    expect(names(w)).toHaveLength(5)
    expect(w.text()).not.toContain('Вышедший')
  })

  it('switches tabs, searches by name or @username and filters by level without refetching', async () => {
    const w = await render()
    await tabButton(w, 'Гости').trigger('click')
    expect(names(w)).toEqual(['Синтетический Игрок Четыре'])
    await tabButton(w, 'Все').trigger('click')
    await w.get('#players-search').setValue('@synthetic_one')
    expect(names(w)).toEqual(['Синтетический Игрок Один'])
    await w.get('#players-search').setValue('')
    await w.get('#players-level').setValue('v1')
    expect(names(w)).toEqual(['Синтетический Игрок Один'])
    await w.get('#players-level').setValue('none')
    expect(names(w)).toHaveLength(4)
    expect(
      apiFetch.mock.calls.filter(([url]) => url === '/api/organizations/30/members'),
    ).toHaveLength(1)
  })

  it('shows the table columns and the level under the name, never A/B/C', async () => {
    const w = await render()
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      'Игрок',
      'Телеграм',
      'Амплуа',
      'Роль',
      'Действия',
    ])
    expect(w.text()).toContain('уровень В1')
    expect(w.text()).toContain('@synthetic_one')
    expect(w.text()).not.toMatch(/Абонемент|Задолж/)
  })

  describe('player stats (21.2.20)', () => {
    it('asks for the stats only as a manager, never as an assistant', async () => {
      await render()
      expect(
        apiFetch.mock.calls.find(([url]) => url === '/api/organizations/30/members')![1].query,
      ).toMatchObject({ stats: '1' })
      wrapper?.unmount()
      apiFetch.mockClear()
      actorRole = 'assistant'
      await render()
      const query = apiFetch.mock.calls.find(([url]) => url === '/api/organizations/30/members')![1]
        .query
      expect(query.stats).toBeUndefined()
    })

    it('adds the activity, subscription and debt columns from the API data', async () => {
      withStats = true
      const w = await render()
      expect(w.findAll('thead th').map((th) => th.text())).toEqual([
        'Игрок',
        'Телеграм',
        'Амплуа',
        'Роль',
        'Активность',
        'Абонемент',
        'Задолженность',
        'Действия',
      ])
      const first = w.findAll('tbody tr')[0]!
      expect(first.get('[data-col="activity"]').text()).toBe('24 тр.посл. 01.05.2026')
      expect(first.get('[data-col="subscription"]').text()).toBe('5 / 8до 30.06.2026')
      expect(first.get('[data-col="debt"]').text()).toBe('37.00 BYN3 места')
      const second = w.findAll('tbody tr')[1]!
      expect(second.get('[data-col="activity"]').text()).toBe('0 тр.нет визитов')
      expect(second.get('[data-col="subscription"]').text()).toBe('—')
      expect(second.get('[data-col="debt"]').text()).toBe('—')
    })

    it('does not show the columns when the API sent no stats', async () => {
      const w = await render()
      expect(w.find('[data-col]').exists()).toBe(false)
      expect(w.text()).not.toMatch(/Абонемент|Задолж|Активность/)
    })

    it('shows the stats and the period in the player card', async () => {
      withStats = true
      const w = await render()
      await w.findAll('tbody .vt-desktop-members__name')[0]!.trigger('click')
      const card = w.get('[role="dialog"]')
      expect(card.text()).toContain('за период 20.02.2026 — 20.05.2026')
      expect(card.get('[data-stat="visits"]').text()).toBe('24')
      expect(card.get('[data-stat="rate"]').text()).toBe('92%')
      expect(card.get('[data-stat="no-shows"]').text()).toBe('2')
      expect(card.get('[data-stat="cancellations"]').text()).toBe('1')
      expect(card.get('[data-stat="last"]').text()).toBe('01.05.2026')
      expect(card.get('[data-stat="subscription"]').text()).toBe('5 / 8 до 30.06.2026')
      expect(card.get('[data-stat="debt"]').text()).toBe('37.00 BYN 3 места')
    })

    it('shows "no debt" and dashes for a player without activity', async () => {
      withStats = true
      const w = await render()
      await w.findAll('tbody .vt-desktop-members__name')[1]!.trigger('click')
      const card = w.get('[role="dialog"]')
      expect(card.get('[data-stat="debt"]').text()).toBe('Нет')
      expect(card.get('[data-stat="subscription"]').text()).toBe('—')
      expect(card.get('[data-stat="rate"]').text()).toBe('—')
    })

    it('keeps the card without a stats block when the API sent none', async () => {
      const w = await render()
      await w.findAll('tbody .vt-desktop-members__name')[0]!.trigger('click')
      expect(w.find('[data-stat]').exists()).toBe(false)
    })
  })

  it('opens the card, sets a position via PATCH and shows it in the list (21.2.22)', async () => {
    const w = await render()
    await w.findAll('tbody .vt-desktop-members__name')[1]!.trigger('click')
    const select = w.get('#player-drawer-position')
    expect(select.findAll('option').map((o) => o.text())).toEqual([
      'Не задано',
      'Связующий',
      'Доигровщик',
      'Диагональный',
      'Центральный блокирующий',
      'Либеро',
      'Универсал',
    ])
    await select.setValue('libero')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/members/2/position', {
      method: 'PATCH',
      body: { position: 'libero' },
    })
    expect(w.findAll('tbody tr')[1]!.text()).toContain('Либеро')
  })

  it('shows the position read-only for a blocked player and to an assistant (21.2.22)', async () => {
    const w = await render()
    await w.findAll('tbody .vt-desktop-members__name')[4]!.trigger('click')
    expect(w.find('#player-drawer-position').exists()).toBe(false)
    expect(w.get('[role="dialog"]').text()).toContain('Амплуа')
  })

  it('hides the position selector from an assistant (21.2.22)', async () => {
    actorRole = 'assistant'
    const w = await render()
    await w.findAll('tbody .vt-desktop-members__name')[1]!.trigger('click')
    expect(w.find('#player-drawer-position').exists()).toBe(false)
  })

  it('opens the card, assigns a level via PATCH and updates the row', async () => {
    const w = await render()
    await w.findAll('tbody .vt-desktop-members__name')[1]!.trigger('click')
    expect(w.get('[role="dialog"]').text()).toContain('Активен')
    expect(w.get('[role="dialog"]').text()).toContain('В группе с')
    await w.get('#player-drawer-level').setValue('v2')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/members/2/level', {
      method: 'PATCH',
      body: { level: 'v2' },
    })
    expect(w.text()).toContain('уровень В2')
  })

  it('offers the Telegram link only when the player has a username', async () => {
    const w = await render()
    await w.findAll('tbody .vt-desktop-members__name')[0]!.trigger('click')
    expect(w.get('[role="dialog"] a').attributes('href')).toBe('https://t.me/synthetic_one')
    await w
      .get('[role="dialog"]')
      .findAll('button')
      .find((b) => b.text() === 'Закрыть')!
      .trigger('click')
    await w.findAll('tbody .vt-desktop-members__name')[1]!.trigger('click')
    expect(w.find('[role="dialog"] a').exists()).toBe(false)
  })

  it('does not offer a level selector for a blocked player', async () => {
    const w = await render()
    await w.findAll('tbody .vt-desktop-members__name')[4]!.trigger('click')
    expect(w.find('#player-drawer-level').exists()).toBe(false)
    expect(w.get('[role="dialog"]').text()).toContain('Не назначен')
  })

  it('keeps moderation: approve posts and reloads the list', async () => {
    const w = await render()
    const approve = w.findAll('tbody button').find((b) => b.text() === 'Принять')!
    await approve.trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/members/3/approve', {
      method: 'POST',
    })
    expect(
      apiFetch.mock.calls.filter(([url]) => url === '/api/organizations/30/members'),
    ).toHaveLength(2)
  })

  describe('exclude from the group (21.2.21)', () => {
    const open = async (w: VueWrapper, index: number) =>
      w.findAll('tbody .vt-desktop-members__name')[index]!.trigger('click')
    const excludeCalls = () =>
      apiFetch.mock.calls.filter(([url]) => String(url).endsWith('/exclude'))
    const section = (w: VueWrapper) => w.get('[data-testid="player-exclude"]')
    const sectionButton = (w: VueWrapper, text: string) =>
      section(w)
        .findAll('button')
        .find((b) => b.text() === text)!

    it('lists the consequences first, then posts the reason and reloads the list', async () => {
      const w = await render()
      await open(w, 1)
      expect(w.find('#player-drawer-exclude-reason').exists()).toBe(false)
      await sectionButton(w, 'Удалить из группы').trigger('click')
      const text = section(w).text()
      expect(text).toContain('Будущие записи игрока отменятся')
      expect(text).toContain('Оплаченные места автоматически не возвращаются')
      expect(text).toContain('Абонемент останется за игроком')
      expect(text).toContain('Долг и ожидающие оплаты останутся в кассе')
      expect(text).toContain('не блокирует')
      expect(excludeCalls()).toHaveLength(0)
      await w.get('#player-drawer-exclude-reason').setValue('  Переехал  ')
      await sectionButton(w, 'Удалить из группы').trigger('click')
      await flushPromises()
      expect(excludeCalls()).toEqual([
        [
          '/api/organizations/30/members/2/exclude',
          { method: 'POST', body: { reason: 'Переехал' } },
        ],
      ])
      expect(
        apiFetch.mock.calls.filter(([url]) => url === '/api/organizations/30/members'),
      ).toHaveLength(2)
      expect(w.text()).toContain('Отменено записей: 2')
      expect(w.text()).toContain('Деньги вернуть нужно вручную')
    })

    it('«Исключить и заблокировать» posts reason and block in one request', async () => {
      const w = await render()
      await open(w, 1)
      await sectionButton(w, 'Удалить из группы').trigger('click')
      await w.get('#player-drawer-exclude-reason').setValue('Спор')
      await sectionButton(w, 'Исключить и заблокировать').trigger('click')
      await flushPromises()
      expect(excludeCalls()).toEqual([
        [
          '/api/organizations/30/members/2/exclude',
          { method: 'POST', body: { reason: 'Спор', block: true } },
        ],
      ])
      expect(w.text()).toContain('удалён из группы и заблокирован')
    })

    it('cancel leaves the player in place and posts nothing', async () => {
      const w = await render()
      await open(w, 1)
      await sectionButton(w, 'Удалить из группы').trigger('click')
      await sectionButton(w, 'Отмена').trigger('click')
      expect(excludeCalls()).toHaveLength(0)
      expect(w.find('#player-drawer-exclude-reason').exists()).toBe(false)
    })

    it('shows the API error inside the card and keeps the list', async () => {
      excludeFails = true
      const w = await render()
      await open(w, 1)
      await sectionButton(w, 'Удалить из группы').trigger('click')
      await sectionButton(w, 'Удалить из группы').trigger('click')
      await flushPromises()
      expect(section(w).get('[role="alert"]').text()).not.toBe('')
      expect(names(w)).toContain('Синтетический Игрок Два')
    })

    it('is not offered to an assistant', async () => {
      actorRole = 'assistant'
      const w = await render()
      await open(w, 1)
      expect(w.find('[data-testid="player-exclude"]').exists()).toBe(false)
    })

    it('is not offered for a blocked player', async () => {
      const w = await render()
      await open(w, 4)
      expect(w.find('[data-testid="player-exclude"]').exists()).toBe(false)
    })
  })

  describe('excluded tab (21.2.24)', () => {
    const openTab = async (w: VueWrapper) => {
      await w
        .findAll('button')
        .find((b) => b.text().startsWith('Исключённые'))!
        .trigger('click')
    }

    it('shows only excluded players with date, actor and reason (not voluntary leavers)', async () => {
      const w = await render()
      await openTab(w)
      expect(names(w)).toEqual(['Синтетический Исключённый'])
      expect(w.text()).not.toContain('Синтетический Вышедший')
      expect(w.text()).toContain('Синтетический Владелец')
      expect(w.text()).toContain('Спор о взносах')
    })

    it('blocks from the tab and reloads', async () => {
      const w = await render()
      await openTab(w)
      await w.get('[data-testid="excluded-block"]').trigger('click')
      await flushPromises()
      expect(
        apiFetch.mock.calls.filter(([url]) => url === '/api/organizations/30/members/7/block'),
      ).toEqual([['/api/organizations/30/members/7/block', { method: 'POST' }]])
      expect(
        apiFetch.mock.calls.filter(([url]) => url === '/api/organizations/30/members/excluded'),
      ).toHaveLength(2)
    })

    it('an organizer cannot block an excluded admin', async () => {
      actorRole = 'organizer'
      excludedRows[0]!.role = 'assistant'
      try {
        const w = await render()
        await openTab(w)
        expect(w.find('[data-testid="excluded-block"]').exists()).toBe(false)
      } finally {
        excludedRows[0]!.role = 'player'
      }
    })

    it('an assistant has no tab and never requests the list', async () => {
      actorRole = 'assistant'
      const w = await render()
      expect(w.findAll('button').some((b) => b.text().startsWith('Исключённые'))).toBe(false)
      expect(
        apiFetch.mock.calls.some(([url]) => url === '/api/organizations/30/members/excluded'),
      ).toBe(false)
    })
  })

  it('copies an existing player invite link without creating a new one', async () => {
    invites = [
      {
        roleToAssign: 'player',
        type: 'organization_join',
        defaultMemberStatus: 'active',
        isRevoked: false,
        expiresAt: null,
        maxUses: null,
        usesCount: 0,
        deeplinkUrl: 'https://t.me/bot?start=existing',
      },
    ]
    const w = await render()
    await w
      .findAll('header button')
      .find((b) => b.text().includes('Скопировать invite-link'))!
      .trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('https://t.me/bot?start=existing')
    expect(apiFetch.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false)
    expect(w.text()).toContain('Invite-ссылка скопирована')
  })

  it('creates a player invite when none is usable, then copies it', async () => {
    const w = await render()
    await w
      .findAll('header button')
      .find((b) => b.text().includes('Скопировать invite-link'))!
      .trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/organizations/30/invites', {
      method: 'POST',
      body: { roleToAssign: 'player', expiresInDays: 7 },
    })
    expect(writeText).toHaveBeenCalledWith('https://t.me/bot?start=new')
    expect(w.text()).toContain('Создана новая ссылка на 7 дней и скопирована')
  })

  it('never reuses a limited or non-default-status invite and creates a new one', async () => {
    const base = {
      roleToAssign: 'player',
      type: 'organization_join',
      defaultMemberStatus: 'active',
      isRevoked: false,
      expiresAt: null,
      maxUses: null,
      usesCount: 0,
    }
    invites = [
      { ...base, maxUses: 1, deeplinkUrl: 'https://t.me/bot?start=single' },
      { ...base, defaultMemberStatus: 'pending', deeplinkUrl: 'https://t.me/bot?start=pending' },
    ]
    const w = await render()
    await w
      .findAll('header button')
      .find((b) => b.text().includes('Скопировать invite-link'))!
      .trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('https://t.me/bot?start=new')
  })

  it('says the link was created when the clipboard write fails after creating it', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    const w = await render()
    await w
      .findAll('header button')
      .find((b) => b.text().includes('Скопировать invite-link'))!
      .trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('Новая ссылка создана')
  })

  it('lets an organizer copy the link and set levels', async () => {
    actorRole = 'organizer'
    const w = await render()
    expect(w.text()).toContain('Скопировать invite-link')
    await w.findAll('tbody .vt-desktop-members__name')[1]!.trigger('click')
    expect(w.find('#player-drawer-level').exists()).toBe(true)
  })

  it('hides the copy button and the level selector from an assistant', async () => {
    actorRole = 'assistant'
    const w = await render()
    expect(w.text()).not.toContain('Скопировать invite-link')
    await w.findAll('tbody .vt-desktop-members__name')[1]!.trigger('click')
    expect(w.find('#player-drawer-level').exists()).toBe(false)
    expect(w.get('[role="dialog"]').text()).toContain('Не назначен')
  })
})
