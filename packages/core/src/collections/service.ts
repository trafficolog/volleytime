import {
  and,
  collections,
  desc,
  eq,
  inArray,
  ne,
  payments,
  sql,
  users,
  type Collection,
  type Payment,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { PaymentNotFoundError } from '../payments/errors'
import { paymentService } from '../payments/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'
import { resolveOrgCurrency } from '../shared/currency'

import { isCollectionsEnabled } from './capability'
import {
  CollectionNotActiveError,
  CollectionNotFoundError,
  CollectionsDisabledError,
} from './errors'
import {
  ContributeInput,
  CreateCollectionInput,
  encodeCollectionCursor,
  ListCollectionsQuery,
  UpdateCollectionInput,
} from './schemas'

type Db = ReturnType<typeof getDb>

/** Кто смотрит: manager видит черновики; игрок — только опубликованные сборы. */
export interface CollectionViewer {
  manager: boolean
}

export interface CollectionView {
  id: number
  title: string
  description: string | null
  icon: string
  targetAmount: number | null
  currency: string
  status: Collection['status']
  deadlineAt: Date | null
  createdAt: Date
  updatedAt: Date
  closedAt: Date | null
  createdBy: { id: number; name: string | null }
  /** Сумма подтверждённых взносов (`succeeded`) = поступления кассы по сбору. */
  collected: number
  /** Сумма ожидающих обещаний (`pending`). */
  pledged: number
  /** Число игроков с подтверждённым взносом. */
  contributors: number
  /** Взносы того, кто смотрит. */
  my: { paid: number; pending: { id: number; amount: number; method: Payment['method'] } | null }
}

export interface ContributionView {
  id: number
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  amount: number
  currency: string
  method: Payment['method']
  status: Payment['status']
  createdAt: Date
  confirmedAt: Date | null
}

const assertWritable = () => {
  if (!isCollectionsEnabled(process.env.COLLECTIONS_ENABLED)) throw new CollectionsDisabledError()
}

/**
 * Строка сбора под `FOR UPDATE`: сериализует взносы, решения по ним, правку и закрытие сбора.
 * Порядок блокировок — сбор, затем платёж (как событие → платёж у записей, ADR v3, принцип 7).
 */
async function lockCollection(db: Db, orgId: number, id: number): Promise<Collection> {
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.organizationId, orgId)))
    .for('update')
  if (!row) throw new CollectionNotFoundError(id)
  return row
}

/** Итоги взносов по сборам одним запросом (подтверждённые, обещания, участники, свои). */
async function totals(db: Db, ids: number[], userId: number) {
  const map = new Map<
    number,
    Pick<CollectionView, 'collected' | 'pledged' | 'contributors' | 'my'>
  >()
  for (const id of ids)
    map.set(id, { collected: 0, pledged: 0, contributors: 0, my: { paid: 0, pending: null } })
  if (ids.length === 0) return map
  const rows = await db
    .select({
      collectionId: payments.collectionId,
      collected: sql<number>`coalesce(sum(${payments.amount}) FILTER (WHERE ${payments.status} = 'succeeded'), 0)::int`,
      pledged: sql<number>`coalesce(sum(${payments.amount}) FILTER (WHERE ${payments.status} = 'pending'), 0)::int`,
      contributors: sql<number>`count(DISTINCT ${payments.userId}) FILTER (WHERE ${payments.status} = 'succeeded')::int`,
      myPaid: sql<number>`coalesce(sum(${payments.amount}) FILTER (WHERE ${payments.status} = 'succeeded' AND ${payments.userId} = ${userId}), 0)::int`,
    })
    .from(payments)
    .where(inArray(payments.collectionId, ids))
    .groupBy(payments.collectionId)
  for (const r of rows) {
    const t = map.get(r.collectionId!)!
    t.collected = r.collected
    t.pledged = r.pledged
    t.contributors = r.contributors
    t.my.paid = r.myPaid
  }
  const mine = await db
    .select({
      id: payments.id,
      collectionId: payments.collectionId,
      amount: payments.amount,
      method: payments.method,
    })
    .from(payments)
    .where(
      and(
        inArray(payments.collectionId, ids),
        eq(payments.userId, userId),
        eq(payments.status, 'pending'),
      ),
    )
  for (const p of mine)
    map.get(p.collectionId!)!.my.pending = { id: p.id, amount: p.amount, method: p.method }
  return map
}

async function views(db: Db, rows: Collection[], userId: number): Promise<CollectionView[]> {
  const sums = await totals(
    db,
    rows.map((r) => r.id),
    userId,
  )
  const authorIds = [...new Set(rows.map((r) => r.createdByUserId))]
  const authors = authorIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, authorIds))
    : []
  const byId = new Map(authors.map((a) => [a.id, a]))
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    icon: r.icon,
    targetAmount: r.targetAmount,
    currency: r.currency,
    status: r.status,
    deadlineAt: r.deadlineAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    closedAt: r.closedAt,
    createdBy: byId.get(r.createdByUserId) ?? { id: r.createdByUserId, name: null },
    ...sums.get(r.id)!,
  }))
}

/** Сбор группы, видимый смотрящему: черновик игроку — как несуществующий (404). */
async function findVisible(
  db: Db,
  orgId: number,
  id: number,
  viewer: CollectionViewer,
): Promise<Collection> {
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.organizationId, orgId)))
  if (!row || (!viewer.manager && row.status === 'draft')) throw new CollectionNotFoundError(id)
  return row
}

/** Платёж-взнос этого сбора этой группы; иначе 404 без раскрытия чужих данных. */
async function contributionOf(
  db: Db,
  orgId: number,
  collectionId: number,
  paymentId: number,
): Promise<Payment> {
  await findVisible(db, orgId, collectionId, { manager: true })
  const [p] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.organizationId, orgId),
        eq(payments.collectionId, collectionId),
      ),
    )
  if (!p) throw new PaymentNotFoundError(paymentId)
  return p
}

export const collectionService = {
  async list(
    ctx: ServiceContext,
    orgId: number,
    query: ListCollectionsQuery,
    viewer: CollectionViewer,
  ): Promise<{ collections: CollectionView[]; nextCursor: string | null }> {
    const { limit, cursor } = ListCollectionsQuery.parse(query)
    const db = getDb(ctx)
    const conditions = [eq(collections.organizationId, orgId)]
    if (!viewer.manager) conditions.push(ne(collections.status, 'draft'))
    if (cursor) {
      conditions.push(
        sql`(${collections.createdAt}, ${collections.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id})`,
      )
    }
    const rows = await db
      .select({
        row: collections,
        key: sql<string>`to_char(${collections.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(collections)
      .where(and(...conditions))
      .orderBy(desc(collections.createdAt), desc(collections.id))
      .limit(limit + 1)
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    return {
      collections: await views(
        db,
        page.map((r) => r.row),
        ctx.userId,
      ),
      nextCursor:
        rows.length > limit && last
          ? encodeCollectionCursor({ createdAt: last.key, id: last.row.id })
          : null,
    }
  },

  /** Сбор с итогами и взносами (подтверждённые и обещания; отклонённые и возвращённые скрыты). */
  async get(
    ctx: ServiceContext,
    orgId: number,
    id: number,
    viewer: CollectionViewer,
  ): Promise<{ collection: CollectionView; contributions: ContributionView[] }> {
    const db = getDb(ctx)
    const row = await findVisible(db, orgId, id, viewer)
    const [collection] = await views(db, [row], ctx.userId)
    const contributions = await db
      .select({
        id: payments.id,
        user: {
          id: users.id,
          name: users.name,
          telegramUsername: users.telegramUsername,
          image: users.image,
        },
        amount: payments.amount,
        currency: payments.currency,
        method: payments.method,
        status: payments.status,
        createdAt: payments.createdAt,
        confirmedAt: payments.confirmedAt,
      })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.userId))
      .where(
        and(
          eq(payments.collectionId, id),
          eq(payments.organizationId, orgId),
          inArray(payments.status, ['pending', 'succeeded']),
        ),
      )
      .orderBy(desc(payments.createdAt), desc(payments.id))
    return { collection: collection!, contributions }
  },

  async create(
    ctx: ServiceContext,
    orgId: number,
    input: CreateCollectionInput,
  ): Promise<Collection> {
    assertWritable()
    const data = CreateCollectionInput.parse(input)
    return inTransaction(ctx, async (txCtx) => {
      const currency = await resolveOrgCurrency(txCtx, orgId)
      const [row] = await getDb(txCtx)
        .insert(collections)
        .values({
          organizationId: orgId,
          title: data.title,
          description: data.description ?? null,
          icon: data.icon,
          targetAmount: data.targetAmount,
          currency,
          status: data.status,
          deadlineAt: data.deadlineAt ?? null,
          createdByUserId: ctx.userId,
        })
        .returning()
      await auditService.record(txCtx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.COLLECTION_CREATED,
        entityType: 'collection',
        entityId: row!.id,
        newValue: { title: row!.title, status: row!.status, targetAmount: row!.targetAmount },
      })
      return row!
    })
  },

  /** Правка полей до закрытия; `status: 'active'` публикует черновик. */
  async update(
    ctx: ServiceContext,
    orgId: number,
    id: number,
    input: UpdateCollectionInput,
  ): Promise<Collection> {
    const data = UpdateCollectionInput.parse(input)
    return inTransaction(ctx, async (txCtx) => {
      const db = getDb(txCtx)
      const before = await lockCollection(db, orgId, id)
      if (before.status !== 'draft' && before.status !== 'active')
        throw new CollectionNotActiveError()
      const set: Partial<typeof collections.$inferInsert> = {}
      if (data.title !== undefined) set.title = data.title
      if (data.description !== undefined) set.description = data.description
      if (data.icon !== undefined) set.icon = data.icon
      if (data.targetAmount !== undefined) set.targetAmount = data.targetAmount
      if (data.deadlineAt !== undefined) set.deadlineAt = data.deadlineAt
      if (data.status !== undefined) set.status = data.status
      if (Object.keys(set).length === 0) return before
      const [row] = await db
        .update(collections)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(collections.id, id))
        .returning()
      const changed = Object.keys(set) as (keyof typeof set)[]
      await auditService.record(txCtx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.COLLECTION_UPDATED,
        entityType: 'collection',
        entityId: id,
        oldValue: Object.fromEntries(changed.map((k) => [k, before[k as keyof Collection]])),
        newValue: Object.fromEntries(changed.map((k) => [k, row![k as keyof Collection]])),
      })
      return row!
    })
  },

  /** Завершить активный сбор: новые взносы закрыты, ожидающие обещания можно подтвердить. */
  async complete(ctx: ServiceContext, orgId: number, id: number): Promise<Collection> {
    return inTransaction(ctx, async (txCtx) => {
      const db = getDb(txCtx)
      const before = await lockCollection(db, orgId, id)
      if (before.status !== 'active') throw new CollectionNotActiveError()
      const now = new Date()
      const [row] = await db
        .update(collections)
        .set({ status: 'completed', closedAt: now, updatedAt: now })
        .where(eq(collections.id, id))
        .returning()
      await auditService.record(txCtx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.COLLECTION_COMPLETED,
        entityType: 'collection',
        entityId: id,
        oldValue: { status: before.status },
        newValue: { status: 'completed' },
      })
      return row!
    })
  },

  /**
   * Отменить черновик или активный сбор: ожидающие обещания отклоняются в той же транзакции;
   * подтверждённые взносы и касса не меняются (возврат — отдельная операция платежа).
   */
  async cancel(ctx: ServiceContext, orgId: number, id: number): Promise<Collection> {
    return inTransaction(ctx, async (txCtx) => {
      const db = getDb(txCtx)
      const before = await lockCollection(db, orgId, id)
      if (before.status !== 'draft' && before.status !== 'active')
        throw new CollectionNotActiveError()
      const rejected = await db
        .update(payments)
        .set({ status: 'cancelled' })
        .where(and(eq(payments.collectionId, id), eq(payments.status, 'pending')))
        .returning({ id: payments.id })
      const now = new Date()
      const [row] = await db
        .update(collections)
        .set({ status: 'cancelled', closedAt: now, updatedAt: now })
        .where(eq(collections.id, id))
        .returning()
      await auditService.record(txCtx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.COLLECTION_CANCELLED,
        entityType: 'collection',
        entityId: id,
        oldValue: { status: before.status },
        newValue: { status: 'cancelled', rejectedPaymentIds: rejected.map((p) => p.id) },
      })
      return row!
    })
  },

  /**
   * Свой взнос в активный сбор — pending-платёж до подтверждения организатором. Одно ожидающее
   * обещание игрока в сборе: повтор до подтверждения меняет сумму и способ (`replaced: true`).
   */
  async contribute(
    ctx: ServiceContext,
    orgId: number,
    id: number,
    input: ContributeInput,
  ): Promise<{ contribution: Payment; replaced: boolean }> {
    assertWritable()
    const data = ContributeInput.parse(input)
    return inTransaction(ctx, async (txCtx) => {
      const db = getDb(txCtx)
      const collection = await lockCollection(db, orgId, id)
      if (collection.status === 'draft') throw new CollectionNotFoundError(id)
      if (collection.status !== 'active') throw new CollectionNotActiveError()
      const [replaced] = await db
        .update(payments)
        .set({ amount: data.amount, method: data.method })
        .where(
          and(
            eq(payments.collectionId, id),
            eq(payments.userId, ctx.userId),
            eq(payments.status, 'pending'),
          ),
        )
        .returning()
      if (replaced) return { contribution: replaced, replaced: true }
      const contribution = await paymentService.createForCollection(
        txCtx,
        {
          organizationId: orgId,
          userId: ctx.userId,
          collectionId: id,
          amount: data.amount,
          currency: collection.currency,
          method: data.method,
        },
        collection.title,
      )
      return { contribution, replaced: false }
    })
  },

  /** Подтвердить взнос этого сбора: платёж `succeeded` и доход кассы `contribution`. */
  async confirmContribution(
    ctx: ServiceContext,
    orgId: number,
    collectionId: number,
    paymentId: number,
  ): Promise<Payment> {
    await contributionOf(getDb(ctx), orgId, collectionId, paymentId)
    return paymentService.confirm(ctx, paymentId, { orgId })
  },

  /** Отклонить взнос этого сбора: платёж `cancelled`, касса не меняется. */
  async rejectContribution(
    ctx: ServiceContext,
    orgId: number,
    collectionId: number,
    paymentId: number,
  ): Promise<Payment> {
    await contributionOf(getDb(ctx), orgId, collectionId, paymentId)
    return paymentService.cancel(ctx, paymentId, { orgId })
  },
}
