import { parseInviteInput } from '@volley-time/shared'

export function playerGroupsEmpty(groups: readonly unknown[]) {
  return { empty: groups.length === 0, invite: true, create: true }
}

export function playerGroupEntry(group: { id: number; status: string; membershipStatus: string }) {
  const selectable = group.status === 'active' && group.membershipStatus === 'active'
  return {
    to: `/m/orgs/${group.id}`,
    selectable,
    label:
      group.status === 'suspended'
        ? 'Группа приостановлена'
        : group.membershipStatus === 'pending'
          ? 'Заявка на рассмотрении'
          : selectable
            ? null
            : 'Группа недоступна',
  }
}

export function inviteDestination(input: string) {
  const token = parseInviteInput(input)
  return token ? `/m/invite/${encodeURIComponent(token)}` : null
}

export function inviteScreenState(
  token: string,
  preview: {
    status: string
    organization?: { id: number }
    myMembership?: { status: string } | null
  } | null,
  joined: { token: string; status: 'active' | 'pending' } | null,
): 'invite' | 'member' | 'applied' | 'invalid' | 'blocked' {
  if (preview?.myMembership?.status === 'blocked') return 'blocked'
  if (preview?.myMembership?.status === 'active') return 'member'
  if (preview?.myMembership?.status === 'pending') return 'applied'
  if (joined?.token === token && joined.status === 'pending') return 'applied'
  if (!preview || preview.status !== 'valid' || !preview.organization) return 'invalid'
  return 'invite'
}
