import { memberService, organizationService, venueService } from '@volley-time/core'
import {
  auditLog,
  and,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  events,
  eventSeries,
  organizations,
  scheduleSlots,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Slot = {
  id: number
  weekday: number
  startTime: string
  durationMinutes: number
  title: string
  type: string
  capacity: number
  venueId: number | null
  venueName: string | null
  venueArchived: boolean
}

const DAY = 86_400_000
const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
/** Ближайший понедельник не раньше чем через 3 недели: даты серии не «протухают». */
function futureMonday(): string {
  const start = addDays(new Date().toISOString().slice(0, 10), 21)
  const weekday = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(start, (7 - weekday) % 7)
}

const SLOT = { weekday: 1, startTime: '20:00', title: 'Основа', capacity: 12 }

/** Task 21.2.12: шаблоны слотов расписания (HTTP, права, IDOR, связь с серией и балансом). */
describe('schedule slots API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let assistantId: number
  let playerId: number
  let outsiderId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  const previousFlag = process.env.EVENT_BALANCE_ENFORCED
  const url = (id = orgId, suffix = '') => `/api/organizations/${id}/schedule-slots${suffix}`
  const list = async (user = ownerId, id = orgId) => {
    const res = await request('GET', url(id), { user })
    expect(res.status, res.text).toBe(200)
    return (res.body as { slots: Slot[] }).slots
  }
  const create = (body: Record<string, unknown> = SLOT, user = ownerId, id = orgId) =>
    request('POST', url(id), { user, body })

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `slot-${tag}-${Math.random()}@t.by` })
      .returning()
    return u!.id
  }

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    assistantId = await newUser('assistant')
    playerId = await newUser('player')
    outsiderId = await newUser('outsider')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Slots HTTP' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
    const add = (userId: number, role: 'organizer' | 'assistant' | 'player') =>
      memberService.add({ userId: ownerId }, { organizationId: orgId, userId, role })
    await add(organizerId, 'organizer')
    await add(assistantId, 'assistant')
    await add(playerId, 'player')
    await memberService.add(
      { userId: otherOwnerId },
      { organizationId: otherOrgId, userId: outsiderId },
    )
  })

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('owner and organizer add, edit, list and delete slots', async () => {
    const venue = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Школа №24' },
    )
    const created = await create({ ...SLOT, venueId: venue.id, type: 'open_game' }, organizerId)
    expect(created.status, created.text).toBe(200)
    const slot = (created.body as { slot: Slot }).slot
    expect(slot).toMatchObject({
      ...SLOT,
      durationMinutes: 120,
      type: 'open_game',
      venueId: venue.id,
      venueName: 'Школа №24',
      venueArchived: false,
    })

    const edited = await request('PATCH', url(orgId, `/${slot.id}`), {
      user: ownerId,
      body: { weekday: 3, startTime: '19:30', capacity: 16, venueId: null },
    })
    expect(edited.status, edited.text).toBe(200)
    expect((edited.body as { slot: Slot }).slot).toMatchObject({
      weekday: 3,
      startTime: '19:30',
      capacity: 16,
      venueId: null,
      title: 'Основа',
    })
    expect(await list(organizerId)).toHaveLength(1)

    const removed = await request('DELETE', url(orgId, `/${slot.id}`), { user: organizerId })
    expect(removed.status).toBe(200)
    expect(await list()).toEqual([])
    const again = await request('DELETE', url(orgId, `/${slot.id}`), { user: ownerId })
    expect(again.status).toBe(404)
    expect(again.body).toMatchObject({ data: { code: 'schedule_slot.not_found' } })
  })

  it('records the changes in the audit log', async () => {
    const slot = ((await create()).body as { slot: Slot }).slot
    await request('PATCH', url(orgId, `/${slot.id}`), { user: ownerId, body: { capacity: 14 } })
    await request('DELETE', url(orgId, `/${slot.id}`), { user: ownerId })
    const rows = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(and(eq(auditLog.organizationId, orgId), eq(auditLog.entityType, 'schedule_slot')))
    expect(rows.map((r) => r.action).sort()).toEqual([
      'schedule_slot.created',
      'schedule_slot.deleted',
      'schedule_slot.updated',
    ])
  })

  it('assistant, player and anonymous cannot read or change slots', async () => {
    const slot = ((await create()).body as { slot: Slot }).slot
    for (const user of [assistantId, playerId]) {
      const calls = [
        request('GET', url(), { user }),
        request('POST', url(), { user, body: SLOT }),
        request('PATCH', url(orgId, `/${slot.id}`), { user, body: { capacity: 1 } }),
        request('DELETE', url(orgId, `/${slot.id}`), { user }),
      ]
      for (const res of await Promise.all(calls)) {
        expect(res.status, res.text).toBe(403)
        expect(res.body).toMatchObject({ data: { code: 'forbidden.manage_content' } })
      }
    }
    expect((await request('GET', url())).status).toBe(401)
    expect((await request('POST', url(), { body: SLOT })).status).toBe(401)
    expect(await list()).toHaveLength(1)
    expect((await list())[0]).toMatchObject({ capacity: 12 })
  })

  it('IDOR: another group sees and changes nothing, and a foreign slot id is a 404', async () => {
    const slot = ((await create()).body as { slot: Slot }).slot
    for (const user of [outsiderId, otherOwnerId]) {
      for (const res of await Promise.all([
        request('GET', url(), { user }),
        request('POST', url(), { user, body: SLOT }),
        request('PATCH', url(orgId, `/${slot.id}`), { user, body: { title: 'Взлом' } }),
        request('DELETE', url(orgId, `/${slot.id}`), { user }),
      ])) {
        expect(res.status, res.text).toBe(403)
      }
    }
    // свой владелец и чужой слот по пути своей группы
    for (const res of [
      await request('PATCH', url(otherOrgId, `/${slot.id}`), {
        user: otherOwnerId,
        body: { title: 'Взлом' },
      }),
      await request('DELETE', url(otherOrgId, `/${slot.id}`), { user: otherOwnerId }),
    ]) {
      expect(res.status, res.text).toBe(404)
      expect(res.body).toMatchObject({ data: { code: 'schedule_slot.not_found' } })
    }
    expect(await list(otherOwnerId, otherOrgId)).toEqual([])
    expect(await list()).toEqual([expect.objectContaining({ id: slot.id, title: 'Основа' })])
  })

  it('validates the boundary values', async () => {
    const ok = [
      { weekday: 1, startTime: '00:00', durationMinutes: 15, capacity: 1 },
      { weekday: 7, startTime: '23:59', durationMinutes: 1440, capacity: 500 },
    ]
    for (const over of ok) expect((await create({ ...SLOT, ...over })).status).toBe(200)
    const bad: Record<string, unknown>[] = [
      { weekday: 0 },
      { weekday: 8 },
      { startTime: '24:00' },
      { startTime: '9:00' },
      { durationMinutes: 14 },
      { durationMinutes: 1441 },
      { capacity: 0 },
      { capacity: 501 },
      { title: 'a' },
      { type: 'tournament_match' },
      { organizationId: otherOrgId },
    ]
    for (const over of bad) {
      const res = await create({ ...SLOT, ...over })
      expect(res.status, JSON.stringify(over)).toBe(422)
      expect(res.body).toMatchObject({ data: { code: 'validation_failed' } })
    }
    expect(await list()).toHaveLength(2)
  })

  it('refuses a venue of another group and an archived venue, flags a later archived one', async () => {
    const foreign = await venueService.create(
      { userId: otherOwnerId },
      { organizationId: otherOrgId, name: 'Чужой' },
    )
    const foreignRes = await create({ ...SLOT, venueId: foreign.id })
    expect(foreignRes.status).toBe(422)
    expect(foreignRes.body).toMatchObject({ data: { code: 'event.venue_not_in_org' } })

    const old = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Старый' },
    )
    const live = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Рабочий' },
    )
    const slot = ((await create({ ...SLOT, venueId: live.id })).body as { slot: Slot }).slot
    await venueService.archive({ userId: ownerId }, old.id)
    await venueService.archive({ userId: ownerId }, live.id)

    const archivedRes = await create({ ...SLOT, venueId: old.id })
    expect(archivedRes.status).toBe(422)
    expect(archivedRes.body).toMatchObject({ data: { code: 'event.venue_archived' } })
    const switchRes = await request('PATCH', url(orgId, `/${slot.id}`), {
      user: ownerId,
      body: { venueId: old.id },
    })
    expect(switchRes.status).toBe(422)

    // слот с позже архивным залом остаётся, помечен, и его время правится
    expect(await list()).toEqual([
      expect.objectContaining({ venueId: live.id, venueName: 'Рабочий', venueArchived: true }),
    ])
    const time = await request('PATCH', url(orgId, `/${slot.id}`), {
      user: ownerId,
      body: { startTime: '21:00' },
    })
    expect(time.status, time.text).toBe(200)
  })

  it('stops at 50 slots per group', async () => {
    await db.insert(scheduleSlots).values(
      Array.from({ length: 50 }, (_, n) => ({
        organizationId: orgId,
        weekday: 1 + (n % 7),
        startTime: '10:00',
        title: `Слот ${n}`,
        capacity: 10,
      })),
    )
    const res = await create()
    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({ data: { code: 'schedule_slot.limit_reached' } })
    expect((await create(SLOT, otherOwnerId, otherOrgId)).status).toBe(200)
  })

  it('a slot creates no events and spends no balance; the series made from it follows the existing contract', async () => {
    const venue = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Школа №24' },
    )
    const entriesBefore = (await db.select().from(eventBalanceEntries)).length
    const slot = (
      (await create({ ...SLOT, venueId: venue.id, durationMinutes: 90 })).body as { slot: Slot }
    ).slot
    await request('PATCH', url(orgId, `/${slot.id}`), { user: ownerId, body: { capacity: 10 } })
    expect(await db.select().from(events)).toHaveLength(0)
    expect(await db.select().from(eventSeries)).toHaveLength(0)
    expect(await db.select().from(eventBalanceEntries)).toHaveLength(entriesBefore)
    const balanceBefore = await request('GET', `/api/organizations/${orgId}/event-balance`, {
      user: ownerId,
    })

    // форма подставляет поля слота, дальше идёт обычный POST /series (не отдельный путь)
    const filled = (await list())[0]!
    const start = futureMonday()
    const series = await request('POST', `/api/organizations/${orgId}/series`, {
      user: organizerId,
      body: {
        rule: { freq: 'weekly', weekdays: [filled.weekday], startDate: start, count: 2 },
        template: {
          type: filled.type,
          title: filled.title,
          startTime: filled.startTime,
          durationMinutes: filled.durationMinutes,
          capacity: filled.capacity,
          venueId: filled.venueId,
        },
        idempotencyKey: 'slot-series-key-0001',
      },
    })
    expect(series.status, series.text).toBe(200)
    expect(series.body).toMatchObject({ total: 2, published: 2, drafts: 0, replayed: false })
    const created = await db.select().from(events).orderBy(events.startsAt)
    expect(created).toHaveLength(2)
    for (const ev of created) {
      expect(ev).toMatchObject({
        title: 'Основа',
        capacity: 10,
        venueId: venue.id,
        type: 'training',
      })
      expect(ev.endsAt.getTime() - ev.startsAt.getTime()).toBe(90 * 60_000)
    }
    const balanceAfter = await request('GET', `/api/organizations/${orgId}/event-balance`, {
      user: ownerId,
    })
    expect((balanceAfter.body as { eventBalance: { balance: number } }).eventBalance.balance).toBe(
      (balanceBefore.body as { eventBalance: { balance: number } }).eventBalance.balance - 2,
    )

    // повтор того же запроса идемпотентен и не списывает второй раз
    const replay = await request('POST', `/api/organizations/${orgId}/series`, {
      user: organizerId,
      body: {
        rule: { freq: 'weekly', weekdays: [filled.weekday], startDate: start, count: 2 },
        template: {
          type: filled.type,
          title: filled.title,
          startTime: filled.startTime,
          durationMinutes: filled.durationMinutes,
          capacity: filled.capacity,
          venueId: filled.venueId,
        },
        idempotencyKey: 'slot-series-key-0001',
      },
    })
    expect(replay.body).toMatchObject({ replayed: true })
    expect(await db.select().from(events)).toHaveLength(2)

    // удаление слота не трогает созданные по нему события
    await request('DELETE', url(orgId, `/${slot.id}`), { user: ownerId })
    expect(await db.select().from(events)).toHaveLength(2)
  })

  it('a series from a slot whose venue was archived later is refused by the existing contract', async () => {
    const venue = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Скоро архив' },
    )
    await create({ ...SLOT, venueId: venue.id })
    await venueService.archive({ userId: ownerId }, venue.id)
    const filled = (await list())[0]!
    expect(filled.venueArchived).toBe(true)
    const res = await request('POST', `/api/organizations/${orgId}/series`, {
      user: organizerId,
      body: {
        rule: { freq: 'weekly', weekdays: [1], startDate: futureMonday(), count: 1 },
        template: {
          title: filled.title,
          startTime: filled.startTime,
          durationMinutes: filled.durationMinutes,
          capacity: filled.capacity,
          venueId: filled.venueId,
        },
        idempotencyKey: 'slot-archived-key-01',
      },
    })
    expect(res.status).toBe(422)
    expect(res.body).toMatchObject({ data: { code: 'event.venue_archived' } })
    expect(await db.select().from(events)).toHaveLength(0)
  })
})
