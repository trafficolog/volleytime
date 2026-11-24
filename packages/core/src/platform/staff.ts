import { and, asc, eq, platformStaff, sql, users } from '@volley-time/db'
import {
  PLATFORM_POLICIES,
  PLATFORM_ROLES,
  type PlatformPolicy,
  type PlatformRole,
  type PlatformStaffList,
  type PlatformStaffMe,
  type PlatformStaffMember,
} from '@volley-time/shared'
import { z } from 'zod'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { ForbiddenError } from '../permissions/errors'
import { ROLE_DENIED_CODE, assertRootAdmin } from '../permissions/root'
import { type ServiceContext, getDb, inTransaction } from '../shared/context'

import { PlatformStaffError } from './errors'

type Db = ReturnType<typeof getDb>

const Role = z.enum(PLATFORM_ROLES)
const InviteInput = z
  .object({
    /** Существующий пользователь: email или Telegram-имя. */
    user: z.string().trim().min(3).max(254),
    role: Role,
  })
  .strict()
const RoleInput = z.object({ role: Role }).strict()

const TELEGRAM_USERNAME = /^@?[A-Za-z0-9_]{3,64}$/
const ROLE_ORDER = sql`array_position(enum_range(NULL::platform_staff_role), ${platformStaff.role})`
const INVITER_NAME = sql<
  string | null
>`(SELECT u.name FROM ${users} u WHERE u.id = ${platformStaff.invitedBy})`

const memberColumns = {
  userId: platformStaff.userId,
  role: platformStaff.role,
  invitedById: platformStaff.invitedBy,
  invitedByName: INVITER_NAME,
  createdAt: platformStaff.createdAt,
  name: users.name,
  email: users.email,
  telegramUsername: users.telegramUsername,
}

interface MemberRow {
  userId: number
  role: PlatformRole
  invitedById: number | null
  invitedByName: string | null
  createdAt: Date
  name: string | null
  email: string | null
  telegramUsername: string | null
}

function toMember(r: MemberRow): PlatformStaffMember {
  return {
    userId: r.userId,
    name: r.name ?? '',
    email: r.email,
    telegramUsername: r.telegramUsername,
    role: r.role,
    invitedBy: r.invitedById === null ? null : { id: r.invitedById, name: r.invitedByName ?? '' },
    createdAt: r.createdAt.toISOString(),
  }
}

const notFound = () =>
  new PlatformStaffError('platform.staff_not_found', 'Человек не входит в команду платформы')

const lastOwner = () =>
  new PlatformStaffError(
    'platform.staff_last_owner',
    'Последнего Owner нельзя понизить или удалить: сначала назначьте другого Owner',
  )

async function readMember(db: Db, userId: number): Promise<PlatformStaffMember> {
  const [row] = await db
    .select(memberColumns)
    .from(platformStaff)
    .innerJoin(users, eq(users.id, platformStaff.userId))
    .where(eq(platformStaff.userId, userId))
  if (!row) throw notFound()
  return toMember(row)
}

/**
 * Owner-строки под блокировкой (по порядку id): решения «сколько осталось Owner» и проверка, что
 * автор всё ещё Owner, идут после неё. Два Owner, понижающие друг друга одновременно, выполняются
 * по очереди: второй видит, что сам уже не Owner, и получает 403 — Owner на платформе остаётся.
 */
async function lockOwners(db: Db, actorId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: platformStaff.userId })
    .from(platformStaff)
    .where(eq(platformStaff.role, 'owner'))
    .orderBy(asc(platformStaff.userId))
    .for('update')
  const owners = rows.map((r) => r.userId)
  if (!owners.includes(actorId)) throw new ForbiddenError(ROLE_DENIED_CODE, 'Нет доступа к разделу')
  return owners
}

async function lockStaff(db: Db, userId: number) {
  const [row] = await db
    .select({ userId: platformStaff.userId, role: platformStaff.role })
    .from(platformStaff)
    .where(eq(platformStaff.userId, userId))
    .for('update')
  if (!row) throw notFound()
  return row
}

/**
 * Совместимость с прежним runtime в окне отката (expand, 0048): флаг users.is_root_admin равен
 * роли owner. Новый код флаг не читает; колонка уходит отдельной миграцией следующего релиза.
 */
async function mirrorLegacyFlag(db: Db, userId: number, role: PlatformRole | null) {
  await db
    .update(users)
    .set({ isRootAdmin: role === 'owner' })
    .where(eq(users.id, userId))
}

/** Пользователь по email (регистр не важен) или Telegram-имени, под блокировкой строки. */
async function resolveUser(db: Db, raw: string): Promise<number> {
  const missing = () =>
    new PlatformStaffError('platform.staff_user_not_found', 'Пользователь не найден')
  const byTelegram = raw.startsWith('@') || !raw.includes('@')
  if (byTelegram && !TELEGRAM_USERNAME.test(raw)) throw missing()
  const needle = (byTelegram ? raw.replace(/^@/, '') : raw).toLowerCase()
  const column = byTelegram ? users.telegramUsername : users.email
  const found = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(sql`lower(${column}) = ${needle}`)
    .limit(2)
    .for('update')
  if (found.length === 0) throw missing()
  if (found.length > 1) {
    throw new PlatformStaffError(
      'platform.staff_user_ambiguous',
      'Под это имя подходит несколько пользователей: укажите email',
    )
  }
  if (!found[0]!.isActive) {
    throw new PlatformStaffError('platform.staff_user_inactive', 'Пользователь заблокирован')
  }
  return found[0]!.id
}

/**
 * Команда платформы (29.3.1, R-15, D-28): список, приглашение, смена роли и удаление — только
 * Owner (политика team). Одна роль на человека (первичный ключ — пользователь). Последнего Owner
 * нельзя понизить или удалить, в том числе самому себе. Смена роли действует со следующего запроса
 * (роль читается из базы на каждый запрос) и пишется в журнал: кто (автор записи), кому (entity),
 * было и стало (old/new value). Приглашается только существующий активный пользователь.
 */
export const platformStaffService = {
  /** Роль вошедшего и доступные ей политики — для меню по роли. Любой член команды. */
  async me(ctx: ServiceContext): Promise<PlatformStaffMe> {
    const role = await assertRootAdmin(ctx)
    const policies = (Object.keys(PLATFORM_POLICIES) as PlatformPolicy[]).filter((p) =>
      (PLATFORM_POLICIES[p] as readonly PlatformRole[]).includes(role),
    )
    return { userId: ctx.userId, role, policies }
  },

  async list(ctx: ServiceContext): Promise<PlatformStaffList> {
    await assertRootAdmin(ctx, 'team')
    const rows = await getDb(ctx)
      .select(memberColumns)
      .from(platformStaff)
      .innerJoin(users, eq(users.id, platformStaff.userId))
      .orderBy(ROLE_ORDER, asc(platformStaff.createdAt), asc(platformStaff.userId))
    return { members: rows.map(toMember) }
  },

  async invite(ctx: ServiceContext, input: unknown): Promise<PlatformStaffMember> {
    await assertRootAdmin(ctx, 'team')
    const data = InviteInput.parse(input ?? {})
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      await lockOwners(db, ctx.userId)
      const userId = await resolveUser(db, data.user)
      const [existing] = await db
        .select({ role: platformStaff.role })
        .from(platformStaff)
        .where(eq(platformStaff.userId, userId))
      if (existing) {
        throw new PlatformStaffError(
          'platform.staff_exists',
          'Пользователь уже в команде: измените его роль',
        )
      }
      await db.insert(platformStaff).values({ userId, role: data.role, invitedBy: ctx.userId })
      await mirrorLegacyFlag(db, userId, data.role)
      await auditService.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_INVITED,
        entityType: 'platform_staff',
        entityId: userId,
        oldValue: null,
        newValue: { role: data.role },
      })
      return readMember(db, userId)
    })
  },

  async changeRole(
    ctx: ServiceContext,
    userId: number,
    input: unknown,
  ): Promise<PlatformStaffMember> {
    await assertRootAdmin(ctx, 'team')
    const data = RoleInput.parse(input ?? {})
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const owners = await lockOwners(db, ctx.userId)
      const target = await lockStaff(db, userId)
      if (target.role === data.role) {
        throw new PlatformStaffError('platform.staff_same_role', 'У человека уже эта роль')
      }
      if (target.role === 'owner' && owners.length <= 1) throw lastOwner()
      await db
        .update(platformStaff)
        .set({ role: data.role, updatedAt: new Date() })
        .where(eq(platformStaff.userId, userId))
      await mirrorLegacyFlag(db, userId, data.role)
      await auditService.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_ROLE_CHANGED,
        entityType: 'platform_staff',
        entityId: userId,
        oldValue: { role: target.role },
        newValue: { role: data.role },
      })
      return readMember(db, userId)
    })
  },

  async remove(ctx: ServiceContext, userId: number): Promise<{ userId: number }> {
    await assertRootAdmin(ctx, 'team')
    return inTransaction(ctx, async (tx) => {
      const db = getDb(tx)
      const owners = await lockOwners(db, ctx.userId)
      const target = await lockStaff(db, userId)
      if (target.role === 'owner' && owners.length <= 1) throw lastOwner()
      await db
        .delete(platformStaff)
        .where(and(eq(platformStaff.userId, userId), eq(platformStaff.role, target.role)))
      await mirrorLegacyFlag(db, userId, null)
      await auditService.record(tx, {
        action: AUDIT_ACTIONS.PLATFORM_STAFF_REMOVED,
        entityType: 'platform_staff',
        entityId: userId,
        oldValue: { role: target.role },
        newValue: null,
      })
      return { userId }
    })
  },
}
