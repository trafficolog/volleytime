import { describe, expect, it } from 'vitest'

import {
  organizerMenuLinks,
  organizerHomeSubtitle,
  organizerEventChips,
  organizerTabItems,
  pendingCountsByEvent,
  pendingPaymentsForEvent,
  projectOrganizerHome,
  splitForecastLabel,
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

  it('projects the organizer destinations and a menu action for the layout', () => {
    const base4 = [
      { kind: 'link', to: base, label: 'События', icon: 'calendar' },
      { kind: 'link', to: `${base}/members`, label: 'Игроки', icon: 'users' },
      { kind: 'link', to: `${base}/cashbox`, label: 'Касса', icon: 'chart' },
      { kind: 'link', to: `${base}/payments`, label: 'Оплаты', icon: 'wallet' },
    ]
    const menu = { kind: 'action', id: 'menu', label: 'Меню', icon: 'menu' }
    expect(organizerTabItems(base, { collections: false })).toEqual([...base4, menu])
    // «Сборы» (21.1.5) — между «Оплатами» и «Меню», «Оплаты» не удалены
    expect(organizerTabItems(base)).toEqual([
      ...base4,
      {
        kind: 'link',
        to: `${base}/collections`,
        label: 'Сборы',
        icon: 'gift',
        prefix: true,
        dot: false,
      },
      menu,
    ])
  })

  it('lights the Сборы dot for organizers until the tab was opened', () => {
    expect(
      organizerTabItems(base, { collectionsDot: true }).find((t) => t.label === 'Сборы'),
    ).toMatchObject({
      dot: true,
    })
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

  it('shows the actual active manager role next to the current organization city', () => {
    expect(
      organizerHomeSubtitle(
        7,
        { id: 7, city: 'Минск' },
        {
          organizationId: 7,
          role: 'owner',
          status: 'active',
        },
      ),
    ).toBe('Минск · Владелец')
    expect(
      organizerHomeSubtitle(
        7,
        { id: 7, city: 'Минск' },
        {
          organizationId: 7,
          role: 'organizer',
          status: 'active',
        },
      ),
    ).toBe('Минск · Организатор')
  })

  it('does not show a stale or pending manager role in the Home header', () => {
    const activeOwner = { organizationId: 7, role: 'owner', status: 'active' }
    expect(organizerHomeSubtitle(8, { id: 7, city: 'Минск' }, activeOwner)).toBeUndefined()
    expect(organizerHomeSubtitle(8, { id: 8, city: 'Брест' }, activeOwner)).toBe('Брест')
    expect(
      organizerHomeSubtitle(7, { id: 7, city: 'Минск' }, { ...activeOwner, status: 'pending' }),
    ).toBe('Минск')
  })

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

  it('does not present a canceled event as the next upcoming event', () => {
    const canceled = { ...firstEvent, id: 70, status: 'cancelled' }
    expect(
      projectOrganizerHome(7, organization, member, {
        ...dashboard,
        upcoming: [canceled, firstEvent],
      })?.nextEvent,
    ).toBe(firstEvent)
    expect(
      projectOrganizerHome(7, organization, member, {
        ...dashboard,
        upcoming: [canceled],
      })?.nextEvent,
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

describe('organizer event chips (21.1.1)', () => {
  const ev = { status: 'published', taken: 12, waitlist: 0, price: 1000 }

  it('counts pending payments per event', () => {
    const counts = pendingCountsByEvent([
      { event: { id: 1 } },
      { event: { id: 1 } },
      { event: { id: 2 } },
      { event: null },
    ])
    expect([...counts]).toEqual([
      [1, 2],
      [2, 1],
    ])
  })

  it('says how many wait for payment with number agreement', () => {
    expect(organizerEventChips(ev, 1)).toEqual([{ tone: 'amber', text: '1 ждёт оплаты' }])
    expect(organizerEventChips(ev, 2)).toEqual([{ tone: 'amber', text: '2 ждут оплаты' }])
    expect(organizerEventChips(ev, 21)[0]?.text).toBe('21 ждёт оплаты')
  })

  it('shows green only when somebody is booked and the event is paid', () => {
    expect(organizerEventChips(ev, 0)).toEqual([{ tone: 'grass', text: 'все оплатили' }])
    expect(organizerEventChips({ ...ev, taken: 0 }, 0)).toEqual([])
    expect(organizerEventChips({ ...ev, price: 0 }, 0)).toEqual([])
    expect(organizerEventChips({ ...ev, price: 0, pricing: { mode: 'split' } }, 0)).toEqual([
      { tone: 'grass', text: 'все оплатили' },
    ])
  })

  it('draws no payment chip while pending data is unknown, nor for drafts and cancelled', () => {
    expect(organizerEventChips(ev, null)).toEqual([])
    expect(organizerEventChips({ ...ev, status: 'draft' }, 3)).toEqual([])
    expect(organizerEventChips({ ...ev, status: 'cancelled' }, 3)).toEqual([])
  })

  it('adds a neutral queue chip with people and seats', () => {
    expect(organizerEventChips({ ...ev, waitlist: 2 }, 0)[1]).toEqual({
      tone: 'state',
      text: 'очередь · 2 чел.',
    })
    expect(organizerEventChips({ ...ev, waitlist: 2, waitlistSeats: 3 }, 0)[1]?.text).toBe(
      'очередь · 2 чел. · 3 места',
    )
  })

  it('labels the split price per seat as a forecast until settled', () => {
    const base = { status: 'published', currency: 'BYN' }
    const pricing = { mode: 'split', maxAmount: 3000, basis: 'current' }
    expect(splitForecastLabel({ ...base, pricing })).toBe('≈ 30,00 BYN')
    expect(splitForecastLabel({ ...base, pricing: { ...pricing, basis: 'settled' } })).toBe(
      '30,00 BYN',
    )
    expect(splitForecastLabel({ ...base, pricing: { ...pricing, mode: 'fixed' } })).toBeNull()
    expect(splitForecastLabel({ ...base, status: 'cancelled', pricing })).toBeNull()
  })
})
