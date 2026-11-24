import type { OrganizationMember } from '@volley-time/db'

import { ForbiddenError } from './errors'

/** Роль на членстве в группе (30.1.1, P-18). Гость — не член группы, ролей нет. */
export type Role = 'owner' | 'organizer' | 'coach' | 'player'
/** Режим Mini App, который даёт роль (M-25): «Играю», «Управляю», «Веду». */
export type MemberMode = 'play' | 'manage' | 'coach'

/** Статусы, дающие участие в операциях организации (pending — только заявка, Task 4.9.7). */
const ACTIVE_STATUSES = ['active'] as const
/** Роли, управляющие контентом (события, оплаты). */
const MANAGER_ROLES = ['owner', 'organizer'] as const

// ─── Роли на членстве (30.1.1, P-18, ADR v3 «Роли на членстве») ─────

/**
 * Роль из строки членства: устаревшее `assistant` (его ещё может записать прежний runtime в окне
 * отката, D-31) читается как `coach`.
 */
export function normalizeRole(role: string): Role {
  return role === 'assistant' ? 'coach' : (role as Role)
}

/**
 * Роли участника в группе: роль членства и `player` — записываться как игрок могут все роли.
 * Управляющие роли взаимоисключающие, поэтому хранятся одной колонкой (ADR v3).
 */
export function memberRoles(member: Pick<OrganizationMember, 'role'>): Role[] {
  const role = normalizeRole(member.role)
  return role === 'player' ? ['player'] : [role, 'player']
}

/** Режимы Mini App: owner и organizer — «Играю · Управляю», coach — «Играю · Веду», игрок — без переключателя. */
export function memberModes(member: Pick<OrganizationMember, 'role'>): MemberMode[] {
  const role = normalizeRole(member.role)
  if (role === 'owner' || role === 'organizer') return ['play', 'manage']
  if (role === 'coach') return ['play', 'coach']
  return ['play']
}

/**
 * Режим «Играю» (M-25): управляющий или тренер получает те же ответы API, что обычный игрок.
 * Права считаются по копии членства с ролью `player` и без приёма оплаты.
 */
export function playModeMember<T extends OrganizationMember | null>(member: T): T {
  if (!member) return member
  return { ...member, role: 'player', canAcceptPayment: false }
}

/** Активный тренер группы (роль членства). */
export function isOrgCoach(member: OrganizationMember | null): boolean {
  return !!member && member.status === 'active' && normalizeRole(member.role) === 'coach'
}

/** Событие с назначенными тренерами (`events.coach_user_ids`). */
export interface CoachedEvent {
  coachUserIds: number[]
}

/**
 * Роль в группе ∪ роль на событии: управляющие видят состав любого события, тренер — только тех,
 * где он назначен. Игрок в списке тренеров (роль сменили после назначения) прав не получает.
 */
export function canCoachEvent(member: OrganizationMember | null, event: CoachedEvent): boolean {
  if (canManageContent(member)) return true
  return isOrgCoach(member) && event.coachUserIds.includes(member!.userId)
}

/** Суммы и статусы оплаты события: управляющие; тренер — с флагом `canAcceptPayment` и только своих событий. */
export function canSeeEventPayments(
  member: OrganizationMember | null,
  event: CoachedEvent,
): boolean {
  if (canManageContent(member)) return true
  return canCoachEvent(member, event) && member!.canAcceptPayment
}

/** Флаг «Принимает оплату» у тренера выдают владелец и организатор. */
export function canAssignAcceptPayment(member: OrganizationMember | null): boolean {
  return canManageMembers(member)
}

export function requireCanCoachEvent(member: OrganizationMember | null, event: CoachedEvent): void {
  if (!canCoachEvent(member, event)) {
    throw new ForbiddenError('forbidden.coach_event', 'Требуются права тренера этого события')
  }
}

// ─── Boolean-проверки (для UI) ──────────────────────────────────────

export function isOrgMember(member: OrganizationMember | null): boolean {
  if (!member) return false
  return (ACTIVE_STATUSES as readonly string[]).includes(member.status)
}

/** Заявка на вступление ожидает решения организатора. */
export function isOrgApplicant(member: OrganizationMember | null): boolean {
  return !!member && member.status === 'pending'
}

export function isOrgOwner(member: OrganizationMember | null): boolean {
  return !!member && member.role === 'owner' && member.status === 'active'
}

/** Управление контентом: события, оплаты, касса (owner + organizer). */
export function canManageContent(member: OrganizationMember | null): boolean {
  if (!member || member.status !== 'active') return false
  return (MANAGER_ROLES as readonly string[]).includes(member.role)
}

/** Управление участниками: приглашения, роли, блокировки (owner + organizer). */
export function canManageMembers(member: OrganizationMember | null): boolean {
  if (!member || member.status !== 'active') return false
  return (MANAGER_ROLES as readonly string[]).includes(member.role)
}

/** Просмотр списка участников (любой активный участник). */
export function canViewOrgMembers(member: OrganizationMember | null): boolean {
  return isOrgMember(member)
}

/** Настройки организации: только owner. */
export function canManageOrgSettings(member: OrganizationMember | null): boolean {
  return isOrgOwner(member)
}

// ─── require-версии (для API, бросают ForbiddenError) ───────────────

export function requireCanManageContent(member: OrganizationMember | null): void {
  if (!canManageContent(member)) {
    throw new ForbiddenError('forbidden.manage_content', 'Требуются права организатора')
  }
}

export function requireCanManageMembers(member: OrganizationMember | null): void {
  if (!canManageMembers(member)) {
    throw new ForbiddenError('forbidden.manage_members', 'Требуются права управления участниками')
  }
}

export function requireCanInvite(member: OrganizationMember | null): void {
  if (!canManageMembers(member)) {
    throw new ForbiddenError('forbidden.manage_members', 'Требуются права приглашать участников')
  }
}

/**
 * Матрица прав Phase 4 (ADR 2026-09-17, карточка 4.3.1, Task 4.9.6):
 * - приглашать с ролью player — owner + organizer; с ролью organizer/coach — только owner
 * - модерировать (approve/reject/block/unblock) — owner: любого не-owner; organizer: только player/coach
 * - менять роли, настройки, архив — только owner
 */
export function canInviteRole(member: OrganizationMember | null, role: string): boolean {
  if (!canManageMembers(member)) return false
  return role === 'player' ? true : isOrgOwner(member)
}

export function requireCanInviteRole(member: OrganizationMember | null, role: string): void {
  if (!canInviteRole(member, role)) {
    throw new ForbiddenError(
      'forbidden.invite_role',
      role === 'player'
        ? 'Требуются права приглашать участников'
        : 'Приглашать с ролью организатора может только владелец',
    )
  }
}

export function canModerate(
  actor: OrganizationMember | null,
  target: Pick<OrganizationMember, 'role' | 'userId'>,
): boolean {
  if (!canManageMembers(actor) || !actor) return false
  if (target.role === 'owner' || target.userId === actor.userId) return false
  if (actor.role === 'owner') return true
  const role = normalizeRole(target.role)
  return role === 'player' || role === 'coach'
}

export function requireCanModerate(
  actor: OrganizationMember | null,
  target: Pick<OrganizationMember, 'role' | 'userId'>,
): void {
  if (!canModerate(actor, target)) {
    throw new ForbiddenError(
      'forbidden.moderate',
      'Недостаточно прав для действия с этим участником',
    )
  }
}

/**
 * Исключить участника из группы без блокировки (21.2.21): владельца и себя исключить нельзя;
 * владелец исключает любого другого, организатор — только игрока (тренеров и организаторов — только владелец).
 */
export function canExclude(
  actor: OrganizationMember | null,
  target: Pick<OrganizationMember, 'role' | 'userId'>,
): boolean {
  if (!canManageMembers(actor) || !actor) return false
  if (target.role === 'owner' || target.userId === actor.userId) return false
  return actor.role === 'owner' || target.role === 'player'
}

export function requireCanExclude(
  actor: OrganizationMember | null,
  target: Pick<OrganizationMember, 'role' | 'userId'>,
): void {
  if (!canExclude(actor, target)) {
    throw new ForbiddenError(
      'forbidden.exclude',
      'Исключить администратора из группы может только владелец',
    )
  }
}

export function requireOrgOwner(member: OrganizationMember | null): void {
  if (!isOrgOwner(member)) {
    throw new ForbiddenError('forbidden.owner_only', 'Действие доступно только владельцу')
  }
}

export function requireOrgMember(member: OrganizationMember | null): void {
  if (isOrgApplicant(member)) {
    throw new ForbiddenError(
      'forbidden.pending_approval',
      'Заявка на вступление ещё не одобрена организатором',
    )
  }
  if (!isOrgMember(member)) {
    throw new ForbiddenError('forbidden.not_member', 'Вы не участник этой организации')
  }
}
