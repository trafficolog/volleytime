import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

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

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
