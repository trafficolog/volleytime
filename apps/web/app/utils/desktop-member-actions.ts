type Actor = {
  /** `assistant` — устаревшее имя `coach` (30.1.1, D-31); API отдаёт `coach`. */
  role: 'owner' | 'organizer' | 'coach' | 'player' | 'assistant'
  status: string
  userId: number
}

type Target = {
  role: 'owner' | 'organizer' | 'coach' | 'player'
  status: string
  userId: number
}

export type DesktopMemberAction = 'approve' | 'reject' | 'block' | 'unblock' | 'changeRole'

/** UI mirror of the API's canModerate and owner-only role policy. */
export function desktopMemberActions(actor: Actor | null, target: Target): DesktopMemberAction[] {
  if (!actor || actor.status !== 'active') return []
  if (actor.role !== 'owner' && actor.role !== 'organizer') return []
  if (target.role === 'owner' || target.userId === actor.userId) return []
  if (actor.role === 'organizer' && target.role !== 'player' && target.role !== 'coach') return []

  const actions: DesktopMemberAction[] = []
  if (target.status === 'pending') actions.push('approve', 'reject', 'block')
  if (target.status === 'active' || target.status === 'guest') actions.push('block')
  if (target.status === 'blocked') actions.push('unblock')
  if (actor.role === 'owner' && ['active', 'pending', 'blocked'].includes(target.status)) {
    actions.push('changeRole')
  }
  return actions
}

/**
 * UI mirror of the API's canExclude (21.2.21): «Удалить из группы» без блокировки. Владельца и себя
 * исключить нельзя; организатор исключает только игроков, тренеров и организаторов — владелец.
 * Исключается действующий участник (активный или гость); заблокированный остаётся заблокированным.
 */
export function canExcludeMember(actor: Actor | null, target: Target): boolean {
  if (!actor || actor.status !== 'active') return false
  if (actor.role !== 'owner' && actor.role !== 'organizer') return false
  if (target.role === 'owner' || target.userId === actor.userId) return false
  if (target.status !== 'active' && target.status !== 'guest') return false
  return actor.role === 'owner' || target.role === 'player'
}

/**
 * UI mirror of the API's block-from-`left` rule (21.2.24): заблокировать исключённого игрока.
 * Владельца и себя нельзя; организаторов и тренеров блокирует только владелец, организатор — игроков.
 */
export function canBlockExcludedMember(actor: Actor | null, target: Target): boolean {
  if (!actor || actor.status !== 'active') return false
  if (actor.role !== 'owner' && actor.role !== 'organizer') return false
  if (target.role === 'owner' || target.userId === actor.userId) return false
  if (target.status !== 'left') return false
  return actor.role === 'owner' || target.role === 'player'
}
