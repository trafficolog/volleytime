import type { EventListItem } from '../components/EventCard.vue'

export function playerHomeAccess(
  orgId: number,
  organization: { id: number; status: string } | null,
  member: { status: string } | null,
  errorCode?: string,
) {
  if (errorCode === 'organization.suspended') return 'suspended'
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
