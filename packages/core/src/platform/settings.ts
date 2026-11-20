import {
  and,
  asc,
  auditLog,
  desc,
  eq,
  inArray,
  platformSettings,
  sql,
  users,
} from '@volley-time/db'
import {
  BOT_SETTING_KEYS,
  canonicalSettingValue,
  isPlatformSettingKey,
  parsePlatformSetting,
  PLATFORM_SETTING_KEYS,
  PLATFORM_SETTINGS,
  PLATFORM_SETTINGS_APPLY_DELAY_SECONDS,
  platformSettingDefaults,
  type BotSettings,
  type PlatformSettingKey,
  type PlatformSettingsHistoryEntry,
  type PlatformSettingsReadonly,
  type PlatformSettingsResponse,
  type PlatformSettingsValues,
  type PlatformSettingView,
} from '@volley-time/shared'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { OrganizationError } from '../organizations/errors'
import { assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb, inTransaction } from '../shared/context'

/** TTL кэша настроек (ADR-22-3-1): устаревание до 30 с принято владельцем. */
const CACHE_TTL_MS = PLATFORM_SETTINGS_APPLY_DELAY_SECONDS * 1000
/** Ошибка чтения не кэшируется дольше: кратковременный сбой не держит умолчания 30 с. */
const ERROR_TTL_MS = 5_000

/** Ошибки записи настроек (409 stale, 422 неизвестный ключ). */
export class PlatformSettingsError extends OrganizationError {
  /** Текущее состояние настроек при `platform_settings.stale` (для ответа 409). */
  current?: PlatformSettingsResponse
  constructor(code: 'platform_settings.stale' | 'platform_settings.unknown_key', message: string) {
    super(code, message)
    this.name = 'PlatformSettingsError'
  }
}

type Reporter = (message: string) => void
let reporter: Reporter = () => {}
/** Подключить внешний отчёт об ошибках (Sentry в web); сообщение — без значений настроек. */
export function setPlatformSettingsReporter(fn: Reporter): void {
  reporter = fn
}

function warn(message: string): void {
  console.warn(`[platform-settings] ${message}`)
  try {
    reporter(`platform-settings: ${message}`)
  } catch {
    // отчёт не должен ронять чтение настроек
  }
}

type Db = ReturnType<typeof getDb>
type Row = typeof platformSettings.$inferSelect

/** Значение строки по реестру; не проходящее схему или неизвестное — по умолчанию (с предупреждением). */
function effectiveValue(key: PlatformSettingKey, row: Row | undefined): unknown {
  if (!row) return PLATFORM_SETTINGS[key].default
  const parsed = parsePlatformSetting(key, row.value)
  if (parsed.ok) return parsed.value
  warn(`stored value of ${key} is invalid, default is used`)
  return PLATFORM_SETTINGS[key].default
}

function valuesFromRows(rows: Row[]): PlatformSettingsValues {
  const byKey = new Map(rows.map((r) => [r.key, r]))
  return Object.fromEntries(
    PLATFORM_SETTING_KEYS.map((k) => [k, effectiveValue(k, byKey.get(k))]),
  ) as unknown as PlatformSettingsValues
}

let cache: { values: PlatformSettingsValues; expiresAt: number } | null = null

/** Сбросить кэш процесса (после записи и в тестах). */
export function invalidatePlatformSettingsCache(): void {
  cache = null
}

/**
 * Полный типизированный объект настроек: значение из БД или по умолчанию для каждого ключа.
 * Кэш в памяти процесса, TTL 30 с. Ошибка чтения БД — значения по умолчанию, предупреждение и отчёт
 * без значений; такая ошибка кэшируется на 5 с. Читает через общий пул, а не через транзакцию
 * вызывающего: денежная транзакция берёт значение из кэша (ADR-22-3-1).
 */
export async function getPlatformSettings(_ctx?: ServiceContext): Promise<PlatformSettingsValues> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache.values
  try {
    const rows = await getDb({ userId: 0 }).select().from(platformSettings)
    const values = valuesFromRows(rows)
    cache = { values, expiresAt: now + CACHE_TTL_MS }
    return values
  } catch {
    warn('read failed, defaults are used')
    const values = platformSettingDefaults()
    cache = { values, expiresAt: now + ERROR_TTL_MS }
    return values
  }
}

/** Булевы статусы и неконфиденциальные константы; секреты не попадают сюда по построению. */
export function buildReadonlyStatus(
  env: Record<string, string | undefined>,
): PlatformSettingsReadonly {
  return {
    payments: {
      currency: 'BYN',
      model: 'manual_requests',
      onlinePayments: false,
      bankDetails: null,
    },
    general: { region: 'Europe/Minsk' },
    security: {
      authRateLimit: true,
      rootAuditLog: true,
      trustedProxy: env.TRUSTED_PROXY === '1',
    },
    integrations: {
      telegramBot: Boolean(env.TELEGRAM_BOT_TOKEN),
      telegramLoginWidget: env.TELEGRAM_LOGIN_WIDGET_ENABLED === 'true',
      smtp: env.EMAIL_DRIVER === 'unisender',
      sentry: Boolean(env.SENTRY_DSN_WEB || env.SENTRY_DSN),
      scheduler: env.SCHEDULER_ENABLED === 'true',
    },
    featureFlags: [
      'EVENT_BALANCE_ENFORCED',
      'COLLECTIONS_ENABLED',
      'EVENT_INVITE_MODE_ENABLED',
      'EVENT_MULTI_SEAT_ENABLED',
      'EVENT_SPLIT_PRICING_ENABLED',
      'SCHEDULER_ENABLED',
      'TELEGRAM_LOGIN_WIDGET_ENABLED',
    ].map((name) => ({ name, enabled: env[name] === 'true' })),
  }
}

const UpdateInput = z
  .object({
    changes: z
      .array(
        z
          .object({
            key: z.string().min(1).max(100),
            value: z.unknown(),
            version: z.number().int().min(0).max(2_147_483_647),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((v, ctx) => {
    const seen = new Set<string>()
    v.changes.forEach((c, i) => {
      if (seen.has(c.key))
        ctx.addIssue({ code: 'custom', path: ['changes', i, 'key'], message: 'Ключ повторяется' })
      seen.add(c.key)
    })
  })

async function loadView(db: Db): Promise<PlatformSettingsResponse> {
  const rows = await db
    .select({
      row: platformSettings,
      userName: users.name,
    })
    .from(platformSettings)
    .leftJoin(users, eq(users.id, platformSettings.updatedBy))
  const byKey = new Map(rows.map((r) => [r.row.key, r]))
  const settings = Object.fromEntries(
    PLATFORM_SETTING_KEYS.map((key) => {
      const hit = byKey.get(key)
      const view: PlatformSettingView = {
        value: effectiveValue(key, hit?.row),
        default: PLATFORM_SETTINGS[key].default,
        version: hit?.row.version ?? 0,
        updatedAt: hit?.row.updatedAt.toISOString() ?? null,
        updatedBy:
          hit && hit.row.updatedBy !== null ? { id: hit.row.updatedBy, name: hit.userName } : null,
      }
      return [key, view]
    }),
  ) as Record<PlatformSettingKey, PlatformSettingView>
  return {
    settings,
    readonly: buildReadonlyStatus(process.env),
    applyDelaySeconds: PLATFORM_SETTINGS_APPLY_DELAY_SECONDS,
  }
}

/** Настройки платформы для Root Admin (22.3.1, ADR-22-3-1). */
export const platformSettingsService = {
  /** `GET /api/platform/settings`: значения, версии и статусы только для чтения. */
  async get(ctx: ServiceContext): Promise<PlatformSettingsResponse> {
    await assertRootAdmin(ctx)
    return loadView(getDb(ctx))
  },

  /**
   * `PATCH /api/platform/settings`: все изменения или ни одного. `version` каждого ключа должна
   * совпасть с текущей (`0` — строки нет), иначе 409 `platform_settings.stale` с текущим состоянием.
   * Значение, равное действующему (сохранённому или по умолчанию), — no-op: строка, `version` и
   * аудит не меняются. Аудит — по записи на изменённый ключ, в той же транзакции.
   */
  async update(ctx: ServiceContext, input: unknown): Promise<PlatformSettingsResponse> {
    await assertRootAdmin(ctx)
    const data = UpdateInput.parse(input)
    const parsed = data.changes.map((c, i) => {
      if (!isPlatformSettingKey(c.key))
        throw new PlatformSettingsError(
          'platform_settings.unknown_key',
          'Неизвестный ключ настройки',
        )
      const result = parsePlatformSetting(c.key, c.value)
      if (!result.ok)
        throw new z.ZodError([
          { code: 'custom', path: ['changes', i, c.key], message: result.message, input: c.value },
        ])
      return { key: c.key, value: result.value, version: c.version }
    })
    parsed.sort((a, b) => a.key.localeCompare(b.key))
    try {
      await inTransaction(ctx, async (tx) => {
        const db = getDb(tx)
        const rows = await db
          .select()
          .from(platformSettings)
          .where(
            inArray(
              platformSettings.key,
              parsed.map((c) => c.key),
            ),
          )
          .orderBy(asc(platformSettings.key))
          .for('update')
        const byKey = new Map(rows.map((r) => [r.key, r]))
        const stale = () =>
          new PlatformSettingsError(
            'platform_settings.stale',
            'Настройки изменил другой администратор',
          )
        for (const c of parsed) {
          if ((byKey.get(c.key)?.version ?? 0) !== c.version) throw stale()
        }
        for (const c of parsed) {
          const row = byKey.get(c.key)
          const current = effectiveValue(c.key, row)
          if (canonicalSettingValue(current) === canonicalSettingValue(c.value)) continue
          let id: number
          if (row) {
            await db
              .update(platformSettings)
              .set({
                value: c.value,
                version: sql`${platformSettings.version} + 1`,
                updatedBy: ctx.userId,
                updatedAt: new Date(),
              })
              .where(eq(platformSettings.id, row.id))
            id = row.id
          } else {
            const [inserted] = await db
              .insert(platformSettings)
              .values({ key: c.key, value: c.value, version: 1, updatedBy: ctx.userId })
              .onConflictDoNothing({ target: platformSettings.key })
              .returning({ id: platformSettings.id })
            if (!inserted) throw stale()
            id = inserted.id
          }
          await auditService.record(tx, {
            action: AUDIT_ACTIONS.PLATFORM_SETTING_UPDATED,
            entityType: 'platform_setting',
            entityId: id,
            oldValue: { key: c.key, value: current },
            newValue: { key: c.key, value: c.value },
          })
        }
      })
    } catch (e) {
      if (e instanceof PlatformSettingsError && e.code === 'platform_settings.stale') {
        e.current = await loadView(getDb(ctx))
      }
      throw e
    } finally {
      // кэш своего процесса — после коммита (или отката: чтение заново безвредно)
      invalidatePlatformSettingsCache()
    }
    return loadView(getDb(ctx))
  },

  /** Последние изменения настроек из `audit_log` (кто, когда, ключ, было → стало). */
  async history(ctx: ServiceContext, limit = 10): Promise<PlatformSettingsHistoryEntry[]> {
    await assertRootAdmin(ctx)
    const rows = await getDb(ctx)
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        userId: auditLog.userId,
        userName: users.name,
        oldValue: auditLog.oldValue,
        newValue: auditLog.newValue,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(
        and(
          eq(auditLog.entityType, 'platform_setting'),
          eq(auditLog.action, AUDIT_ACTIONS.PLATFORM_SETTING_UPDATED),
        ),
      )
      .orderBy(desc(auditLog.id))
      .limit(Math.min(Math.max(limit, 1), 50))
    return rows.map((r) => {
      const o = (r.oldValue ?? {}) as { key?: string; value?: unknown }
      const n = (r.newValue ?? {}) as { key?: string; value?: unknown }
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        actor: r.userId === null ? null : { id: r.userId, name: r.userName },
        key: n.key ?? o.key ?? '',
        oldValue: o.value ?? null,
        newValue: n.value ?? null,
      }
    })
  },

  /** Только ключи `bot.*` для внутреннего маршрута бота (`GET /api/internal/bot/settings`). */
  async botSettings(): Promise<{ settings: BotSettings }> {
    const all = await getPlatformSettings()
    return {
      settings: Object.fromEntries(BOT_SETTING_KEYS.map((k) => [k, all[k]])) as BotSettings,
    }
  },
}
