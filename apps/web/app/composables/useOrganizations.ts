import type { Organization } from '@volley-time/db'

export type OrganizationListItem = Organization & {
  membershipStatus: 'active' | 'pending'
  membershipRole: 'owner' | 'organizer' | 'assistant' | 'player'
}

export function useOrganizations() {
  const orgs = useState<OrganizationListItem[]>('orgs.list', () => [])
  const currentOrgId = useState<number | null>('orgs.current', () => null)
  const loading = useState<boolean>('orgs.loading', () => false)

  const currentOrg = computed(() => orgs.value.find((o) => o.id === currentOrgId.value) ?? null)

  async function fetchAll() {
    loading.value = true
    try {
      const data = await $fetch<{ organizations: OrganizationListItem[] }>('/api/organizations')
      orgs.value = data.organizations
      const saved = import.meta.client ? localStorage.getItem('current_org_id') : null
      const savedId = saved ? Number(saved) : null
      if (savedId && orgs.value.some((o) => o.id === savedId)) {
        currentOrgId.value = savedId
      } else {
        currentOrgId.value = orgs.value[0]?.id ?? null
      }
    } finally {
      loading.value = false
    }
  }

  function selectOrg(id: number) {
    currentOrgId.value = id
    if (import.meta.client) localStorage.setItem('current_org_id', String(id))
  }

  async function create(input: { name: string; city?: string }) {
    const data = await $fetch<{ organization: Organization }>('/api/organizations', {
      method: 'POST',
      body: input,
    })
    orgs.value = [
      ...orgs.value,
      { ...data.organization, membershipStatus: 'active', membershipRole: 'owner' },
    ]
    selectOrg(data.organization.id)
    return data.organization
  }

  return { orgs, currentOrgId, currentOrg, loading, fetchAll, selectOrg, create }
}

export interface MemberRow {
  id: number
  organizationId: number
  role: 'owner' | 'organizer' | 'assistant' | 'player'
  status: 'pending' | 'active' | 'guest' | 'blocked' | 'left' | 'rejected'
  joinedAt: string | null
  createdAt: string
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
}

export function useMembers(orgId: Ref<number> | number) {
  const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
  const members = ref<MemberRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch(statuses: MemberRow['status'][] = ['active']) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<{ members: MemberRow[] }>(
        `/api/organizations/${orgIdRef.value}/members`,
        { query: { statuses: statuses.join(',') } },
      )
      members.value = data.members
    } catch (e) {
      error.value = apiErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  return { members, loading, error, fetch }
}
