import { and, asc, auditLog, desc, eq, inArray, organizationMembers, users } from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { getDb, type ServiceContext } from '../shared/context'

import type { MemberWithUser } from './service'

/** Исключённый игрок: участник в статусе `left` + кто, когда и почему исключил (21.2.24). */
export interface ExcludedMember extends MemberWithUser {
  excludedAt: Date
  excludedBy: { id: number; name: string | null; telegramUsername: string | null } | null
  reason: string | null
}

/**
 * Исключённые игроки группы без миграции (21.2.24): исключение и добровольный выход оба дают статус
 * `left`, различает их последняя запись аудита о переходе в `left` по этому участнику
 * (`member.excluded` против `member.left`). Вернувшийся и снова вышедший игрок определяется по
 * новой последней записи, поэтому добровольный выход после исключения снимает признак.
 * Заблокированные после исключения в список не входят (у них статус `blocked`).
 */
export async function listExcludedMembers(
  ctx: ServiceContext,
  orgId: number,
): Promise<ExcludedMember[]> {
  const db = getDb(ctx)
  const left = await db
    .select({
      id: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
      status: organizationMembers.status,
      level: organizationMembers.level,
      position: organizationMembers.position,
      joinedAt: organizationMembers.joinedAt,
      createdAt: organizationMembers.createdAt,
      userId: users.id,
      name: users.name,
      telegramUsername: users.telegramUsername,
      image: users.image,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.status, 'left')),
    )
    .orderBy(asc(organizationMembers.id))
  if (left.length === 0) return []

  const entries = await db
    .select({
      entityId: auditLog.entityId,
      action: auditLog.action,
      createdAt: auditLog.createdAt,
      actorId: auditLog.userId,
      newValue: auditLog.newValue,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.organizationId, orgId),
        eq(auditLog.entityType, 'member'),
        inArray(
          auditLog.entityId,
          left.map((m) => m.id),
        ),
        inArray(auditLog.action, [AUDIT_ACTIONS.MEMBER_EXCLUDED, AUDIT_ACTIONS.MEMBER_LEFT]),
      ),
    )
    .orderBy(desc(auditLog.id))
  const latest = new Map<number, (typeof entries)[number]>()
  for (const e of entries) if (!latest.has(e.entityId)) latest.set(e.entityId, e)

  const excluded = left.filter((m) => latest.get(m.id)?.action === AUDIT_ACTIONS.MEMBER_EXCLUDED)
  const actorIds = [...new Set(excluded.flatMap((m) => latest.get(m.id)!.actorId ?? []))]
  const actors =
    actorIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name, telegramUsername: users.telegramUsername })
          .from(users)
          .where(inArray(users.id, actorIds))
      : []
  const actorById = new Map(actors.map((a) => [a.id, a]))

  return excluded
    .map(({ userId, name, telegramUsername, image, ...m }) => {
      const e = latest.get(m.id)!
      const reason = (e.newValue as { reason?: unknown } | null)?.reason
      return {
        ...m,
        user: { id: userId, name, telegramUsername, image },
        excludedAt: e.createdAt,
        excludedBy: e.actorId === null ? null : (actorById.get(e.actorId) ?? null),
        reason: typeof reason === 'string' && reason !== '' ? reason : null,
      }
    })
    .sort((a, b) => b.excludedAt.getTime() - a.excludedAt.getTime() || b.id - a.id)
}
