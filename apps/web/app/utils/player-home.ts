import type { EventListItem } from '../components/EventCard.vue'

const DENIED_ORG_ERRORS = new Set([
  'permission.blocked',
  'permission.not_member',
  'permission.no_longer_member',
])

export function isDeniedOrgError(code?: string) {
  return code !== undefined && DENIED_ORG_ERRORS.has(code)
}

export function playerAccessFromApiError(code?: string): 'pending' | 'suspended' | 'denied' | null {
  if (code === 'forbidden.pending_approval') return 'pending'
  if (code === 'organization.suspended') return 'suspended'
  if (isDeniedOrgError(code)) return 'denied'
  return null
}

export function playerHomeAccess(
  orgId: number,
  organization: { id: number; status: string } | null,
  member: { status: string } | null,
  errorCode?: string,
) {
  const errorAccess = playerAccessFromApiError(errorCode)
  if (errorAccess) return errorAccess
  if (!organization || organization.id !== orgId) return 'loading'
  if (organization.status === 'suspended') return 'suspended'
  if (member?.status === 'pending') return 'pending'
  return member?.status === 'active' ? 'active' : 'denied'
}

export function projectPlayerHome(upcoming: readonly EventListItem[], now: Date) {
  const events = upcoming
    .filter((event) => event.status === 'published' && new Date(event.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  return { hero: events[0] ?? null, schedule: events.slice(1) }
}
