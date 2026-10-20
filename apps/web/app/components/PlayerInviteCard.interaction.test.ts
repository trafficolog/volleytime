// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { InviteAccessView, InviteState } from '~/utils/player-invite'

import PlayerInviteCard from './PlayerInviteCard.vue'

const organizer = { name: 'Иван Петренко', telegramUsername: null, image: null }
const view = (state: InviteState, over: Partial<InviteAccessView> = {}): InviteAccessView => ({
  state,
  request: null,
  invite: null,
  organizer,
  ...over,
})

function mountCard(access: InviteAccessView) {
  return mount(PlayerInviteCard, {
    props: {
      state: access.state,
      access,
      tz: 'Europe/Minsk',
      now: new Date('2026-05-29T16:30:00.000Z'),
      eventsHref: '/m/orgs/3/events',
    },
    global: {
      stubs: {
        VtIcon: { template: '<i />' },
        VtAvatar: { props: ['name'], template: '<b class="avi">{{ name }}</b>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
}

describe('PlayerInviteCard: four M-08 states (20.4.7, D-06)', () => {
  it('none: explains invite-only booking and offers to request', async () => {
    const w = mountCard(view('none'))
    expect(w.text()).toContain('Запись по приглашению')
    expect(w.text()).toContain('Организатор сам решает, кто играет в этот раз')
    expect(w.text()).toContain('ответ придёт в бот')
    await w.get('[data-invite-request]').trigger('click')
    expect(w.emitted('request')).toHaveLength(1)
    expect(w.text()).toContain('Запросить приглашение')
    expect(w.find('[data-invite-withdraw]').exists()).toBe(false)
  })

  it('requested: timeline with the sent time, organizer, disabled booking, withdraw', async () => {
    const w = mountCard(
      view('requested', {
        request: { id: 1, status: 'pending', createdAt: '2026-05-29T16:24:00.000Z' },
      }),
    )
    expect(w.text()).toContain('Ваш запрос')
    expect(w.text()).toContain('Запрос отправлен')
    expect(w.text()).toContain('сегодня, 19:24')
    expect(w.text()).toContain('Организатор рассматривает')
    expect(w.text()).toContain('Ответ придёт в бот')
    expect(w.text()).toContain('Иван Петренко · организатор')
    const book = w.findAll('button').find((b) => b.text().includes('Записаться'))!
    expect(book.attributes('disabled')).toBeDefined()
    expect(book.text()).toContain('после ответа')
    await w.get('[data-invite-withdraw]').trigger('click')
    expect(w.emitted('withdraw')).toHaveLength(1)
    expect(w.find('[data-invite-request]').exists()).toBe(false)
  })

  it('invited: inviter, one-time link with expiry, no extra buttons', () => {
    const w = mountCard(
      view('invited', {
        invite: { source: 'link', expiresAt: '2026-05-29T17:00:00.000Z', inviter: organizer },
      }),
    )
    expect(w.text()).toContain('Иван Петренко пригласил вас')
    expect(w.text()).toContain('по личной ссылке')
    expect(w.text()).toContain('Ссылка одноразовая и действует до 29 мая, 20:00')
    expect(w.text()).toContain('Место не держится, пока вы не запишетесь')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('invited by an approved request says so', () => {
    const w = mountCard(
      view('invited', { invite: { source: 'request', expiresAt: null, inviter: organizer } }),
    )
    expect(w.text()).toContain('по вашему запросу')
    expect(w.text()).not.toContain('действует до')
  })

  it('expired: red alert with the date, request a new one, other events', async () => {
    const w = mountCard(
      view('expired', {
        invite: { source: 'link', expiresAt: '2026-05-28T17:00:00.000Z', inviter: organizer },
      }),
    )
    expect(w.get('[role="alert"]').text()).toContain('Ссылка больше не действует')
    expect(w.text()).toContain('Срок приглашения истёк 28 мая, 20:00')
    expect(w.text()).toContain('организатор получит запрос в бот')
    expect(w.get('[data-invite-request]').text()).toBe('Запросить новое приглашение')
    expect(w.get('a').attributes('href')).toBe('/m/orgs/3/events')
    expect(w.get('a').text()).toBe('Другие события группы')
    await w.get('[data-invite-request]').trigger('click')
    expect(w.emitted('request')).toHaveLength(1)
  })
})
