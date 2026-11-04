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
    role: 'player' as const,
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

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  invites = []
  apiFetch.mockReset().mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (url === '/api/organizations/30/members') return { members: structuredClone(all) }
    if (url === '/api/organizations/30/invites' && !opts?.method) return { invites }
    if (url === '/api/organizations/30/invites')
      return { deeplinkUrl: 'https://t.me/bot?start=new' }
    if (url.endsWith('/level')) return { member: { level: 'v2' } }
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
    return { data: ref({ myMember: { role: 'owner', status: 'active', userId: 9 } }) }
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
      'Роль',
      'Действия',
    ])
    expect(w.text()).toContain('уровень В1')
    expect(w.text()).toContain('@synthetic_one')
    expect(w.text()).not.toMatch(/Амплуа|Абонемент|Задолж/)
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

  it('copies an existing player invite link without creating a new one', async () => {
    invites = [
      {
        roleToAssign: 'player',
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
  })
})
