import { auditLog, closeDb, db, eq, organizations, platformSettings, users } from '@volley-time/db'
import { resetPlatformSettings } from '@volley-time/db/test-utils'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ForbiddenError } from '../permissions/errors'

import {
  buildReadonlyStatus,
  getPlatformSettings,
  invalidatePlatformSettingsCache,
  PlatformSettingsError,
  platformSettingsService as service,
} from './settings'

/**
 * Task 22.3.1 (ADR-22-3-1): настройки платформы. Часы фиксируются только для кэша (`Date`).
 */
describe('platform settings (integration)', { timeout: 60_000 }, () => {
  let seq = 0
  let rootId: number
  let plainId: number
  const ctx = () => ({ userId: rootId })

  const newUser = async (label: string, isRootAdmin = false) =>
    (
      await db
        .insert(users)
        .values({ email: `ps-${label}-${++seq}@t.by`, name: label, isRootAdmin })
        .returning()
    )[0]!.id

  const audit = () =>
    db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityType, 'platform_setting'))
      .orderBy(auditLog.id)

  const codeOf = async (p: Promise<unknown>) => {
    try {
      await p
      return 'ok'
    } catch (e) {
      const err = e as { code?: string; name?: string }
      return err.code ?? err.name
    }
  }

  beforeEach(async () => {
    await resetPlatformSettings()
    invalidatePlatformSettingsCache()
    rootId = await newUser('root', true)
    plainId = await newUser('plain')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await resetPlatformSettings()
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('without rows every value equals the behaviour before 22.3.1', async () => {
    expect(await getPlatformSettings()).toEqual({
      'general.platformName': 'Volley Time',
      'general.supportContact': null,
      'eventBalance.newOrganizationGrant': 5,
      'events.maxPublishedPerDay': null,
      'bot.callbackLimit': 8,
      'bot.callbackWindowSeconds': 10,
    })
    const view = await service.get(ctx())
    expect(view.applyDelaySeconds).toBe(30)
    for (const s of Object.values(view.settings)) {
      expect(s).toMatchObject({ version: 0, updatedAt: null, updatedBy: null })
      expect(s.value).toEqual(s.default)
    }
  })

  it('is root-only: 403 forbidden.root_only for everyone else', async () => {
    const plain = { userId: plainId }
    const body = { changes: [{ key: 'bot.callbackLimit', value: 9, version: 0 }] }
    for (const call of [service.get(plain), service.update(plain, body), service.history(plain)]) {
      const err = await call.catch((e: unknown) => e)
      expect(err).toBeInstanceOf(ForbiddenError)
      expect((err as ForbiddenError).code).toBe('forbidden.root_only')
    }
    expect(await db.select().from(platformSettings)).toHaveLength(0)
  })

  it('writes a value: version 1, updated_by, audit in the same transaction, then version 2', async () => {
    const first = await service.update(ctx(), {
      changes: [{ key: 'bot.callbackLimit', value: 12, version: 0 }],
    })
    expect(first.settings['bot.callbackLimit']).toMatchObject({
      value: 12,
      default: 8,
      version: 1,
      updatedBy: { id: rootId, name: 'root' },
    })
    expect(first.settings['bot.callbackLimit'].updatedAt).not.toBeNull()
    const rows = await db.select().from(platformSettings)
    expect(rows).toHaveLength(1)
    const log = await audit()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({
      action: 'platform_setting.updated',
      entityType: 'platform_setting',
      entityId: rows[0]!.id,
      organizationId: null,
      userId: rootId,
      oldValue: { key: 'bot.callbackLimit', value: 8 },
      newValue: { key: 'bot.callbackLimit', value: 12 },
    })

    const second = await service.update(ctx(), {
      changes: [{ key: 'bot.callbackLimit', value: 20, version: 1 }],
    })
    expect(second.settings['bot.callbackLimit'].version).toBe(2)
    expect((await audit())[1]!.oldValue).toEqual({ key: 'bot.callbackLimit', value: 12 })
  })

  it('a value equal to the effective one is a no-op: no row, version or audit', async () => {
    // равно значению по умолчанию, строки нет
    await service.update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: 8, version: 0 }] })
    expect(await db.select().from(platformSettings)).toHaveLength(0)
    expect(await audit()).toHaveLength(0)
    // равно сохранённому
    await service.update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: 9, version: 0 }] })
    const res = await service.update(ctx(), {
      changes: [{ key: 'bot.callbackLimit', value: 9, version: 1 }],
    })
    expect(res.settings['bot.callbackLimit'].version).toBe(1)
    expect(await audit()).toHaveLength(1)
    // после тримма текст равен действующему
    await service.update(ctx(), {
      changes: [{ key: 'general.platformName', value: '  Volley Time  ', version: 0 }],
    })
    expect(await audit()).toHaveLength(1)
  })

  it('returning to the default is an ordinary write (row stays, history kept)', async () => {
    await service.update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: 9, version: 0 }] })
    const res = await service.update(ctx(), {
      changes: [{ key: 'bot.callbackLimit', value: 8, version: 1 }],
    })
    expect(res.settings['bot.callbackLimit']).toMatchObject({ value: 8, version: 2 })
    expect(await db.select().from(platformSettings)).toHaveLength(1)
    expect(await audit()).toHaveLength(2)
  })

  it('409 stale with the current state, nothing applied when any key is stale', async () => {
    await service.update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: 9, version: 0 }] })
    const err = (await service
      .update(ctx(), {
        changes: [
          { key: 'bot.callbackWindowSeconds', value: 30, version: 0 },
          { key: 'bot.callbackLimit', value: 50, version: 0 }, // устарела
        ],
      })
      .catch((e: unknown) => e)) as PlatformSettingsError
    expect(err).toBeInstanceOf(PlatformSettingsError)
    expect(err.code).toBe('platform_settings.stale')
    expect(err.current?.settings['bot.callbackLimit'].value).toBe(9)
    expect(err.current?.settings['bot.callbackWindowSeconds'].value).toBe(10)
    expect(await db.select().from(platformSettings)).toHaveLength(1)
    expect(await audit()).toHaveLength(1)
  })

  it('two parallel creations of the same key: exactly one wins, the other is stale', async () => {
    const results = await Promise.allSettled([
      service.update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: 11, version: 0 }] }),
      service.update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: 12, version: 0 }] }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect((lost.reason as { code: string }).code).toBe('platform_settings.stale')
    expect(await db.select().from(platformSettings)).toHaveLength(1)
    expect(await audit()).toHaveLength(1)
  })

  it('applies several keys atomically and audits each changed key once', async () => {
    await service.update(ctx(), {
      changes: [
        { key: 'general.platformName', value: 'Волейтайм', version: 0 },
        { key: 'general.supportContact', value: '@support', version: 0 },
        { key: 'events.maxPublishedPerDay', value: null, version: 0 }, // no-op
      ],
    })
    expect(await db.select().from(platformSettings)).toHaveLength(2)
    expect(await audit()).toHaveLength(2)
  })

  it('rejects unknown keys (422 unknown_key) and invalid values with the key path', async () => {
    expect(
      await codeOf(
        service.update(ctx(), { changes: [{ key: 'smtp.password', value: 'x', version: 0 }] }),
      ),
    ).toBe('platform_settings.unknown_key')
    expect(
      await codeOf(
        service.update(ctx(), { changes: [{ key: 'toString', value: 'x', version: 0 }] }),
      ),
    ).toBe('platform_settings.unknown_key')

    const err = (await service
      .update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: '5', version: 0 }] })
      .catch((e: unknown) => e)) as { name: string; issues: { path: PropertyKey[] }[] }
    expect(err.name).toBe('ZodError')
    expect(err.issues[0]!.path).toContain('bot.callbackLimit')

    for (const bad of [
      { changes: [] },
      { changes: Array.from({ length: 21 }, () => ({ key: 'a.b', value: 1, version: 0 })) },
      {
        changes: [
          { key: 'bot.callbackLimit', value: 9, version: 0 },
          { key: 'bot.callbackLimit', value: 10, version: 0 },
        ],
      },
      { changes: [{ key: 'bot.callbackLimit', value: 9, version: 0, extra: 1 }] },
      { changes: [{ key: 'bot.callbackLimit', value: 9, version: -1 }] },
      { changes: [{ key: 'bot.callbackLimit', value: 9, version: 0 }], extra: true },
    ]) {
      expect(await codeOf(service.update(ctx(), bad))).toBe('ZodError')
    }
    expect(await db.select().from(platformSettings)).toHaveLength(0)
  })

  it('serves cached values for 30 s and sees a change after the service writes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-01T10:00:00Z'))
    expect((await getPlatformSettings())['bot.callbackLimit']).toBe(8)
    // запись в обход сервиса: кэш этого процесса её не видит до истечения TTL
    await db.insert(platformSettings).values({ key: 'bot.callbackLimit', value: 33 })
    vi.setSystemTime(new Date('2030-01-01T10:00:29Z'))
    expect((await getPlatformSettings())['bot.callbackLimit']).toBe(8)
    vi.setSystemTime(new Date('2030-01-01T10:00:31Z'))
    expect((await getPlatformSettings())['bot.callbackLimit']).toBe(33)
    // запись через сервис сбрасывает кэш своего процесса сразу
    await service.update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: 44, version: 1 }] })
    expect((await getPlatformSettings())['bot.callbackLimit']).toBe(44)
  })

  it('an invalid or unknown stored value falls back to the default without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await db.insert(platformSettings).values([
      { key: 'bot.callbackLimit', value: 'oops' },
      { key: 'events.maxPublishedPerDay', value: 3 },
      { key: 'removed.keyAfterRollback', value: 1 },
    ])
    const values = await getPlatformSettings()
    expect(values['bot.callbackLimit']).toBe(8)
    expect(values['events.maxPublishedPerDay']).toBe(3)
    expect(Object.keys(values)).not.toContain('removed.keyAfterRollback')
    expect(warn).toHaveBeenCalled()
    // сообщение без значения
    expect(JSON.stringify(warn.mock.calls)).not.toContain('oops')
  })

  it('a read error gives defaults, is cached for 5 s only and does not throw', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-01T10:00:00Z'))
    await db.insert(platformSettings).values({ key: 'bot.callbackLimit', value: 33 })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(db, 'select').mockImplementationOnce(() => {
      throw new Error('connection lost')
    })
    expect((await getPlatformSettings())['bot.callbackLimit']).toBe(8)
    expect(warn).toHaveBeenCalled()
    vi.setSystemTime(new Date('2030-01-01T10:00:04Z'))
    expect((await getPlatformSettings())['bot.callbackLimit']).toBe(8)
    vi.setSystemTime(new Date('2030-01-01T10:00:06Z'))
    expect((await getPlatformSettings())['bot.callbackLimit']).toBe(33)
  })

  it('serves only bot.* keys to the bot', async () => {
    await service.update(ctx(), {
      changes: [
        { key: 'bot.callbackLimit', value: 4, version: 0 },
        { key: 'general.supportContact', value: 'secret-ish contact', version: 0 },
      ],
    })
    expect(await service.botSettings()).toEqual({
      settings: { 'bot.callbackLimit': 4, 'bot.callbackWindowSeconds': 10 },
    })
  })

  it('history lists the last changes with actor and old → new values', async () => {
    await service.update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: 9, version: 0 }] })
    await service.update(ctx(), { changes: [{ key: 'bot.callbackLimit', value: 10, version: 1 }] })
    const history = await service.history(ctx())
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({
      key: 'bot.callbackLimit',
      oldValue: 9,
      newValue: 10,
      actor: { id: rootId, name: 'root' },
    })
  })

  it('the response never carries secrets: readonly is built from an allowlist of statuses', async () => {
    const saved = { ...process.env }
    process.env.TELEGRAM_BOT_TOKEN = '123456:SECRET-TOKEN-VALUE'
    process.env.BETTER_AUTH_SECRET = 'super-secret-auth-value-32-chars-xx'
    process.env.BOT_INTERNAL_SECRET = 'internal-secret-value'
    process.env.SENTRY_DSN = 'https://key@sentry.example/1'
    process.env.DATABASE_URL = 'postgresql://user:pw-secret@host/db'
    try {
      const view = await service.get(ctx())
      const json = JSON.stringify(view)
      for (const secret of [
        'SECRET-TOKEN-VALUE',
        'super-secret-auth-value',
        'internal-secret-value',
        'sentry.example',
        'pw-secret',
      ]) {
        expect(json).not.toContain(secret)
      }
      expect(view.readonly.integrations.telegramBot).toBe(true)
      expect(view.readonly.integrations.sentry).toBe(true)
      expect(view.readonly.payments).toEqual({
        currency: 'BYN',
        model: 'manual_requests',
        onlinePayments: false,
        bankDetails: null,
      })
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
      Object.assign(process.env, saved)
    }
  })

  it('feature flags follow the exact-true rule and only allowlisted names are listed', () => {
    const readonly = buildReadonlyStatus({
      EVENT_BALANCE_ENFORCED: 'true',
      COLLECTIONS_ENABLED: 'TRUE',
      SCHEDULER_ENABLED: '1',
      SOME_OTHER_SECRET: 'true',
    })
    expect(Object.fromEntries(readonly.featureFlags.map((f) => [f.name, f.enabled]))).toEqual({
      EVENT_BALANCE_ENFORCED: true,
      COLLECTIONS_ENABLED: false,
      EVENT_INVITE_MODE_ENABLED: false,
      EVENT_MULTI_SEAT_ENABLED: false,
      EVENT_SPLIT_PRICING_ENABLED: false,
      SCHEDULER_ENABLED: false,
      TELEGRAM_LOGIN_WIDGET_ENABLED: false,
    })
  })
})
