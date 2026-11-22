import { closeDb, db, eq, userFeatures, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { isPlayerFeatureOffForNotification, playerFeaturesService } from './service'

/** Task 23.1.1 (P-12): личные функции игрока на реальном PostgreSQL. */
describe('player features service (23.1.1, PostgreSQL)', () => {
  let a: number
  let b: number
  const ctx = (userId: number) => ({ userId })

  beforeEach(async () => {
    await db.delete(users)
    const rows = await db
      .insert(users)
      .values([{ email: `pf-a-${Math.random()}@t.by` }, { email: `pf-b-${Math.random()}@t.by` }])
      .returning()
    a = rows[0]!.id
    b = rows[1]!.id
  })

  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })

  it('returns all eight flags on by default without writing rows', async () => {
    const features = await playerFeaturesService.get(ctx(a))
    expect(Object.keys(features)).toHaveLength(8)
    expect(Object.values(features).every(Boolean)).toBe(true)
    expect(await db.select().from(userFeatures)).toHaveLength(0)
  })

  it('persists a partial update per user and keeps other flags and users untouched', async () => {
    const updated = await playerFeaturesService.update(ctx(a), { cal: false, mvp: false })
    expect(updated).toMatchObject({ cal: false, mvp: false, teams: true, wrapped: true })
    // «другое устройство»: новое чтение из базы
    expect(await playerFeaturesService.get(ctx(a))).toEqual(updated)
    expect((await playerFeaturesService.get(ctx(b))).cal).toBe(true)
    const back = await playerFeaturesService.update(ctx(a), { cal: true })
    expect(back).toMatchObject({ cal: true, mvp: false })
  })

  it('rejects unknown keys, schedule/booking/payment and non-boolean values', async () => {
    for (const body of [{ schedule: false }, { booking: false }, { payment: false }, { cal: 'no' }])
      await expect(playerFeaturesService.update(ctx(a), body)).rejects.toThrow()
    await expect(playerFeaturesService.update(ctx(a), null)).rejects.toThrow()
    expect(await db.select().from(userFeatures)).toHaveLength(0)
  })

  it('an empty update is a no-op that returns the current flags', async () => {
    await playerFeaturesService.update(ctx(a), { self: false })
    expect((await playerFeaturesService.update(ctx(a), {})).self).toBe(false)
  })

  it('switching a flag off does not delete anything else of the user', async () => {
    await playerFeaturesService.update(ctx(a), { streak: false })
    expect(await db.select().from(users).where(eq(users.id, a))).toHaveLength(1)
  })

  describe('notification gate (D-23)', () => {
    it('is closed only for the mapped kinds of the switched-off flag', async () => {
      await playerFeaturesService.update(ctx(a), { cal: false, teams: false, mvp: false })
      for (const kind of ['reminder_24h', 'reminder_2h', 'lineup_ready', 'mvp_vote'])
        expect(await isPlayerFeatureOffForNotification(db, a, kind)).toBe(true)
      // других игроков и других типов флаги не касаются
      expect(await isPlayerFeatureOffForNotification(db, b, 'reminder_24h')).toBe(false)
      expect(await isPlayerFeatureOffForNotification(db, a, 'booking_opened')).toBe(false)
    })

    it('stays open for a flag that is on', async () => {
      await playerFeaturesService.update(ctx(a), { teams: false })
      expect(await isPlayerFeatureOffForNotification(db, a, 'reminder_24h')).toBe(false)
      expect(await isPlayerFeatureOffForNotification(db, a, 'mvp_vote')).toBe(false)
    })

    it('never switches critical kinds off, whatever the flags', async () => {
      await playerFeaturesService.update(ctx(a), {
        cal: false,
        coach: false,
        warmup: false,
        self: false,
        mvp: false,
        teams: false,
        streak: false,
        wrapped: false,
      })
      for (const kind of [
        'waitlist_offer',
        'payment_confirmed',
        'payment_rejected',
        'event_cancelled',
      ])
        expect(await isPlayerFeatureOffForNotification(db, a, kind)).toBe(false)
    })
  })
})
