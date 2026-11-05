import { closeDb, db, eq, eventSeries, events, organizations, users } from '@volley-time/db'
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
