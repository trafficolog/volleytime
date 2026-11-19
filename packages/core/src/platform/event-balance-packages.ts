import {
  and,
  asc,
  auditLog,
  desc,
  eq,
  eventBalancePackages,
  isNotNull,
  isNull,
  lt,
  sql,
  users,
  type EventBalancePackage,
} from '@volley-time/db'
import type {
  PlatformEventBalancePackage,
  PlatformEventBalancePackages,
  PlatformPackageHistoryAction,
  PlatformPackageHistoryPage,
  PlatformPackageSales,
} from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { EventBalancePackageError } from '../event-balance/errors'
import {
  ArchivePackageInput,
  CreatePackageInput,
  DuplicatePackageInput,
  PackageHistoryQuery,
  UpdatePackageInput,
  type ArchivePackageInput as ArchiveInput,
  type CreatePackageInput as CreateInput,
  type DuplicatePackageInput as DuplicateInput,
  type PackageHistoryQuery as HistoryQuery,
  type UpdatePackageInput as UpdateInput,
} from '../event-balance/schemas'
import { assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb, inTransaction } from '../shared/context'

type Db = ReturnType<typeof getDb>

const MAX_CODE_ATTEMPTS = 3
const MAX_SORT_ORDER = 10_000
/** Ключ `pg_advisory_xact_lock` каталога: генерация кода и вставка сериализуются. */
const CATALOG_LOCK = sql`hashtext('event_balance_packages')`
const UNITS_ACTIVE_INDEX = 'event_balance_packages_units_currency_active'
const CODE_UNIQUE = 'event_balance_packages_code_unique'

/** Нарушение UNIQUE: drizzle оборачивает ошибку Postgres в `cause`. */
const isUniqueViolation = (e: unknown, constraint: string): boolean => {
  for (let err = e, depth = 0; err && typeof err === 'object' && depth < 3; depth++) {
    const pg = err as { code?: string; constraint_name?: string; cause?: unknown }
    if (pg.code === '23505' && pg.constraint_name === constraint) return true
    err = pg.cause
  }
  return false
}

/** `amount / units` в minor units, округление half-up до целого. */
export function pricePerEvent(amount: number, units: number): number {
  return Math.floor((2 * amount + units) / (2 * units))
}

const notFound = () =>
  new EventBalancePackageError('event_balance_package.not_found', 'Пакет не найден')
const stale = () =>
  new EventBalancePackageError(
    'event_balance_package.stale',
    'Пакет изменён другим администратором: обновите список',
  )
const archivedError = () =>
  new EventBalancePackageError('event_balance_package.archived', 'Пакет в архиве')
const unitsTaken = () =>
  new EventBalancePackageError(
    'event_balance_package.units_taken',
    'Пакет с таким количеством событий уже есть',
  )

type SalesRow = { pid: number | null; currency: string; sold: number; revenue: number }

/**
 * Продажи и выручка (ADR-22-2-1): только `approved`. Заявка с `package_id` относится к нему;
 * без `package_id` — к одному пакету с совпадающим по текущей строке снимком (неархивный, иначе
 * наименьший `id`), иначе остаётся без пакета (`pid IS NULL`). Каждая заявка — ровно в одной строке.
 */
async function salesRows(db: Db): Promise<SalesRow[]> {
  const rows = await db.execute(sql`
    SELECT a.pid, a.currency, count(*)::int AS sold, sum(a.amount)::bigint AS revenue
    FROM (
      SELECT r.amount, r.currency, COALESCE(r.package_id, m.id) AS pid
      FROM event_balance_purchase_requests r
      LEFT JOIN LATERAL (
        SELECT p.id FROM event_balance_packages p
        WHERE r.package_id IS NULL
          AND p.units = r.units AND p.amount = r.amount AND p.currency = r.currency
        ORDER BY (p.archived_at IS NOT NULL), p.id
        LIMIT 1
      ) m ON true
      WHERE r.status = 'approved'
    ) a
    GROUP BY a.pid, a.currency
    ORDER BY a.pid NULLS LAST, a.currency`)
  return Array.from(rows).map((r) => ({
    pid: r.pid === null ? null : Number(r.pid),
    currency: String(r.currency),
    sold: Number(r.sold),
    revenue: Number(r.revenue),
  }))
}

function toView(
  row: EventBalancePackage,
  sales: PlatformPackageSales[],
): PlatformEventBalancePackage {
  return {
    id: row.id,
    code: row.code,
    units: row.units,
    amount: row.amount,
    currency: row.currency,
    badge: row.badge,
    visible: row.visible,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    sortOrder: row.sortOrder,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    pricePerEvent: pricePerEvent(row.amount, row.units),
    sales,
  }
}

const toSales = (r: SalesRow): PlatformPackageSales => ({
  currency: r.currency,
  sold: r.sold,
  revenue: r.revenue,
})

async function viewOf(db: Db, id: number): Promise<PlatformEventBalancePackage> {
  const [row] = await db.select().from(eventBalancePackages).where(eq(eventBalancePackages.id, id))
  if (!row) throw notFound()
  const sales = (await salesRows(db)).filter((s) => s.pid === id).map(toSales)
  return toView(row, sales)
}

/** Первый свободный код `events_<units>`, `events_<units>_2`, … (коды не переиспользуются). */
async function freeCode(db: Db, units: number): Promise<string> {
  const base = `events_${units}`
  const taken = await db
    .select({ code: eventBalancePackages.code })
    .from(eventBalancePackages)
    .where(
      sql`${eventBalancePackages.code} = ${base} OR ${eventBalancePackages.code} LIKE ${`${base}\\_%`}`,
    )
  const used = new Set(taken.map((t) => t.code))
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}_${n}`)) return `${base}_${n}`
}

interface NewPackage {
  units: number
  amount: number
  currency: string
  badge: EventBalancePackage['badge']
  visible: boolean
  sortOrder: number
  duplicatedFromId?: number
}

/** Вставка нового пакета и запись аудита — в одной транзакции под advisory-lock каталога. */
async function insertPackage(
  ctx: ServiceContext,
  input: NewPackage,
): Promise<PlatformEventBalancePackage> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await inTransaction(ctx, async (tx) => {
        const db = getDb(tx)
        await db.execute(sql`SELECT pg_advisory_xact_lock(${CATALOG_LOCK})`)
        const code = await freeCode(db, input.units)
        const [row] = await db
          .insert(eventBalancePackages)
          .values({
            code,
            units: input.units,
            amount: input.amount,
            currency: input.currency,
            badge: input.badge,
            visible: input.visible,
            sortOrder: input.sortOrder,
          })
          .returning()
        await auditService.record(tx, {
          action: AUDIT_ACTIONS.EVENT_BALANCE_PACKAGE_CREATED,
          entityType: 'event_balance_package',
          entityId: row!.id,
          newValue: {
            units: row!.units,
            amount: row!.amount,
            currency: row!.currency,
            badge: row!.badge,
            visible: row!.visible,
            sortOrder: row!.sortOrder,
            ...(input.duplicatedFromId === undefined
              ? {}
              : { duplicatedFromId: input.duplicatedFromId }),
          },
        })
        return toView(row!, [])
      })
    } catch (e) {
      if (isUniqueViolation(e, UNITS_ACTIVE_INDEX)) throw unitsTaken()
      // гонка за код при снятом lock'е (ручные вставки): повторяем с новым первым свободным кодом
      if (isUniqueViolation(e, CODE_UNIQUE) && attempt < MAX_CODE_ATTEMPTS) continue
      throw e
    }
  }
}

/** Заблокировать строку пакета (`FOR UPDATE`); нет строки — 404. */
async function lockPackage(db: Db, id: number): Promise<EventBalancePackage> {
  const [row] = await db
    .select()
    .from(eventBalancePackages)
    .where(eq(eventBalancePackages.id, id))
    .for('update')
  if (!row) throw notFound()
  return row
}

/**
 * Каталог пакетов баланса событий в Root Admin (22.2.1, ADR-22-2-1): список с ценой за событие,
 * продажами и выручкой, создание, «Дублировать», правка, архив, история из `audit_log`.
 * Роль root проверяется здесь же, по базе, как второй рубеж после `requireRootAdmin` в API.
 * `code`, `units` и `currency` не меняются после создания; правка идёт с оптимистичной блокировкой
 * по `version` под `FOR UPDATE` строки (сериализация с заявками организатора, `FOR SHARE`); запись
 * аудита — в той же транзакции, что и изменение. Изменение цены не трогает заявки: они хранят снимок.
 */
export const platformEventBalancePackagesService = {
  async list(
    ctx: ServiceContext,
    params: { archived?: boolean } = {},
  ): Promise<PlatformEventBalancePackages> {
    await assertRootAdmin(ctx)
    const db = getDb(ctx)
    const archived = params.archived === true
    const [rows, sales] = await Promise.all([
      db
        .select()
        .from(eventBalancePackages)
        .where(
          archived
            ? isNotNull(eventBalancePackages.archivedAt)
            : isNull(eventBalancePackages.archivedAt),
        )
        .orderBy(
          asc(eventBalancePackages.sortOrder),
          asc(eventBalancePackages.units),
          asc(eventBalancePackages.id),
        ),
      salesRows(db),
    ])
    return {
      packages: rows.map((row) => toView(row, sales.filter((s) => s.pid === row.id).map(toSales))),
      unattributed: sales.filter((s) => s.pid === null).map(toSales),
    }
  },

  async create(ctx: ServiceContext, input: CreateInput): Promise<PlatformEventBalancePackage> {
    await assertRootAdmin(ctx)
    const data = CreatePackageInput.parse(input)
    return insertPackage(ctx, data)
  },

  /**
   * «Дублировать»: новый черновик с копией бейджа и порядком исходного + 1. Количество и цена —
   * из запроса, иначе из исходного; занятое среди неархивных количество — `units_taken`.
   */
  async duplicate(
    ctx: ServiceContext,
    id: number,
    input: DuplicateInput,
  ): Promise<PlatformEventBalancePackage> {
    await assertRootAdmin(ctx)
    const data = DuplicatePackageInput.parse(input)
    const [src] = await getDb(ctx)
      .select()
      .from(eventBalancePackages)
      .where(eq(eventBalancePackages.id, id))
    if (!src) throw notFound()
    return insertPackage(ctx, {
      units: data.units ?? src.units,
      amount: data.amount ?? src.amount,
      currency: src.currency,
      badge: src.badge,
      visible: false,
      sortOrder: Math.min(src.sortOrder + 1, MAX_SORT_ORDER),
      duplicatedFromId: src.id,
    })
  },

  /** Правка цены, бейджа, видимости и порядка; чужая правка с тем же `version` — 409 `stale`. */
  async update(
    ctx: ServiceContext,
    id: number,
    input: UpdateInput,
  ): Promise<PlatformEventBalancePackage> {
    await assertRootAdmin(ctx)
    const data = UpdatePackageInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const current = await lockPackage(db, id)
      if (current.archivedAt) throw archivedError()
      if (current.version !== data.version) throw stale()

      const patch: Partial<Pick<EventBalancePackage, 'amount' | 'badge' | 'sortOrder'>> = {}
      if (data.amount !== undefined && data.amount !== current.amount) patch.amount = data.amount
      if (data.badge !== undefined && data.badge !== current.badge) patch.badge = data.badge
      if (data.sortOrder !== undefined && data.sortOrder !== current.sortOrder) {
        patch.sortOrder = data.sortOrder
      }
      const visibilityChanged = data.visible !== undefined && data.visible !== current.visible
      if (Object.keys(patch).length === 0 && !visibilityChanged) return viewOf(db, id)

      const [row] = await db
        .update(eventBalancePackages)
        .set({
          ...patch,
          ...(visibilityChanged ? { visible: data.visible } : {}),
          version: sql`${eventBalancePackages.version} + 1`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(eventBalancePackages.id, id), eq(eventBalancePackages.version, data.version)))
        .returning()
      if (!row) throw stale()

      if (Object.keys(patch).length > 0) {
        const keys = Object.keys(patch) as (keyof typeof patch)[]
        await auditService.record(tx, {
          action: AUDIT_ACTIONS.EVENT_BALANCE_PACKAGE_UPDATED,
          entityType: 'event_balance_package',
          entityId: id,
          oldValue: Object.fromEntries(keys.map((k) => [k, current[k]])),
          newValue: Object.fromEntries(keys.map((k) => [k, row[k]])),
        })
      }
      if (visibilityChanged) {
        await auditService.record(tx, {
          action: AUDIT_ACTIONS.EVENT_BALANCE_PACKAGE_VISIBILITY_CHANGED,
          entityType: 'event_balance_package',
          entityId: id,
          oldValue: { visible: current.visible },
          newValue: { visible: row.visible },
        })
      }
      return viewOf(db, id)
    })
  },

  /** «Удалить» = архив: необратим из UI; повтор на архивном — 200 без записи аудита. */
  async archive(
    ctx: ServiceContext,
    id: number,
    input: ArchiveInput,
  ): Promise<PlatformEventBalancePackage> {
    await assertRootAdmin(ctx)
    const data = ArchivePackageInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const current = await lockPackage(db, id)
      if (current.archivedAt) return viewOf(db, id)
      if (current.version !== data.version) throw stale()
      const [row] = await db
        .update(eventBalancePackages)
        .set({
          archivedAt: sql`now()`,
          visible: false,
          version: sql`${eventBalancePackages.version} + 1`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(eventBalancePackages.id, id), eq(eventBalancePackages.version, data.version)))
        .returning()
      if (!row) throw stale()
      await auditService.record(tx, {
        action: AUDIT_ACTIONS.EVENT_BALANCE_PACKAGE_ARCHIVED,
        entityType: 'event_balance_package',
        entityId: id,
        oldValue: { visible: current.visible },
        newValue: { visible: false, archivedAt: row.archivedAt!.toISOString() },
      })
      return viewOf(db, id)
    })
  },

  /** История изменений: записи `audit_log` каталога, новые сверху; keyset по `id`. */
  async history(
    ctx: ServiceContext,
    query: HistoryQuery = {},
  ): Promise<PlatformPackageHistoryPage> {
    await assertRootAdmin(ctx)
    const { cursor, limit } = PackageHistoryQuery.parse(query)
    const where = and(
      eq(auditLog.entityType, 'event_balance_package'),
      cursor === undefined ? undefined : lt(auditLog.id, cursor),
    )
    const rows = await getDb(ctx)
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        action: auditLog.action,
        packageId: auditLog.entityId,
        packageCode: eventBalancePackages.code,
        oldValue: auditLog.oldValue,
        newValue: auditLog.newValue,
        actorId: users.id,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .leftJoin(eventBalancePackages, eq(eventBalancePackages.id, auditLog.entityId))
      .where(where)
      .orderBy(desc(auditLog.id))
      .limit(limit + 1)
    const page = rows.slice(0, limit)
    return {
      entries: page.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        action: r.action as PlatformPackageHistoryAction,
        packageId: r.packageId,
        packageCode: r.packageCode,
        actor:
          r.actorId === null
            ? null
            : { id: r.actorId, name: r.actorName ?? '', email: r.actorEmail },
        oldValue: r.oldValue,
        newValue: r.newValue,
      })),
      nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
    }
  },
}
