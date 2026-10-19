import {
  closeDb,
  db,
  eq,
  events,
  inArray,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import { organizationService } from '../organizations/service'

import { readPublicEvent } from './public-event'
import { readEventPriceQuote } from './pricing-read-model'
import { eventPricingService } from './pricing-service'
import { eventService } from './service'

/**
 * Task 20.6.1 (P-17): публичное чтение события без авторизации. Цена — тот же расчёт, что у
 * `GET …/events/{id}/price`; в ответе нет ни уровней, ни персональных данных игроков, ни
 * приглашений; скрытое (черновик, архивная группа) неотличимо от несуществующего.
 */
describe('public event read model (20.6.1)', { timeout: 30_000 }, () => {
  let ownerId: number
  let orgId: number
  let people: number[] = []
  const names = ['Артём Иванов', 'Никита Петров', 'Маша Сидорова', 'Олег', 'Ян Ли', 'Вера К']

  const make = async (overrides: Record<string, unknown> = {}) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Открытая игра',
      description: 'Микс из играющих регулярно и новых ребят.',
      locationText: 'СК «Заслонова»',
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 93600000),
      capacity: 6,
      price: overrides.priceMode === 'split' ? 0 : 1500,
      ...overrides,
    })
  const slugOf = async (id: number) =>
    (await db.select({ s: events.publicSlug }).from(events).where(eq(events.id, id)))[0]!.s
  const read = async (id: number) => readPublicEvent(await slugOf(id))
  const reserve = (index: number, id: number) =>
    bookingService.book({ userId: people[index]! }, orgId, id, { method: 'cash' })

  beforeEach(async () => {
    people = (
      await db
        .insert(users)
        .values(
          [...names, 'Нет брони'].map((name, i) => ({
            email: `public-${crypto.randomUUID()}-${i}@test.by`,
            name,
            telegramUsername: `secret_user_${crypto.randomUUID().slice(0, 8)}`,
          })),
        )
        .returning()
    ).map((p) => p.id)
    ownerId = people[0]!
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Public Group' })).id
    await db.insert(organizationMembers).values(
      people.slice(1).map((userId) => ({
        userId,
        organizationId: orgId,
        role: 'player' as const,
        status: 'active' as const,
        level: 'v2' as const,
      })),
    )
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await db.delete(users).where(inArray(users.id, people))
  })
  afterAll(closeDb)

  it('returns null for unknown or malformed slugs', async () => {
    expect(await readPublicEvent('000000000000')).toBeNull()
    expect(await readPublicEvent('not-a-slug')).toBeNull()
    expect(await readPublicEvent("'; drop table events;--")).toBeNull()
  })

  it('hides drafts and archived groups exactly like a missing event', async () => {
    const draft = await make({ status: 'draft' })
    expect(await read(draft.id)).toBeNull()
    const ok = await make()
    expect(await read(ok.id)).not.toBeNull()
    await db.update(organizations).set({ status: 'archived' }).where(eq(organizations.id, orgId))
    expect(await read(ok.id)).toBeNull()
    await db.update(organizations).set({ status: 'suspended' }).where(eq(organizations.id, orgId))
    expect(await read(ok.id)).toBeNull()
  })

  it('shows the event facts, seat counters and the group line', async () => {
    const ev = await make()
    await reserve(1, ev.id)
    await reserve(2, ev.id)
    const view = (await read(ev.id))!
    expect(view).toMatchObject({
      slug: await slugOf(ev.id),
      event: {
        title: 'Открытая игра',
        description: 'Микс из играющих регулярно и новых ребят.',
        place: { name: 'СК «Заслонова»', address: null },
        status: 'published',
        capacity: 6,
        taken: 2,
        players: 2,
        full: false,
        currency: 'BYN',
        joinMode: 'open',
      },
      group: { name: 'Public Group', timezone: 'Europe/Minsk', memberCount: 7 },
    })
    expect(typeof view.event.startsAt).toBe('string')
    expect(view.startParam).toMatch(/^event_\d+$/)
  })

  it('reports «full» from occupancy, not from the price', async () => {
    const ev = await make({ capacity: 2, priceMode: 'split', targetAmount: 10000 })
    await reserve(1, ev.id)
    await reserve(2, ev.id)
    const view = (await read(ev.id))!
    expect(view.event).toMatchObject({ taken: 2, capacity: 2, full: true })
    // seatCount.current ограничен вместимостью и от занятости не отличается: признак — не цена
    expect(view.price!.seatCount).toEqual({ current: 2, max: 2 })
  })

  describe('price agrees with GET …/events/{id}/price (quoteEventPrice)', () => {
    const endpointQuote = (id: number) =>
      readEventPriceQuote(
        { userId: people[6]! }, // участник группы без брони: места по умолчанию = 1
        { organizationId: orgId, eventId: id, includeDrafts: false },
      )

    it('fixed price', async () => {
      const ev = await make({ price: 1500 })
      const view = (await read(ev.id))!
      expect(view.price).toEqual(await endpointQuote(ev.id))
      expect(view.price).toMatchObject({ mode: 'fixed', perSeat: { min: 1500, max: 1500 } })
    })

    it('split forecast follows the roster and never exceeds capacity', async () => {
      const ev = await make({ capacity: 4, priceMode: 'split', targetAmount: 10001 })
      for (const n of [0, 1, 2, 3]) {
        expect((await read(ev.id))!.price).toEqual(await endpointQuote(ev.id))
        if (n < 3) await reserve(n + 1, ev.id)
      }
      expect((await read(ev.id))!.price).toMatchObject({ basis: 'forecast' })
    })

    it('split settled', async () => {
      const ev = await make({ capacity: 4, priceMode: 'split', targetAmount: 10001 })
      await reserve(1, ev.id)
      await reserve(2, ev.id)
      await reserve(3, ev.id)
      await eventPricingService.settle({ userId: ownerId }, orgId, ev.id)
      const view = (await read(ev.id))!
      expect(view.price).toEqual(await endpointQuote(ev.id))
      expect(view.price).toMatchObject({ basis: 'settled', seatCount: { current: 3, max: 3 } })
    })
  })

  it('hides the price of a cancelled event and still names the state', async () => {
    const ev = await make({ priceMode: 'split', targetAmount: 10000 })
    await reserve(1, ev.id)
    await eventService.cancel({ userId: ownerId }, ev.id)
    const view = (await read(ev.id))!
    expect(view.event.status).toBe('cancelled')
    expect(view.price).toBeNull()
  })

  it('shows initials only: no names, usernames, ids, avatars, levels or payments', async () => {
    const ev = await make({ capacity: 8 })
    for (const i of [1, 2, 3, 4, 5, 6]) await reserve(i, ev.id)
    const view = (await read(ev.id))!
    expect(view.roster.initials).toEqual(['НП', 'МС', 'О', 'ЯЛ', 'ВК'])
    expect(view.roster.more).toBe(1)
    const json = JSON.stringify(view)
    for (const secret of [
      'Никита',
      'Петров',
      'Маша',
      'Сидорова',
      'secret_user',
      '@test.by',
      'level',
      'v2',
      'telegram',
      'image',
      'payment',
      'paid',
      'userId',
      'token',
    ])
      expect(json).not.toContain(secret)
    expect(Object.keys(view).sort()).toEqual(
      ['event', 'group', 'indexable', 'price', 'roster', 'slug', 'startParam'].sort(),
    )
  })

  it('hides initials (counter only) below 3 players and after the event ends (2026-10-19)', async () => {
    const ev = await make({ capacity: 8 })
    await reserve(1, ev.id)
    await reserve(2, ev.id)
    let view = (await read(ev.id))!
    expect(view.event.players).toBe(2)
    expect(view.roster).toEqual({ initials: [], more: 0 })
    await reserve(3, ev.id)
    view = (await read(ev.id))!
    expect(view.roster.initials).toEqual(['НП', 'МС', 'О'])
    // событие закончилось: инициалы скрыты, счётчики остаются
    await db
      .update(events)
      .set({
        startsAt: new Date(Date.now() - 7200000),
        endsAt: new Date(Date.now() - 3600000),
      })
      .where(eq(events.id, ev.id))
    view = (await read(ev.id))!
    expect(view.roster).toEqual({ initials: [], more: 0 })
    expect(view.event.players).toBe(3)
    // и по статусу «завершено»
    await db
      .update(events)
      .set({ status: 'finished', endsAt: new Date(Date.now() + 3600000) })
      .where(eq(events.id, ev.id))
    expect((await read(ev.id))!.roster).toEqual({ initials: [], more: 0 })
  })

  it('players counter equals the roster of occupying bookings (waitlist and cancelled excluded)', async () => {
    const ev = await make({ capacity: 3 })
    for (const i of [1, 2, 3]) await reserve(i, ev.id)
    await reserve(4, ev.id) // лист ожидания
    const view = (await read(ev.id))!
    expect(view.event.players).toBe(3)
    expect(view.roster.initials).toHaveLength(3)
  })

  it('invite-only events: no initials, never indexable, no invite data', async () => {
    const ev = await make()
    for (const i of [1, 2, 3, 4]) await reserve(i, ev.id)
    await db.update(events).set({ joinMode: 'invite' }).where(eq(events.id, ev.id))
    await db.update(organizations).set({ seoIndex: true }).where(eq(organizations.id, orgId))
    const view = (await read(ev.id))!
    expect(view.event.joinMode).toBe('invite')
    expect(view.roster.initials).toEqual([])
    expect(view.indexable).toBe(false)
    expect(JSON.stringify(view)).not.toMatch(/invite_?token|inviteToken/i)
  })

  it('is indexable only for open events of groups with seoIndex', async () => {
    const ev = await make()
    expect((await read(ev.id))!.indexable).toBe(false)
    await db.update(organizations).set({ seoIndex: true }).where(eq(organizations.id, orgId))
    expect((await read(ev.id))!.indexable).toBe(true)
    await eventService.cancel({ userId: ownerId }, ev.id)
    expect((await read(ev.id))!.indexable).toBe(false)
  })
})
