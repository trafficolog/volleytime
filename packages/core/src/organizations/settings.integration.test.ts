import { auditLog, closeDb, db, eq, events, organizations, users } from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AUDIT_ACTIONS } from '../audit/actions'
import { eventService } from '../events/service'

import { OrganizationArchivedError, OrganizationInvalidSettingsError } from './errors'
import { organizationService } from './service'
import { organizationSettingsService } from './settings'

let ownerId: number
let orgId: number

const future = (h = 24) => new Date(Date.now() + h * 3600_000)
const ctx = () => ({ userId: ownerId })

async function makeEvent(extra: Record<string, unknown> = {}) {
  return eventService.create(ctx(), orgId, {
    title: 'Тренировка',
    startsAt: future(),
    endsAt: future(26),
    capacity: 10,
    price: 1000,
    ...extra,
  })
}

async function settingsAudit() {
  return db.select().from(auditLog).where(eq(auditLog.action, AUDIT_ACTIONS.ORG_SETTINGS_UPDATED))
}

/** Task 19.2.2: настройки группы v3 и снимок политики отмены в событие (D-02). */
describe('organizationSettingsService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `s-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create(ctx(), { name: 'Settings Org', city: 'Минск' })).id
    delete process.env.EVENT_SPLIT_PRICING_ENABLED
    // умолчание invite пишется только при включённой записи по приглашению (20.1.3)
    process.env.EVENT_INVITE_MODE_ENABLED = 'true'
  })

  afterEach(() => {
    delete process.env.EVENT_SPLIT_PRICING_ENABLED
    delete process.env.EVENT_INVITE_MODE_ENABLED
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('get', () => {
    it('returns the defaults of a new group', async () => {
      expect(await organizationSettingsService.get(ctx(), orgId)).toEqual({
        subscriptionsEnabled: true,
        maxSeatsPerBooking: 3,
        defaultPriceMode: 'fixed',
        defaultJoinMode: 'open',
        cancellationAllowed: true,
        cancellationDeadlineHours: 6,
        seoIndex: false,
        city: 'Минск',
        district: null,
        levels: [],
      })
    })

    it('fails for an unknown group', async () => {
      await expect(organizationSettingsService.get(ctx(), orgId + 999)).rejects.toMatchObject({
        code: 'organization.not_found',
      })
    })
  })

  describe('update', () => {
    it('applies a partial patch and returns the full settings', async () => {
      const res = await organizationSettingsService.update(ctx(), orgId, {
        maxSeatsPerBooking: 5,
        defaultJoinMode: 'invite',
        cancellationDeadlineHours: 12,
        district: 'Центральный',
        seoIndex: true,
      })
      expect(res).toMatchObject({
        maxSeatsPerBooking: 5,
        defaultJoinMode: 'invite',
        cancellationDeadlineHours: 12,
        district: 'Центральный',
        seoIndex: true,
        defaultPriceMode: 'fixed',
        cancellationAllowed: true,
      })
      expect(await organizationSettingsService.get(ctx(), orgId)).toEqual(res)
    })

    it('keeps subscriptions toggle semantics: stored on the same column, blocks sales', async () => {
      await organizationSettingsService.update(ctx(), orgId, { subscriptionsEnabled: false })
      await expect(
        organizationService.requireSubscriptionsEnabled(ctx(), orgId),
      ).rejects.toMatchObject({ code: 'organization.subscriptions_disabled' })
      await organizationSettingsService.update(ctx(), orgId, { subscriptionsEnabled: true })
      await expect(
        organizationService.requireSubscriptionsEnabled(ctx(), orgId),
      ).resolves.toBeUndefined()
    })

    it('allows resetting the deadline to null and clearing city/district', async () => {
      await organizationSettingsService.update(ctx(), orgId, {
        cancellationDeadlineHours: 4,
        district: 'Северный',
      })
      const res = await organizationSettingsService.update(ctx(), orgId, {
        cancellationDeadlineHours: null,
        district: '  ',
        city: null,
      })
      expect(res).toMatchObject({ cancellationDeadlineHours: null, district: null, city: null })
    })

    it.each([
      ['maxSeatsPerBooking below 1', { maxSeatsPerBooking: 0 }],
      ['maxSeatsPerBooking above 10', { maxSeatsPerBooking: 11 }],
      ['fractional maxSeatsPerBooking', { maxSeatsPerBooking: 2.5 }],
      ['negative deadline', { cancellationDeadlineHours: -1 }],
      ['deadline above 720', { cancellationDeadlineHours: 721 }],
      ['unknown price mode', { defaultPriceMode: 'auction' }],
      ['unknown join mode', { defaultJoinMode: 'closed' }],
      ['non-boolean seoIndex', { seoIndex: 'yes' }],
      ['too long district', { district: 'x'.repeat(101) }],
      ['unknown key', { currency: 'USD' }],
    ])('rejects %s and changes nothing', async (_name, patch) => {
      await expect(
        organizationSettingsService.update(ctx(), orgId, patch as never),
      ).rejects.toMatchObject({ name: 'ZodError' })
      expect(await organizationSettingsService.get(ctx(), orgId)).toMatchObject({
        maxSeatsPerBooking: 3,
        cancellationDeadlineHours: 6,
      })
      expect(await settingsAudit()).toHaveLength(0)
    })

    it('accepts the range boundaries 1 and 10', async () => {
      expect(
        (await organizationSettingsService.update(ctx(), orgId, { maxSeatsPerBooking: 1 }))
          .maxSeatsPerBooking,
      ).toBe(1)
      expect(
        (await organizationSettingsService.update(ctx(), orgId, { maxSeatsPerBooking: 10 }))
          .maxSeatsPerBooking,
      ).toBe(10)
    })

    it('rejects default split while split pricing is disabled', async () => {
      await expect(
        organizationSettingsService.update(ctx(), orgId, { defaultPriceMode: 'split' }),
      ).rejects.toMatchObject({ code: 'organization.invalid_settings' })
      expect((await organizationSettingsService.get(ctx(), orgId)).defaultPriceMode).toBe('fixed')
      process.env.EVENT_SPLIT_PRICING_ENABLED = 'true'
      await expect(
        organizationSettingsService.update(ctx(), orgId, { defaultPriceMode: 'split' }),
      ).resolves.toMatchObject({ defaultPriceMode: 'split' })
    })

    it('event create racing with a settings change gets one consistent snapshot', async () => {
      await organizationSettingsService.update(ctx(), orgId, { cancellationDeadlineHours: 6 })
      const results = await Promise.all([
        ...Array.from({ length: 6 }, () => makeEvent()),
        organizationSettingsService.update(ctx(), orgId, {
          cancellationAllowed: false,
          cancellationDeadlineHours: 24,
        }),
      ])
      for (const ev of results.slice(0, 6) as Awaited<ReturnType<typeof makeEvent>>[]) {
        const old = ev.cancellationAllowed === true && ev.cancellationDeadlineHours === 6
        const next = ev.cancellationAllowed === false && ev.cancellationDeadlineHours === 24
        expect(old || next).toBe(true) // никогда не смесь старого и нового
      }
    })

    it('rejects an empty patch with organization.invalid_settings', async () => {
      await expect(organizationSettingsService.update(ctx(), orgId, {})).rejects.toBeInstanceOf(
        OrganizationInvalidSettingsError,
      )
    })

    it('refuses archived groups', async () => {
      await organizationService.archive(ctx(), orgId)
      await expect(
        organizationSettingsService.update(ctx(), orgId, { seoIndex: true }),
      ).rejects.toBeInstanceOf(OrganizationArchivedError)
    })

    it('does not touch another group', async () => {
      const [other] = await db
        .insert(users)
        .values({ email: `o-${Math.random()}@t.by` })
        .returning()
      const otherOrg = await organizationService.create(
        { userId: other!.id },
        { name: 'Other Org' },
      )
      await organizationSettingsService.update(ctx(), orgId, { maxSeatsPerBooking: 7 })
      expect((await organizationSettingsService.get(ctx(), otherOrg.id)).maxSeatsPerBooking).toBe(3)
    })
  })

  describe('history (audit_log)', () => {
    it('records who, when, old and new values of the changed fields only', async () => {
      await organizationSettingsService.update(ctx(), orgId, {
        maxSeatsPerBooking: 6,
        cancellationDeadlineHours: 8,
      })
      await organizationSettingsService.update(ctx(), orgId, {
        maxSeatsPerBooking: 4,
        seoIndex: false, // не изменилось — в историю не попадает
      })
      const rows = (await settingsAudit()).sort((a, b) => a.id - b.id)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({
        organizationId: orgId,
        userId: ownerId,
        entityType: 'organization',
        entityId: orgId,
        oldValue: { maxSeatsPerBooking: 3, cancellationDeadlineHours: 6 },
        newValue: { maxSeatsPerBooking: 6, cancellationDeadlineHours: 8 },
      })
      expect(rows[0]!.createdAt).toBeInstanceOf(Date)
      expect(rows[1]).toMatchObject({
        oldValue: { maxSeatsPerBooking: 6 },
        newValue: { maxSeatsPerBooking: 4 },
      })
    })

    it('writes nothing when the patch changes no value', async () => {
      await organizationSettingsService.update(ctx(), orgId, { maxSeatsPerBooking: 3 })
      expect(await settingsAudit()).toHaveLength(0)
    })
  })

  describe('snapshot into events (D-02)', () => {
    it('a new event copies the cancellation policy of the group', async () => {
      await organizationSettingsService.update(ctx(), orgId, {
        cancellationAllowed: false,
        cancellationDeadlineHours: 12,
      })
      const ev = await makeEvent()
      expect(ev).toMatchObject({ cancellationAllowed: false, cancellationDeadlineHours: 12 })
    })

    it('a default group gives events the R0.7 behaviour (allowed, 6 h as the old form)', async () => {
      const ev = await makeEvent()
      expect(ev).toMatchObject({ cancellationAllowed: true, cancellationDeadlineHours: 6 })
    })

    it('settings changes do not alter already created events', async () => {
      await organizationSettingsService.update(ctx(), orgId, { cancellationDeadlineHours: 6 })
      const before = await makeEvent()
      await organizationSettingsService.update(ctx(), orgId, {
        cancellationAllowed: false,
        cancellationDeadlineHours: 48,
        defaultJoinMode: 'invite',
        maxSeatsPerBooking: 1,
      })
      const [after] = await db.select().from(events).where(eq(events.id, before.id))
      expect(after).toEqual(before)
      expect(after).toMatchObject({ cancellationAllowed: true, cancellationDeadlineHours: 6 })

      const next = await makeEvent()
      expect(next).toMatchObject({ cancellationAllowed: false, cancellationDeadlineHours: 48 })
    })

    it('ignores a cancellation policy passed in the event input', async () => {
      await organizationSettingsService.update(ctx(), orgId, { cancellationDeadlineHours: 3 })
      // срок принимается для совместимости со старой формой, но игнорируется
      expect((await makeEvent({ cancellationDeadlineHours: 99 })).cancellationDeadlineHours).toBe(3)
      // cancellationAllowed в схеме создания нет (strict)
      await expect(makeEvent({ cancellationAllowed: false })).rejects.toMatchObject({
        name: 'ZodError',
      })
    })

    it('event update cannot change the snapshot', async () => {
      await organizationSettingsService.update(ctx(), orgId, { cancellationDeadlineHours: 3 })
      const ev = await makeEvent()
      const updated = await eventService.update(ctx(), ev.id, {
        title: 'Новое название',
        cancellationDeadlineHours: 72,
      })
      expect(updated.title).toBe('Новое название')
      expect(updated.cancellationDeadlineHours).toBe(3)
    })

    it('uses the group default price mode unless the event overrides it', async () => {
      process.env.EVENT_SPLIT_PRICING_ENABLED = 'true'
      await organizationSettingsService.update(ctx(), orgId, { defaultPriceMode: 'split' })

      const inherited = await makeEvent({ price: 0, targetAmount: 6000 })
      expect(inherited).toMatchObject({ priceMode: 'split', price: 0, targetAmount: 6000 })

      const overridden = await makeEvent({ priceMode: 'fixed', price: 1500 })
      expect(overridden).toMatchObject({ priceMode: 'fixed', price: 1500, targetAmount: null })
    })

    it('inherited split mode still requires a target and the split capability', async () => {
      process.env.EVENT_SPLIT_PRICING_ENABLED = 'true'
      await organizationSettingsService.update(ctx(), orgId, { defaultPriceMode: 'split' })
      await expect(makeEvent({ price: 0 })).rejects.toMatchObject({ name: 'ZodError' })

      delete process.env.EVENT_SPLIT_PRICING_ENABLED
      await expect(makeEvent({ price: 0, targetAmount: 6000 })).rejects.toMatchObject({
        code: 'event.split_pricing_disabled',
      })
      // явный fixed работает и без возможности split
      expect(await makeEvent({ priceMode: 'fixed' })).toMatchObject({ priceMode: 'fixed' })
    })

    it('keeps the R0.7 event pricing validation for explicit modes', async () => {
      await expect(makeEvent({ priceMode: 'fixed', targetAmount: 5000 })).rejects.toMatchObject({
        name: 'ZodError',
      })
    })
  })
})
