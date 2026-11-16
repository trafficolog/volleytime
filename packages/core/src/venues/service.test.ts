import {
  and,
  auditLog,
  closeDb,
  db,
  eq,
  eventSeries,
  events,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { eventService } from '../events/service'
import { organizationService } from '../organizations/service'

import { VenueArchivedError } from '../events/errors'
import { VenueNotFoundError } from './errors'
import { venueService } from './service'

let ownerId: number
let orgId: number

describe('venueService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `v-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Venue Org' })
    orgId = org.id
  })

  it('creates a venue with defaults', async () => {
    const v = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Зал №1' },
    )
    expect(v.name).toBe('Зал №1')
    expect(v.status).toBe('active')
  })

  it('creates with capacityHint and address', async () => {
    const v = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Спортзал', address: 'ул. Ленина 1', capacityHint: 12 },
    )
    expect(v.capacityHint).toBe(12)
    expect(v.address).toBe('ул. Ленина 1')
  })

  it('lists active venues sorted by name', async () => {
    await venueService.create({ userId: ownerId }, { organizationId: orgId, name: 'Б-зал' })
    await venueService.create({ userId: ownerId }, { organizationId: orgId, name: 'А-зал' })
    const list = await venueService.listByOrg({ userId: ownerId }, orgId)
    expect(list.map((v) => v.name)).toEqual(['А-зал', 'Б-зал'])
  })

  it('archive hides from default list', async () => {
    const v = await venueService.create({ userId: ownerId }, { organizationId: orgId, name: 'Old' })
    await venueService.archive({ userId: ownerId }, v.id)
    const active = await venueService.listByOrg({ userId: ownerId }, orgId)
    expect(active).toHaveLength(0)
    const all = await venueService.listByOrg({ userId: ownerId }, orgId, true)
    expect(all).toHaveLength(1)
  })

  it('update changes fields', async () => {
    const v = await venueService.create({ userId: ownerId }, { organizationId: orgId, name: 'X' })
    const updated = await venueService.update({ userId: ownerId }, v.id, { capacityHint: 20 })
    expect(updated.capacityHint).toBe(20)
  })

  it('getById throws for missing', async () => {
    await expect(venueService.getById({ userId: ownerId }, 99999)).rejects.toThrow(
      VenueNotFoundError,
    )
  })

  const future = () => new Date(Date.now() + 7 * 86_400_000)
  const eventAt = (venueId?: number) => ({
    title: 'Игра',
    startsAt: future(),
    endsAt: new Date(future().getTime() + 5_400_000),
    capacity: 10,
    venueId,
  })

  it('scopes get/update/remove to the given org (a foreign venue is not found)', async () => {
    const [u2] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    const other = await organizationService.create({ userId: u2!.id }, { name: 'Other' })
    const foreign = await venueService.create(
      { userId: u2!.id },
      { organizationId: other.id, name: 'Чужой' },
    )
    const ctx = { userId: ownerId }
    await expect(venueService.getById(ctx, foreign.id, orgId)).rejects.toThrow(VenueNotFoundError)
    await expect(venueService.update(ctx, foreign.id, { name: 'X' }, orgId)).rejects.toThrow(
      VenueNotFoundError,
    )
    await expect(venueService.remove(ctx, foreign.id, orgId)).rejects.toThrow(VenueNotFoundError)
    expect((await venueService.getById(ctx, foreign.id)).name).toBe('Чужой')
  })

  it('update can clear the address', async () => {
    const v = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'X', address: 'ул. Мира 1' },
    )
    const updated = await venueService.update({ userId: ownerId }, v.id, { address: null }, orgId)
    expect(updated.address).toBeNull()
  })

  // 21.4.13 (DEF-23): цена за час в минимальных единицах, `null` — не указана
  it('creates without an hourly price by default and with one in kopecks', async () => {
    const ctx = { userId: ownerId }
    expect(
      (await venueService.create(ctx, { organizationId: orgId, name: 'Без цены' })).hourlyPrice,
    ).toBeNull()
    const priced = await venueService.create(ctx, {
      organizationId: orgId,
      name: 'С ценой',
      hourlyPrice: 1550,
    })
    expect(priced.hourlyPrice).toBe(1550)
    const listed = await venueService.listByOrg(ctx, orgId)
    expect(listed.find((v) => v.id === priced.id)?.hourlyPrice).toBe(1550)
    expect(
      (await venueService.create(ctx, { organizationId: orgId, name: 'Пусто', hourlyPrice: null }))
        .hourlyPrice,
    ).toBeNull()
  })

  it('accepts 0 and the maximum, rejects negative, fractional, above maximum and strings', async () => {
    const ctx = { userId: ownerId }
    for (const hourlyPrice of [0, 10_000_000]) {
      const v = await venueService.create(ctx, {
        organizationId: orgId,
        name: `Зал ${hourlyPrice}`,
        hourlyPrice,
      })
      expect(v.hourlyPrice).toBe(hourlyPrice)
    }
    for (const hourlyPrice of [-1, 15.5, 10_000_001, '1500', Number.NaN]) {
      await expect(
        venueService.create(ctx, {
          organizationId: orgId,
          name: 'Плохая цена',
          hourlyPrice: hourlyPrice as number,
        }),
      ).rejects.toThrow()
    }
    const v = await venueService.create(ctx, { organizationId: orgId, name: 'Правка' })
    await expect(venueService.update(ctx, v.id, { hourlyPrice: -5 }, orgId)).rejects.toThrow()
    await expect(venueService.update(ctx, v.id, { hourlyPrice: 0.5 }, orgId)).rejects.toThrow()
    expect((await venueService.getById(ctx, v.id)).hourlyPrice).toBeNull()
  })

  it('update sets, keeps when omitted and clears the hourly price; audit records it', async () => {
    const ctx = { userId: ownerId }
    const v = await venueService.create(ctx, { organizationId: orgId, name: 'Цена' })
    expect((await venueService.update(ctx, v.id, { hourlyPrice: 1500 }, orgId)).hourlyPrice).toBe(
      1500,
    )
    // правка других полей без hourlyPrice цену не трогает
    expect((await venueService.update(ctx, v.id, { name: 'Цена 2' }, orgId)).hourlyPrice).toBe(1500)
    expect((await venueService.update(ctx, v.id, { hourlyPrice: null }, orgId)).hourlyPrice).toBe(
      null,
    )
    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'venue'), eq(auditLog.entityId, v.id)))
    expect(logged.some((r) => (r.newValue as { hourlyPrice?: number })?.hourlyPrice === 1500)).toBe(
      true,
    )
  })

  it('a foreign venue price cannot be changed through another group', async () => {
    const [u2] = await db
      .insert(users)
      .values({ email: `hp-${Math.random()}@t.by` })
      .returning()
    const other = await organizationService.create({ userId: u2!.id }, { name: 'Other HP' })
    const foreign = await venueService.create(
      { userId: u2!.id },
      { organizationId: other.id, name: 'Чужой', hourlyPrice: 2000 },
    )
    await expect(
      venueService.update({ userId: ownerId }, foreign.id, { hourlyPrice: 1 }, orgId),
    ).rejects.toThrow(VenueNotFoundError)
    expect((await venueService.getById({ userId: u2!.id }, foreign.id)).hourlyPrice).toBe(2000)
  })

  it('the hourly price does not change the price of an event in that venue', async () => {
    const ctx = { userId: ownerId }
    const v = await venueService.create(ctx, {
      organizationId: orgId,
      name: 'Зал',
      hourlyPrice: 1500,
    })
    const ev = await eventService.create(ctx, orgId, { ...eventAt(v.id), price: 700 })
    await venueService.update(ctx, v.id, { hourlyPrice: 9900 }, orgId)
    const [row] = await db.select().from(events).where(eq(events.id, ev.id))
    expect(row?.price).toBe(700)
  })

  it('rejects whitespace-only names and trims valid ones', async () => {
    const ctx = { userId: ownerId }
    await expect(venueService.create(ctx, { organizationId: orgId, name: '   ' })).rejects.toThrow()
    const v = await venueService.create(ctx, { organizationId: orgId, name: '  Зал  ' })
    expect(v.name).toBe('Зал')
    await expect(venueService.update(ctx, v.id, { name: '  ' }, orgId)).rejects.toThrow()
  })

  it('remove deletes a venue without events', async () => {
    const v = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Пуст' },
    )
    const res = await venueService.remove({ userId: ownerId }, v.id, orgId)
    expect(res.outcome).toBe('deleted')
    await expect(venueService.getById({ userId: ownerId }, v.id)).rejects.toThrow(
      VenueNotFoundError,
    )
  })

  it('remove archives a venue that has events and keeps them linked', async () => {
    const v = await venueService.create({ userId: ownerId }, { organizationId: orgId, name: 'Зал' })
    const ev = await eventService.create({ userId: ownerId }, orgId, eventAt(v.id))
    const res = await venueService.remove({ userId: ownerId }, v.id, orgId)
    expect(res.outcome).toBe('archived')
    expect(res.venue.status).toBe('archived')
    const [row] = await db.select().from(events).where(eq(events.id, ev.id))
    expect(row?.venueId).toBe(v.id)
    // повторный «Удалить» остаётся архивом
    expect((await venueService.remove({ userId: ownerId }, v.id, orgId)).outcome).toBe('archived')
  })

  it('remove archives a venue referenced only by a series template', async () => {
    const v = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Серия' },
    )
    await db.insert(eventSeries).values({
      organizationId: orgId,
      createdByUserId: ownerId,
      rule: {},
      exceptions: [],
      template: { venueId: v.id },
      timezone: 'UTC',
      idempotencyKey: `k-${Math.random()}`,
    })
    expect((await venueService.remove({ userId: ownerId }, v.id, orgId)).outcome).toBe('archived')
  })

  it('an archived venue cannot be chosen for a new event but stays on the existing one', async () => {
    const v = await venueService.create({ userId: ownerId }, { organizationId: orgId, name: 'Зал' })
    const ev = await eventService.create({ userId: ownerId }, orgId, eventAt(v.id))
    const other = await eventService.create({ userId: ownerId }, orgId, eventAt())
    await venueService.remove({ userId: ownerId }, v.id, orgId)
    await expect(eventService.create({ userId: ownerId }, orgId, eventAt(v.id))).rejects.toThrow(
      VenueArchivedError,
    )
    // правка существующего события с прежним архивным залом не ломается
    const updated = await eventService.update({ userId: ownerId }, ev.id, {
      title: 'Новое название',
      venueId: v.id,
    })
    expect(updated.venueId).toBe(v.id)
    // а выбрать архивный зал другому событию нельзя
    await expect(
      eventService.update({ userId: ownerId }, other.id, { venueId: v.id }),
    ).rejects.toThrow(VenueArchivedError)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
