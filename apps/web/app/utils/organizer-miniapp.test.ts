import { describe, expect, it } from 'vitest'

import { organizerMenuLinks, organizerTabItems, playerTabItems } from './organizer-miniapp'

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
