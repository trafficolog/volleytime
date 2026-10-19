import {
  closeDb,
  db,
  organizationMembers,
  organizations,
  payments,
  users,
  type User,
} from '@volley-time/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { planService } from '../subscription-plans/service'
import { venueService } from '../venues/service'

import { searchService } from './service'

describe('cabinet search (integration, 20.5.2)', () => {
  let owner: User
  let player: User
  let orgId: number
  let otherOrgId: number

  const newUser = async (v: Partial<typeof users.$inferInsert>) =>
    (
      await db
        .insert(users)
        .values({ email: `${Math.random()}@search.test`, ...v })
        .returning()
    )[0]!
  const soon = (h: number) => new Date(Date.now() + h * 3600_000)

  beforeAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    owner = await newUser({ name: 'Owner One' })
    player = await newUser({
      name: 'Ольга Волкова',
      telegramUsername: 'olga_v',
      phone: '+375291112233',
      telegramUserId: 987654321n,
    })
    const stranger = await newUser({ name: 'Ольга Чужая', telegramUsername: 'olga_foreign' })
    const pending = await newUser({ name: 'Олег Заявкин' })
    const left = await newUser({ name: 'Олег Вышедший' })

    orgId = (await organizationService.create({ userId: owner.id }, { name: 'Search A' })).id
    otherOrgId = (await organizationService.create({ userId: stranger.id }, { name: 'Search B' }))
      .id
    const add = (userId: number, status: 'active' | 'pending' = 'active') =>
      memberService.add({ userId: owner.id }, { organizationId: orgId, userId, status })
    await add(player.id)
    await add(pending.id, 'pending')
    await db
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: left.id, status: 'left' })

    const venue = await venueService.create(
      { userId: owner.id },
      { organizationId: orgId, name: 'Зал Спартак' },
    )
    await eventService.create({ userId: owner.id }, orgId, {
      title: 'Пятничная игра',
      venueId: venue.id,
      startsAt: soon(24),
      endsAt: soon(26),
      capacity: 10,
      price: 1500,
    })
    await eventService.create({ userId: owner.id }, orgId, {
      title: 'Пятничный черновик',
      startsAt: soon(48),
      endsAt: soon(50),
      capacity: 10,
      price: 1500,
      status: 'draft',
    })
    await eventService.create({ userId: stranger.id }, otherOrgId, {
      title: 'Пятничная игра чужой группы',
      startsAt: soon(24),
      endsAt: soon(26),
      capacity: 10,
      price: 1500,
    })
    const plan = await planService.create(
      { userId: owner.id },
      { organizationId: orgId, name: 'Абонемент Золотой', totalSessions: 8, price: 8000 },
    )
    await db.insert(payments).values([
      { organizationId: orgId, userId: player.id, amount: 1500, method: 'cash', note: 'secret' },
      { organizationId: otherOrgId, userId: player.id, amount: 999, method: 'cash' },
    ])
    expect(plan.id).toBeGreaterThan(0)
  }, 60_000)

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('groups hits by type for a manager, hides other groups and private fields', async () => {
    const res = await searchService.search({ userId: owner.id }, orgId, { isManager: true }, 'ол')
    expect(res.searched).toBe(true)
    const names = res.players.items.map((p) => p.name).sort()
    // активный, заявка — да; вышедший и участник другой группы — нет
    expect(names).toEqual(['Олег Заявкин', 'Ольга Волкова'])
    expect(Object.keys(res.players.items[0]!).sort()).toEqual([
      'image',
      'memberId',
      'name',
      'role',
      'status',
      'telegramUsername',
      'userId',
    ])
    const json = JSON.stringify(res)
    for (const secret of [
      '+375291112233',
      '987654321',
      '@search.test',
      'secret',
      'чужой',
      'foreign',
    ]) {
      expect(json).not.toContain(secret)
    }

    const ev = await searchService.search(
      { userId: owner.id },
      orgId,
      { isManager: true },
      'пятнич',
    )
    expect(ev.events.items.map((e) => e.title).sort()).toEqual([
      'Пятничная игра',
      'Пятничный черновик',
    ])
    expect(ev.events.items.find((e) => e.title === 'Пятничная игра')?.venueName).toBe('Зал Спартак')

    const byVenue = await searchService.search(
      { userId: owner.id },
      orgId,
      { isManager: true },
      'спартак',
    )
    expect(byVenue.events.items).toHaveLength(1)

    const pay = await searchService.search(
      { userId: owner.id },
      orgId,
      { isManager: true },
      '@OLGA_v',
    )
    expect(pay.players.items).toHaveLength(1)
    expect(pay.payments!.items).toHaveLength(1)
    expect(pay.payments!.items[0]).toMatchObject({ amount: 1500, user: { id: player.id } })
  })

  it('a regular member gets active players and published events only, never payments', async () => {
    const asPlayer = { userId: player.id }
    const ev = await searchService.search(asPlayer, orgId, { isManager: false }, 'пятнич')
    expect(ev.events.items.map((e) => e.title)).toEqual(['Пятничная игра'])
    const pl = await searchService.search(asPlayer, orgId, { isManager: false }, 'ол')
    expect(pl.players.items.map((p) => p.name)).toEqual(['Ольга Волкова'])
    expect(pl.payments).toBeNull()
    const money = await searchService.search(asPlayer, orgId, { isManager: false }, 'Золотой')
    expect(money.payments).toBeNull()
    expect(JSON.stringify(money)).not.toContain('1500')
  })

  it('treats LIKE wildcards literally and ignores too-short queries', async () => {
    const wild = await searchService.search({ userId: owner.id }, orgId, { isManager: true }, '%%')
    expect(wild.players.items).toEqual([])
    expect(wild.events.items).toEqual([])
    const short = await searchService.search(
      { userId: owner.id },
      orgId,
      { isManager: true },
      ' о ',
    )
    expect(short.searched).toBe(false)
    expect(short.players.items).toEqual([])
  })

  it('answers in under 300 ms on a group of 2000 players', async () => {
    const perfOrg = (await organizationService.create({ userId: owner.id }, { name: 'Perf' })).id
    const rows = Array.from({ length: 2000 }, (_, i) => ({
      email: `perf-${i}@search.test`,
      name: `Игрок ${i} ${i % 7 === 0 ? 'Иванов' : 'Петров'}`,
      telegramUsername: `perf_${i}`,
    }))
    const created = await db.insert(users).values(rows).returning({ id: users.id })
    await db
      .insert(organizationMembers)
      .values(
        created.map((u) => ({ organizationId: perfOrg, userId: u.id, status: 'active' as const })),
      )
    await searchService.search({ userId: owner.id }, perfOrg, { isManager: true }, 'иванов')
    const started = performance.now()
    const res = await searchService.search(
      { userId: owner.id },
      perfOrg,
      { isManager: true },
      'иванов',
    )
    const elapsed = performance.now() - started
    expect(res.players.items).toHaveLength(8)
    expect(res.players.more).toBe(true)
    expect(elapsed).toBeLessThan(300)
  }, 60_000)
})
