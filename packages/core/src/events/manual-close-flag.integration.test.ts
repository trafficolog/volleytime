import { closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import { readManualClose } from './booking-close'
import { eventService } from './service'

/** Метка «запись ведёт организатор» (20.3.1) для карточки события в кабинете (20.5.6). */
describe('readManualClose', () => {
  let ownerId: number
  let orgId: number

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `mc-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Manual close' })).id
  })
  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await closeDb()
  })

  const make = (startsInHours: number) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Игра',
      startsAt: new Date(Date.now() + startsInHours * 3600_000),
      endsAt: new Date(Date.now() + (startsInHours + 2) * 3600_000),
      capacity: 4,
      closeBeforeMinutes: 120,
    })

  it('event opened after its close moment is marked; a normal event is not', async () => {
    const late = await make(1) // момент закрытия (−2 ч) уже в прошлом
    const normal = await make(48)
    expect(await readManualClose({ userId: ownerId }, late.id)).toBe(true)
    expect(await readManualClose({ userId: ownerId }, normal.id)).toBe(false)
  })
})
