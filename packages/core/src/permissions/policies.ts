import type { OrganizationMember } from '@volley-time/db'

import { ForbiddenError } from './errors'

export type Role = 'owner' | 'organizer' | 'assistant' | 'player'

/** Статусы, дающие участие в операциях организации (pending — только заявка, Task 4.9.7). */
const ACTIVE_STATUSES = ['active'] as const
/** Роли, управляющие контентом (события, оплаты). */
const MANAGER_ROLES = ['owner', 'organizer'] as const

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
 * - приглашать с ролью player — owner + organizer; с ролью organizer/assistant — только owner
 * - модерировать (approve/reject/block/unblock) — owner: любого не-owner; organizer: только player/assistant
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
  return target.role === 'player' || target.role === 'assistant'
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
