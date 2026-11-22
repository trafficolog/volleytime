import {
  bookings,
  closeDb,
  db,
  events,
  featureEvents,
  organizationMembers,
  organizations,
  userFeatures,
  users,
} from '@volley-time/db'
import type { FeatureAnalyticsRow } from '@volley-time/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '../permissions/errors'

import { featureAnalyticsService, purgeExpiredFeatureEvents } from './service'

/**
 * Task 23.1.2 (P-14, D-25): события функций и отчёт по платформе на реальном PostgreSQL. Часы
 * фиксированы (`now`), сутки — UTC, поэтому результат не зависит от даты запуска и пояса раннера.
 */
describe('featureAnalyticsService (integration)', { timeout: 90_000 }, () => {
  const now = new Date('2026-11-22T12:00:00.000Z')
  const ago = (days: number, hours = 0) =>
    new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000)
  let seq = 0
  let rootId: number
  let orgId: number
  let eventId: number

  const newUser = async (label: string, isRootAdmin = false) =>
    (
      await db
        .insert(users)
        .values({ email: `fa-${label}-${++seq}@t.by`, name: label, isRootAdmin })
        .returning()
    )[0]!.id

  /** Игроки платформы: активные участники живой группы. */
  const newPlayers = async (n: number) => {
    const ids: number[] = []
    for (let i = 0; i < n; i++) {
      const id = await newUser('p')
      await db.insert(organizationMembers).values({ organizationId: orgId, userId: id })
      ids.push(id)
    }
    return ids
  }
  const book = (userId: number, createdAt: Date) =>
    db.insert(bookings).values({
      eventId,
      userId,
      organizationId: orgId,
      status: 'confirmed',
      method: 'free',
      createdAt,
    })
  const emit = (userId: number, feature: string, kind: string, at: Date) =>
    db.insert(featureEvents).values({
      userId,
      feature,
      kind,
      day: at.toISOString().slice(0, 10),
      createdAt: at,
    })
  const report = () => featureAnalyticsService.report({ userId: rootId }, now)
  const row = async (feature: string): Promise<FeatureAnalyticsRow> =>
    (await report()).features.find((f) => f.feature === feature)!

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    rootId = await newUser('root', true)
    const owner = await newUser('owner')
    orgId = (
      await db
        .insert(organizations)
        .values({ name: 'FA', slug: `fa-${++seq}`, ownerUserId: owner })
        .returning()
    )[0]!.id
    eventId = (
      await db
        .insert(events)
        .values({
          organizationId: orgId,
          createdByUserId: owner,
          title: 'E',
          startsAt: ago(-1),
          endsAt: ago(-1, -2),
          capacity: 500,
          status: 'published',
        })
        .returning()
    )[0]!.id
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('record', () => {
    it('writes one event per user, feature, kind and UTC day', async () => {
      const [me] = await newPlayers(1)
      const rec = (input: unknown, at: Date) =>
        featureAnalyticsService.record({ userId: me! }, input, at)
      expect(await rec({ feature: 'cal', kind: 'open' }, ago(0))).toEqual({ recorded: true })
      expect(await rec({ feature: 'cal', kind: 'open' }, ago(0, 1))).toEqual({ recorded: false })
      expect(await rec({ feature: 'cal', kind: 'use' }, ago(0))).toEqual({ recorded: true })
      expect(await rec({ feature: 'mvp', kind: 'open' }, ago(0))).toEqual({ recorded: true })
      expect(await rec({ feature: 'cal', kind: 'open' }, ago(1))).toEqual({ recorded: true })
      expect(await db.select().from(featureEvents)).toHaveLength(4)
    })

    it('rejects unknown features, kinds and extra keys', async () => {
      const [me] = await newPlayers(1)
      for (const input of [
        { feature: 'booking', kind: 'open' },
        { feature: 'cal', kind: 'click' },
        { feature: 'cal', kind: 'open', userId: rootId },
        {},
      ])
        await expect(featureAnalyticsService.record({ userId: me! }, input, now)).rejects.toThrow()
      expect(await db.select().from(featureEvents)).toHaveLength(0)
    })
  })

  describe('purge', () => {
    it('deletes events older than 180 days and keeps newer ones', async () => {
      const [me] = await newPlayers(1)
      await emit(me!, 'cal', 'open', ago(181))
      await emit(me!, 'cal', 'open', ago(180, -1))
      await emit(me!, 'mvp', 'open', ago(1))
      expect(await purgeExpiredFeatureEvents(now)).toBe(1)
      const left = await db.select().from(featureEvents)
      expect(left).toHaveLength(2)
      expect(await purgeExpiredFeatureEvents(now)).toBe(0)
    })
  })

  describe('report', () => {
    it('is root only, even when called directly', async () => {
      const [player] = await newPlayers(1)
      await expect(featureAnalyticsService.report({ userId: player! }, now)).rejects.toBeInstanceOf(
        ForbiddenError,
      )
    })

    it('suppresses every cohort under 10 players', async () => {
      const ids = await newPlayers(9)
      for (const id of ids) await emit(id, 'cal', 'open', ago(1))
      await db.insert(userFeatures).values({ userId: ids[0]!, feature: 'cal', enabled: false })
      const r = await report()
      expect(r.players).toBeNull()
      expect(r.minCohort).toBe(10)
      expect(r.features.map((f) => f.feature)).toEqual([
        'cal',
        'coach',
        'warmup',
        'self',
        'mvp',
        'teams',
        'streak',
        'wrapped',
      ])
      const hidden = { players: null, value: null, suppressed: true }
      const cal = r.features[0]!
      expect(cal.disabledShare).toEqual(hidden)
      expect(cal.weeklyActive).toEqual(hidden)
      expect(cal.retention).toEqual(hidden)
      expect(cal.bookingFrequency).toEqual({ on: hidden, off: hidden })
    })

    it('computes disabled share, weekly active and on/off booking frequency', async () => {
      const ids = await newPlayers(20)
      // 10 выключили cal; у выключивших по 1 записи, у включённых по 3 — за последние 28 суток
      for (const id of ids.slice(0, 10))
        await db.insert(userFeatures).values({ userId: id, feature: 'cal', enabled: false })
      for (const id of ids.slice(10, 20))
        await db.insert(userFeatures).values({ userId: id, feature: 'cal', enabled: true })
      for (const [i, id] of ids.entries()) {
        const count = i < 10 ? 1 : 3
        for (let k = 0; k < count; k++) {
          // одно место на событие: отдельное событие на запись
          const ev = (
            await db
              .insert(events)
              .values({
                organizationId: orgId,
                createdByUserId: id,
                title: 'E',
                startsAt: ago(-1),
                endsAt: ago(-1, -2),
                capacity: 50,
                status: 'published',
              })
              .returning()
          )[0]!.id
          await db.insert(bookings).values({
            eventId: ev,
            userId: id,
            organizationId: orgId,
            status: 'confirmed',
            method: 'free',
            createdAt: ago(k + 1),
          })
        }
      }
      // запись за окном частоты не считается
      await book(ids[0]!, ago(40))
      // активные cal за 7 суток: 11 игроков; одно событие за окном не считается
      for (const id of ids.slice(0, 11)) await emit(id, 'cal', 'use', ago(2))
      await emit(ids[11]!, 'cal', 'open', ago(8))
      // игрок вне групп не входит в знаменатель доли
      const outsider = await newUser('outsider')
      await db.insert(userFeatures).values({ userId: outsider, feature: 'cal', enabled: false })

      const r = await report()
      expect(r.players).toBe(20)
      const cal = r.features.find((f) => f.feature === 'cal')!
      expect(cal.disabledShare).toEqual({ players: 20, value: 0.5, suppressed: false })
      expect(cal.weeklyActive).toEqual({ players: 11, value: 11, suppressed: false })
      expect(cal.bookingFrequency.off).toEqual({ players: 10, value: 1, suppressed: false })
      expect(cal.bookingFrequency.on).toEqual({ players: 10, value: 3, suppressed: false })
      // у функции без выключивших: доля 0, группа «выключено» скрыта
      const mvp = r.features.find((f) => f.feature === 'mvp')!
      expect(mvp.disabledShare).toEqual({ players: 20, value: 0, suppressed: false })
      expect(mvp.bookingFrequency.on).toEqual({ players: 20, value: 2, suppressed: false })
      expect(mvp.bookingFrequency.off.suppressed).toBe(true)
      expect(mvp.weeklyActive.suppressed).toBe(true)
    })

    it('retention: share of openers in the cohort window who booked within 28 days', async () => {
      const ids = await newPlayers(12)
      // когорта — открытие 40 суток назад (окно [56, 28) суток назад)
      for (const id of ids) await emit(id, 'warmup', 'open', ago(40))
      // 3 записались в 28 суток после открытия, 1 — позже, 1 — до открытия
      for (const id of ids.slice(0, 3)) await book(id, ago(30))
      await book(ids[3]!, ago(5))
      await book(ids[4]!, ago(45))
      // открытие вне окна когорты не входит в неё
      const late = await newPlayers(1)
      await emit(late[0]!, 'warmup', 'open', ago(10))
      // `use` не делает когорту
      await emit(late[0]!, 'self', 'use', ago(40))

      const warmup = await row('warmup')
      expect(warmup.retention).toEqual({ players: 12, value: 3 / 12, suppressed: false })
      expect((await row('self')).retention.suppressed).toBe(true)
    })

    it('returns aggregates only: no user or group identifiers', async () => {
      const ids = await newPlayers(10)
      for (const id of ids) await emit(id, 'cal', 'open', ago(1))
      const text = JSON.stringify(await report())
      expect(text).not.toMatch(/userId|user_id|organizationId|orgId|email/)
    })
  })
})
