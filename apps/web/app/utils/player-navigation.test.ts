import { describe, expect, it } from 'vitest'

import { playerGroupOptions, playerProfileFields, playerTabs } from './player-navigation'

describe('player Mini App navigation', () => {
  it('shows Главная and Профиль only when subscriptions are unavailable', () => {
    expect(playerTabs('/m/orgs/2', { showMenu: false }).map((tab) => tab.label)).toEqual([
      'Главная',
      'Профиль',
    ])
    expect(playerTabs('/m/orgs/2', { showMenu: false }).map((tab) => tab.to)).toEqual([
      '/m/orgs/2',
      '/m/orgs/2/profile',
    ])
  })

  it('adds Абонементы between Главная and Профиль when enabled, without a bookings tab', () => {
    const tabs = playerTabs('/m/orgs/2', { showMenu: true })
    expect(tabs.map((tab) => tab.label)).toEqual(['Главная', 'Абонементы', 'Профиль'])
    expect(tabs[1]?.to).toBe('/m/orgs/2/subscriptions')
    expect(tabs.some((tab) => tab.to.endsWith('/bookings'))).toBe(false)
  })
})

describe('group switcher choices', () => {
  const groups = [
    { id: 1, name: 'Группа А', city: 'Минск', status: 'active', membershipStatus: 'active' },
    { id: 2, name: 'Группа Б', city: null, status: 'active', membershipStatus: 'pending' },
    { id: 3, name: 'Группа В', city: null, status: 'suspended', membershipStatus: 'active' },
  ] as const

  it('selects only active groups while linking restricted groups to their informational pages', () => {
    expect(playerGroupOptions(groups, 1).map((group) => group.selectable)).toEqual([
      true,
      false,
      false,
    ])
    expect(playerGroupOptions(groups, 1).map((group) => group.to)).toEqual([
      '/m/orgs/1',
      '/m/orgs/2',
      '/m/orgs/3',
    ])
  })

  it('labels pending and suspended groups without inventing membership data', () => {
    expect(playerGroupOptions(groups, 1).map((group) => group.statusLabel)).toEqual([
      null,
      'Заявка на рассмотрении',
      'Группа приостановлена',
    ])
    expect(playerGroupOptions(groups, 1).map((group) => group.selected)).toEqual([
      true,
      false,
      false,
    ])
  })
})

describe('profile facts', () => {
  it('shows no invented identity fields when the session is absent', () => {
    expect(playerProfileFields(null)).toEqual([])
  })

  it('omits name, email and username when they are not present', () => {
    expect(playerProfileFields({ name: null, email: null, telegramUsername: null })).toEqual([])
  })

  it('shows only real personal fields', () => {
    expect(
      playerProfileFields({ name: 'Анна', email: null, telegramUsername: 'anna_volley' }),
    ).toEqual([
      { label: 'Имя', value: 'Анна' },
      { label: 'Telegram', value: '@anna_volley' },
    ])
  })
})
