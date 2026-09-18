import { closeDb, db, eq, events, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'
import { venueService } from '../venues/service'

import {
  EventNotEditableError,
  EventNotFoundError,
  EventStartsInPastError,
  VenueNotInOrgError,
} from './errors'
import { eventService } from './service'

let ownerId: number
let orgId: number

// события только в будущем (5.13.11): базовая дата — завтра
const day = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
const t = (h: number) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00Z`)

function base() {
  return { title: 'Тренировка', startsAt: t(18), endsAt: t(20), capacity: 12 }
}

describe('eventService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `e-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Event Org' })
    orgId = org.id
  })

  it('creates event with defaults', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, base())
    expect(ev.type).toBe('training')
    expect(ev.status).toBe('published')
    expect(ev.price).toBe(0)
    expect(ev.capacity).toBe(12)
  })

  it('rejects endsAt before startsAt (zod)', async () => {
    await expect(
      eventService.create({ userId: ownerId }, orgId, { ...base(), endsAt: t(17) }),
    ).rejects.toThrow()
  })

  it('event currency follows organization; mismatch rejected (6.8.8)', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, base())
    expect(ev.currency).toBe('BYN')
    await expect(
      eventService.create({ userId: ownerId }, orgId, { ...base(), currency: 'RUB' }),
    ).rejects.toThrow(/does not match/)
  })

  it('links a valid venue', async () => {
    const venue = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Зал' },
    )
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      ...base(),
      venueId: venue.id,
    })
    expect(ev.venueId).toBe(venue.id)
  })

  it('rejects venue from another org', async () => {
    const [u2] = await db
      .insert(users)
      .values({ email: `x-${Math.random()}@t.by` })
      .returning()
    const otherOrg = await organizationService.create({ userId: u2!.id }, { name: 'Other' })
    const foreignVenue = await venueService.create(
      { userId: u2!.id },
      { organizationId: otherOrg.id, name: 'Foreign' },
    )
    await expect(
      eventService.create({ userId: ownerId }, orgId, { ...base(), venueId: foreignVenue.id }),
    ).rejects.toThrow(VenueNotInOrgError)
  })

  it('stores price as minor units', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, { ...base(), price: 1500 })
    expect(ev.price).toBe(1500)
  })

  it('updates event fields', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, base())
    const updated = await eventService.update({ userId: ownerId }, ev.id, { capacity: 16 })
    expect(updated.capacity).toBe(16)
  })

  it('cancel sets status and is idempotent', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, base())
    const c1 = await eventService.cancel({ userId: ownerId }, ev.id)
    expect(c1.status).toBe('cancelled')
    const c2 = await eventService.cancel({ userId: ownerId }, ev.id)
    expect(c2.status).toBe('cancelled')
  })

  it('cannot edit cancelled event', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, base())
    await eventService.cancel({ userId: ownerId }, ev.id)
    await expect(eventService.update({ userId: ownerId }, ev.id, { capacity: 20 })).rejects.toThrow(
      EventNotEditableError,
    )
  })

  it('getById throws for missing', async () => {
    await expect(eventService.getById({ userId: ownerId }, 99999)).rejects.toThrow(
      EventNotFoundError,
    )
  })

  it('list filters upcoming vs past', async () => {
    // прошедшее событие: создать в прошлом нельзя (5.13.11) — сдвигаем после создания
    await expect(
      eventService.create({ userId: ownerId }, orgId, {
        title: 'Прошлое',
        startsAt: new Date('2020-01-01T18:00:00Z'),
        endsAt: new Date('2020-01-01T20:00:00Z'),
        capacity: 10,
      }),
    ).rejects.toThrow(EventStartsInPastError)
    const old = await eventService.create({ userId: ownerId }, orgId, base())
    await db
      .update(events)
      .set({ startsAt: new Date('2020-01-01T18:00:00Z'), endsAt: new Date('2020-01-01T20:00:00Z') })
      .where(eq(events.id, old.id))
    // будущее
    await eventService.create({ userId: ownerId }, orgId, {
      title: 'Будущее',
      startsAt: new Date('2030-01-01T18:00:00Z'),
      endsAt: new Date('2030-01-01T20:00:00Z'),
      capacity: 10,
    })
    const upcoming = await eventService.list({ userId: ownerId }, orgId, { filter: 'upcoming' })
    expect(upcoming.every((e) => e.startsAt >= new Date())).toBe(true)
    const past = await eventService.list({ userId: ownerId }, orgId, { filter: 'past' })
    expect(past.every((e) => e.startsAt < new Date())).toBe(true)
    const all = await eventService.list({ userId: ownerId }, orgId, { filter: 'all' })
    expect(all.length).toBe(upcoming.length + past.length)
  })

  it('list filters by status', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, base())
    await eventService.cancel({ userId: ownerId }, ev.id)
    const cancelled = await eventService.list({ userId: ownerId }, orgId, {
      filter: 'all',
      status: 'cancelled',
    })
    expect(cancelled.every((e) => e.status === 'cancelled')).toBe(true)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
