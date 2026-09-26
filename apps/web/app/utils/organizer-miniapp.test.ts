import { describe, expect, it } from 'vitest'

import {
  organizerMenuLinks,
  organizerTabItems,
  pendingPaymentsForEvent,
  playerTabItems,
  projectOrganizerHome,
} from './organizer-miniapp'

const base = '/m/orgs/7'

describe('organizer Mini App navigation', () => {
  it('shows active owner links including settings and enabled plans', () => {
    expect(organizerMenuLinks(base, { role: 'owner', status: 'active' }, true)).toEqual([
      { to: `${base}/events/new`, label: 'Создать событие' },
      { to: `${base}/invite`, label: 'Пригласить' },
      { to: `${base}/plans`, label: 'Планы' },
      { to: `${base}/settings`, label: 'Настройки' },
      { to: `${base}/audit`, label: 'Журнал' },
    ])
  })

  it('hides settings from organizers and plans when subscriptions are disabled', () => {
    expect(organizerMenuLinks(base, { role: 'organizer', status: 'active' }, false)).toEqual([
      { to: `${base}/events/new`, label: 'Создать событие' },
      { to: `${base}/invite`, label: 'Пригласить' },
      { to: `${base}/audit`, label: 'Журнал' },
    ])
  })

  it('hides manager links from players and pending members', () => {
    expect(organizerMenuLinks(base, { role: 'player', status: 'active' }, true)).toEqual([])
    expect(organizerMenuLinks(base, { role: 'owner', status: 'pending' }, true)).toEqual([])
    expect(organizerMenuLinks(base, null, true)).toEqual([])
  })

  it('projects four organizer destinations and a menu action for the layout', () => {
    expect(organizerTabItems(base)).toEqual([
      { kind: 'link', to: base, label: 'События', icon: 'calendar' },
      { kind: 'link', to: `${base}/members`, label: 'Игроки', icon: 'users' },
      { kind: 'link', to: `${base}/cashbox`, label: 'Касса', icon: 'chart' },
      { kind: 'link', to: `${base}/payments`, label: 'Оплаты', icon: 'wallet' },
      { kind: 'action', id: 'menu', label: 'Меню', icon: 'menu' },
    ])
  })

  it('keeps player navigation as links', () => {
    expect(playerTabItems(base, false)).toEqual([
      { kind: 'link', to: base, label: 'Главная', icon: 'home' },
      { kind: 'link', to: `${base}/events`, label: 'События', icon: 'calendar', prefix: true },
      { kind: 'link', to: `${base}/bookings`, label: 'Записи', icon: 'ticket' },
    ])
  })
})

describe('event pending payments', () => {
  const payer = { id: 4, name: 'Ирина' }
  const eventPayment = {
    id: 11,
    amount: 2500,
    currency: 'BYN',
    method: 'transfer',
    user: payer,
    event: { id: 71, title: 'Волейбол' },
    plan: null,
  }
  const payments = [
    eventPayment,
    { ...eventPayment, id: 12, event: { id: 72, title: 'Другая игра' } },
    { ...eventPayment, id: 13, event: null, plan: { name: 'Абонемент' } },
  ]

  it('keeps only real payments for the selected event with their actual fields', () => {
    expect(pendingPaymentsForEvent(payments, 71)).toEqual([eventPayment])
    expect(pendingPaymentsForEvent(payments, 71)[0]).toBe(eventPayment)
  })

  it('returns an empty list for an event without pending payments', () => {
    expect(pendingPaymentsForEvent(payments, 73)).toEqual([])
    expect(pendingPaymentsForEvent([], 71)).toEqual([])
  })
})

const firstEvent = {
  id: 71,
  title: 'Волейбол в субботу',
  status: 'draft',
  startsAt: '2026-09-26T14:00:00.000Z',
  endsAt: '2026-09-26T16:00:00.000Z',
  capacity: 12,
  price: 1500,
  currency: 'EUR',
  taken: 4,
  waitlist: 0,
  myBooking: null,
  venue: { name: 'Зал 1' },
  locationText: null,
}

const dashboard = {
  isManager: true,
  upcoming: [firstEvent, { ...firstEvent, id: 72, title: 'Воскресенье' }],
  manager: {
    pendingCount: 3,
    pendingAmount: 4000,
    balance: {
      currency: 'EUR',
      income: 12500,
      expense: 3500,
      balance: 9000,
      byCurrency: {
        EUR: { income: 12500, expense: 3500, balance: 9000 },
        BYN: { income: 800, expense: 100, balance: 700 },
      },
    },
  },
}

describe('organizer Home projection', () => {
  const organization = { id: 7 }
  const member = { role: 'organizer', status: 'active' }

  it('keeps the real balance currency, separate totals, and the first upcoming event', () => {
    expect(projectOrganizerHome(7, organization, member, dashboard)).toEqual({
      balance: dashboard.manager.balance,
      pendingCount: 3,
      nextEvent: firstEvent,
      upcoming: dashboard.upcoming,
    })
  })

  it('has no next event when the dashboard has no upcoming events', () => {
    expect(
      projectOrganizerHome(7, organization, member, { ...dashboard, upcoming: [] })?.nextEvent,
    ).toBeNull()
  })

  it('rejects stale organization data and manager balances during a group switch', () => {
    expect(projectOrganizerHome(8, organization, member, dashboard)).toBeNull()
    expect(projectOrganizerHome(8, { id: 8 }, member, null)).toBeNull()
  })

  it('rejects player, pending-manager, and non-manager dashboard data', () => {
    expect(
      projectOrganizerHome(7, organization, { role: 'player', status: 'active' }, dashboard),
    ).toBeNull()
    expect(
      projectOrganizerHome(7, organization, { role: 'owner', status: 'pending' }, dashboard),
    ).toBeNull()
    expect(
      projectOrganizerHome(7, organization, member, { ...dashboard, isManager: false }),
    ).toBeNull()
  })
})
