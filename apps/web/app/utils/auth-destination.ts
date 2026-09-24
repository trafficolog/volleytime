import type { OrganizationListItem } from '../composables/useOrganizations'

export type AuthOrg = Pick<
  OrganizationListItem,
  'id' | 'name' | 'status' | 'membershipRole' | 'membershipStatus'
>

export type OrganizerEntry =
  | { kind: 'none' }
  | { kind: 'open'; org: AuthOrg }
  | { kind: 'blocked'; org: AuthOrg }
  | { kind: 'choose'; orgs: AuthOrg[] }

export function resolveOrganizerEntry(orgs: readonly AuthOrg[]): OrganizerEntry {
  const eligible = orgs.filter(
    (org) =>
      org.membershipStatus === 'active' &&
      (org.membershipRole === 'owner' || org.membershipRole === 'organizer') &&
      org.status !== 'archived',
  )
  if (eligible.length === 0) return { kind: 'none' }
  if (eligible.length > 1) return { kind: 'choose', orgs: eligible }
  const only = eligible[0]!
  return only.status === 'suspended' ? { kind: 'blocked', org: only } : { kind: 'open', org: only }
}

export function safeAuthRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/m/')) return null
  try {
    let decoded = value
    for (let i = 0; i < 3; i++) {
      decoded = decodeURIComponent(decoded)
      if (
        !decoded.startsWith('/m/') ||
        decoded.includes('\\') ||
        decoded.includes('//') ||
        /[\u0000-\u001f\u007f]/.test(decoded)
      )
        return null
    }
    return value
  } catch {
    return null
  }
}
