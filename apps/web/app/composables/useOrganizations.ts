import type { Organization } from '@volley-time/db'
import type { PlayerStats, PlayersStatsPeriod } from '@volley-time/shared'

export type OrganizationListItem = Organization & {
  membershipStatus: 'active' | 'pending'
  membershipRole: 'owner' | 'organizer' | 'assistant' | 'player'
}

/** Удалённая группа владельца (21.2.17): в общий список не входит, восстанавливается в окне. */
export interface DeletedOrganizationItem {
  id: number
  name: string
  deletedAt: string
  restoreUntil: string
  restorable: boolean
}

export function useOrganizations() {
  const orgs = useState<OrganizationListItem[]>('orgs.list', () => [])
  const deletedOrgs = useState<DeletedOrganizationItem[]>('orgs.deleted', () => [])
  const currentOrgId = useState<number | null>('orgs.current', () => null)
  const loading = useState<boolean>('orgs.loading', () => false)

  const currentOrg = computed(() => orgs.value.find((o) => o.id === currentOrgId.value) ?? null)

  async function fetchAll() {
    loading.value = true
    try {
      const data = await $fetch<{
        organizations: OrganizationListItem[]
        deletedOrganizations?: DeletedOrganizationItem[]
      }>('/api/organizations')
      orgs.value = data.organizations
      deletedOrgs.value = data.deletedOrganizations ?? []
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

  return { orgs, deletedOrgs, currentOrgId, currentOrg, loading, fetchAll, selectOrg, create }
}

export interface MemberRow {
  id: number
  organizationId: number
  role: 'owner' | 'organizer' | 'assistant' | 'player'
  status: 'pending' | 'active' | 'guest' | 'blocked' | 'left' | 'rejected'
  /** Код уровня В1–В4+ (`v1`…`v4_plus`) или null, если не назначен. */
  level: string | null
  /** Код амплуа (`setter`…`utility`, 21.2.22) или null/отсутствует, если не задано. */
  position?: string | null
  /** Агрегаты игрока (21.2.20): приходят только управляющему по `?stats=1`. */
  stats?: PlayerStats
  joinedAt: string | null
  createdAt: string
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
}

export function useMembers(orgId: Ref<number> | number) {
  const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
  const members = ref<MemberRow[]>([])
  /** Окно посещаемости ответа API (`stats`, 21.2.20); `null` без агрегатов. */
  const statsPeriod = ref<PlayersStatsPeriod | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** `options.stats` — агрегаты игроков (посещаемость, абонемент, долг); только управляющему. */
  async function fetch(
    statuses: MemberRow['status'][] = ['active'],
    options: { stats?: boolean } = {},
  ) {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<{ members: MemberRow[]; statsPeriod?: PlayersStatsPeriod }>(
        `/api/organizations/${orgIdRef.value}/members`,
        { query: { statuses: statuses.join(','), ...(options.stats ? { stats: '1' } : {}) } },
      )
      members.value = data.members
      statsPeriod.value = data.statsPeriod ?? null
    } catch (e) {
      error.value = apiErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  return { members, statsPeriod, loading, error, fetch }
}
