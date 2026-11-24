import { describe, expect, it } from 'vitest'

import {
  defaultNearbyLevel,
  nearbyGroupPath,
  nearbyLevelLabel,
  nearbyLevelOptions,
  nearbyPlace,
  nearbyPrice,
  nearbyQuery,
  nearbySeats,
  nearbyWhen,
  type NearbyGame,
} from './nearby-games'

const levels = [
  { code: 'v2', title: 'В2', description: '', sortOrder: 2 },
  { code: 'v1', title: 'В1', description: '', sortOrder: 1 },
]
const game = (extra: Partial<NearbyGame> = {}): NearbyGame => ({
  id: 1,
  title: 'Открытая игра',
  startsAt: '2035-03-10T17:00:00.000Z',
  endsAt: '2035-03-10T19:00:00.000Z',
  level: null,
  place: { name: 'Школа №24', address: 'ул. Ленина, 1' },
  capacity: 12,
  price: { amount: 1200, currency: 'BYN' },
  taken: 9,
  full: false,
  publicSlug: 'abcdef012345',
  group: {
    id: 3,
    slug: 'volley-minsk',
    name: 'Волей Минск',
    city: 'Минск',
    district: null,
    logoUpdatedAt: null,
    timezone: 'Europe/Minsk',
  },
  ...extra,
})

describe('nearby games helpers (30.3.3)', () => {
  it('defaults the filter to my level, or to all when none is assigned', () => {
    expect(defaultNearbyLevel('v2')).toBe('v2')
    expect(defaultNearbyLevel(null)).toBe('all')
    expect(defaultNearbyLevel(undefined)).toBe('all')
  })

  it('lists all + levels in scale order, without a "no level" option', () => {
    expect(nearbyLevelOptions(levels)).toEqual([
      { value: 'all', label: 'Все' },
      { value: 'v1', label: 'мой уровень В1' },
      { value: 'v2', label: 'мой уровень В2' },
    ])
  })

  it('builds the query: no level for "all", offset only when paging', () => {
    expect(nearbyQuery('Минск', 'all')).toEqual({ city: 'Минск', limit: 20 })
    expect(nearbyQuery('Минск', 'v2', 20)).toEqual({
      city: 'Минск',
      level: 'v2',
      limit: 20,
      offset: 20,
    })
  })

  it('shows time in the time zone of the organizing group', () => {
    expect(nearbyWhen(game())).toMatch(/20:00–22:00$/)
    expect(nearbyWhen(game({ group: { ...game().group, timezone: 'UTC' } }))).toMatch(
      /17:00–19:00$/,
    )
  })

  it('formats seats and full state', () => {
    expect(nearbySeats(game())).toBe('3 места')
    expect(nearbySeats(game({ taken: 11 }))).toBe('1 место')
    expect(nearbySeats(game({ taken: 12, full: true }))).toBe('Мест нет')
    expect(nearbySeats(game({ capacity: 5, taken: 0 }))).toBe('5 мест')
  })

  it('formats the fixed price, free games and hides split-price games', () => {
    expect(nearbyPrice(game())).toMatch(/^12,00\s?BYN$/)
    expect(nearbyPrice(game({ price: { amount: 0, currency: 'BYN' } }))).toBe('Бесплатно')
    expect(nearbyPrice(game({ price: null }))).toBeNull()
  })

  it('labels level, place and the group page link', () => {
    expect(nearbyLevelLabel(game({ level: 'v2' }), levels)).toBe('В2')
    expect(nearbyLevelLabel(game(), levels)).toBe('любой уровень')
    expect(nearbyPlace(game())).toBe('Школа №24')
    expect(nearbyPlace(game({ place: { name: null, address: null } }))).toBeNull()
    expect(nearbyGroupPath(game())).toBe('/g/volley-minsk')
  })
})
