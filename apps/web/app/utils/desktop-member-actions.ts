type Actor = {
  role: 'owner' | 'organizer' | 'assistant' | 'player'
  status: string
  userId: number
}

type Target = {
  role: Actor['role']
  status: string
  userId: number
}

export type DesktopMemberAction = 'approve' | 'reject' | 'block' | 'unblock' | 'changeRole'

/** UI mirror of the API's canModerate and owner-only role policy. */
export function desktopMemberActions(actor: Actor | null, target: Target): DesktopMemberAction[] {
  if (!actor || actor.status !== 'active') return []
  if (actor.role !== 'owner' && actor.role !== 'organizer') return []
  if (target.role === 'owner' || target.userId === actor.userId) return []
  if (actor.role === 'organizer' && target.role !== 'player' && target.role !== 'assistant')
    return []

  const actions: DesktopMemberAction[] = []
  if (target.status === 'pending') actions.push('approve', 'reject', 'block')
  if (target.status === 'active' || target.status === 'guest') actions.push('block')
  if (target.status === 'blocked') actions.push('unblock')
  if (actor.role === 'owner' && ['active', 'pending', 'blocked'].includes(target.status)) {
    actions.push('changeRole')
  }
  return actions
}
