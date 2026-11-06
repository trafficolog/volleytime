import {
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  eventSeries,
  events,
  organizations,
  scheduleSlots,
  users,
  venues,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { VenueArchivedError, VenueNotInOrgError } from '../events/errors'
import { organizationService } from '../organizations/service'
import { venueService } from '../venues/service'

import { ScheduleSlotLimitError, ScheduleSlotNotFoundError } from './errors'
import { SCHEDULE_SLOTS_MAX } from './schemas'
import { scheduleSlotService } from './service'

let ownerId: number
let orgId: number
let otherOrgId: number

const base = { weekday: 1, startTime: '20:00', title: 'Основа', capacity: 12 }

describe('scheduleSlotService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `ss-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Slots A' })).id
    otherOrgId = (await organizationService.create({ userId: ownerId }, { name: 'Slots B' })).id
  })

  afterAll(async () => {
    await closeDb()
  })

  const ctx = () => ({ userId: ownerId })

  it('creates a slot with defaults and lists it ordered by weekday and time', async () => {
    await scheduleSlotService.create(ctx(), orgId, { ...base, weekday: 5, startTime: '19:30' })
    const first = await scheduleSlotService.create(ctx(), orgId, { ...base, startTime: '20:00' })
    await scheduleSlotService.create(ctx(), orgId, { ...base, startTime: '18:00' })
    expect(first).toMatchObject({
      weekday: 1,
      startTime: '20:00',
      durationMinutes: 120,
      type: 'training',
      venueId: null,
      venueName: null,
      venueArchived: false,
    })
    const list = await scheduleSlotService.list(ctx(), orgId)
    expect(list.map((s) => `${s.weekday} ${s.startTime}`)).toEqual([
      '1 18:00',
      '1 20:00',
      '5 19:30',
    ])
  })

  it('accepts the boundary values and rejects values outside them', async () => {
    const ok = [
      { weekday: 1, startTime: '00:00', durationMinutes: 15, capacity: 1 },
      { weekday: 7, startTime: '23:59', durationMinutes: 1440, capacity: 500 },
    ]
    for (const over of ok) await scheduleSlotService.create(ctx(), orgId, { ...base, ...over })

    const bad = [
      { weekday: 0 },
      { weekday: 8 },
      { weekday: 1.5 },
      { startTime: '24:00' },
      { startTime: '7:00' },
      { startTime: '20:60' },
      { durationMinutes: 14 },
      { durationMinutes: 1441 },
      { capacity: 0 },
      { capacity: 501 },
      { capacity: 1.5 },
      { title: ' a ' },
      { title: 'x'.repeat(201) },
      { type: 'tournament_match' },
      { organizationId: otherOrgId }, // группа берётся из контекста, не из тела
    ]
    for (const over of bad) {
      await expect(scheduleSlotService.create(ctx(), orgId, { ...base, ...over })).rejects.toThrow()
    }
    expect(await scheduleSlotService.list(ctx(), orgId)).toHaveLength(2)
  })

  it('trims the title', async () => {
    const slot = await scheduleSlotService.create(ctx(), orgId, { ...base, title: '  Микст  ' })
    expect(slot.title).toBe('Микст')
  })

  it('updates only the given fields and clears the venue with null', async () => {
    const venue = await venueService.create(ctx(), { organizationId: orgId, name: 'Школа №24' })
    const slot = await scheduleSlotService.create(ctx(), orgId, { ...base, venueId: venue.id })
    expect(slot.venueName).toBe('Школа №24')

    const moved = await scheduleSlotService.update(ctx(), orgId, slot.id, {
      weekday: 3,
      capacity: 14,
    })
    expect(moved).toMatchObject({ weekday: 3, capacity: 14, startTime: '20:00', venueId: venue.id })

    const cleared = await scheduleSlotService.update(ctx(), orgId, slot.id, { venueId: null })
    expect(cleared.venueId).toBeNull()

    expect(await scheduleSlotService.update(ctx(), orgId, slot.id, {})).toMatchObject({
      weekday: 3,
    })
    await expect(
      scheduleSlotService.update(ctx(), orgId, slot.id, { weekday: 9 }),
    ).rejects.toThrow()
    await expect(
      scheduleSlotService.update(ctx(), orgId, slot.id, { organizationId: otherOrgId }),
    ).rejects.toThrow()
  })

  it('removes a slot and reports a missing one as not found', async () => {
    const slot = await scheduleSlotService.create(ctx(), orgId, base)
    await scheduleSlotService.remove(ctx(), orgId, slot.id)
    expect(await scheduleSlotService.list(ctx(), orgId)).toHaveLength(0)
    await expect(scheduleSlotService.remove(ctx(), orgId, slot.id)).rejects.toBeInstanceOf(
      ScheduleSlotNotFoundError,
    )
  })

  it('is tenant-scoped: another group never sees, changes or removes the slot', async () => {
    const slot = await scheduleSlotService.create(ctx(), orgId, base)
    expect(await scheduleSlotService.list(ctx(), otherOrgId)).toEqual([])
    await expect(scheduleSlotService.getById(ctx(), otherOrgId, slot.id)).rejects.toBeInstanceOf(
      ScheduleSlotNotFoundError,
    )
    await expect(
      scheduleSlotService.update(ctx(), otherOrgId, slot.id, { title: 'Взлом' }),
    ).rejects.toBeInstanceOf(ScheduleSlotNotFoundError)
    await expect(scheduleSlotService.remove(ctx(), otherOrgId, slot.id)).rejects.toBeInstanceOf(
      ScheduleSlotNotFoundError,
    )
    expect(await scheduleSlotService.getById(ctx(), orgId, slot.id)).toMatchObject({
      title: 'Основа',
    })
  })

  it('refuses a venue of another group and an archived venue', async () => {
    const foreign = await venueService.create(ctx(), { organizationId: otherOrgId, name: 'Чужой' })
    await expect(
      scheduleSlotService.create(ctx(), orgId, { ...base, venueId: foreign.id }),
    ).rejects.toBeInstanceOf(VenueNotInOrgError)
    await expect(
      scheduleSlotService.create(ctx(), orgId, { ...base, venueId: 999_999 }),
    ).rejects.toBeInstanceOf(VenueNotInOrgError)

    const mine = await venueService.create(ctx(), { organizationId: orgId, name: 'Старый' })
    await venueService.archive(ctx(), mine.id)
    await expect(
      scheduleSlotService.create(ctx(), orgId, { ...base, venueId: mine.id }),
    ).rejects.toBeInstanceOf(VenueArchivedError)

    const slot = await scheduleSlotService.create(ctx(), orgId, base)
    await expect(
      scheduleSlotService.update(ctx(), orgId, slot.id, { venueId: mine.id }),
    ).rejects.toBeInstanceOf(VenueArchivedError)
    await expect(
      scheduleSlotService.update(ctx(), orgId, slot.id, { venueId: foreign.id }),
    ).rejects.toBeInstanceOf(VenueNotInOrgError)
  })

  it('keeps a slot whose venue was archived later, flags it and lets other fields change', async () => {
    const venue = await venueService.create(ctx(), { organizationId: orgId, name: 'Скоро архив' })
    const slot = await scheduleSlotService.create(ctx(), orgId, { ...base, venueId: venue.id })
    await venueService.archive(ctx(), venue.id)

    const [listed] = await scheduleSlotService.list(ctx(), orgId)
    expect(listed).toMatchObject({
      venueId: venue.id,
      venueName: 'Скоро архив',
      venueArchived: true,
    })

    // прежний зал в запросе не меняется: правка времени проходит
    const edited = await scheduleSlotService.update(ctx(), orgId, slot.id, { startTime: '21:00' })
    expect(edited).toMatchObject({ startTime: '21:00', venueArchived: true })
    // тот же архивный зал, повторно отправленный формой, не ломает сохранение
    const resent = await scheduleSlotService.update(ctx(), orgId, slot.id, {
      venueId: venue.id,
      capacity: 10,
    })
    expect(resent.capacity).toBe(10)
  })

  it('archives instead of deleting a venue used only by a slot, and the slot keeps it flagged', async () => {
    const venue = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Для слота' },
    )
    const slot = await scheduleSlotService.create(ctx(), orgId, { ...base, venueId: venue.id })
    const unused = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Свободный' },
    )

    const res = await venueService.remove(ctx(), venue.id, orgId)
    expect(res.outcome).toBe('archived')
    expect(res.venue.status).toBe('archived')
    expect(await scheduleSlotService.getById(ctx(), orgId, slot.id)).toMatchObject({
      venueId: venue.id,
      venueName: 'Для слота',
      venueArchived: true,
    })
    // повтор безопасен, а зал без ссылок по-прежнему удаляется
    expect((await venueService.remove(ctx(), venue.id, orgId)).outcome).toBe('archived')
    expect((await venueService.remove(ctx(), unused.id, orgId)).outcome).toBe('deleted')
  })

  it('SET NULL stays as a safety net when a venue is removed directly', async () => {
    const venue = await venueService.create(ctx(), { organizationId: orgId, name: 'Удаляемый' })
    const slot = await scheduleSlotService.create(ctx(), orgId, { ...base, venueId: venue.id })
    await db.delete(venues).where(eq(venues.id, venue.id))
    expect(await scheduleSlotService.getById(ctx(), orgId, slot.id)).toMatchObject({
      venueId: null,
      venueName: null,
      venueArchived: false,
    })
  })

  it('caps the number of slots per group', async () => {
    await db.insert(scheduleSlots).values(
      Array.from({ length: SCHEDULE_SLOTS_MAX - 1 }, (_, n) => ({
        organizationId: orgId,
        weekday: 1 + (n % 7),
        startTime: '10:00',
        title: `Слот ${n}`,
        capacity: 10,
      })),
    )
    await scheduleSlotService.create(ctx(), orgId, base) // последний допустимый
    await expect(scheduleSlotService.create(ctx(), orgId, base)).rejects.toBeInstanceOf(
      ScheduleSlotLimitError,
    )
    // потолок на группу: соседняя группа не затронута
    await scheduleSlotService.create(ctx(), otherOrgId, base)
  })

  it('never creates events, series or balance entries', async () => {
    const balanceBefore = (await db.select().from(eventBalanceEntries)).length
    const slot = await scheduleSlotService.create(ctx(), orgId, base)
    await scheduleSlotService.update(ctx(), orgId, slot.id, { weekday: 2 })
    await scheduleSlotService.remove(ctx(), orgId, slot.id)
    expect(await db.select().from(events)).toHaveLength(0)
    expect(await db.select().from(eventSeries)).toHaveLength(0)
    expect(await db.select().from(eventBalanceEntries)).toHaveLength(balanceBefore)
  })
})
