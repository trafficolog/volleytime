type DesktopOrg = { id: number; status: string } | null
type DesktopMember = { role: string; status: string } | null

export type DesktopOrgAccess = 'ready' | 'login' | 'denied' | 'suspended' | 'archived' | 'error'

export function shouldShowDesktopOrgLoading(
  pending: boolean,
  loadedOrgId: number | null,
  requestedId: number,
): boolean {
  return pending || (loadedOrgId !== null && loadedOrgId !== requestedId)
}

export function resolveDesktopOrgAccess(
  org: DesktopOrg,
  member: DesktopMember,
  requestedId: number,
  errorStatus?: number,
  errorCode?: string,
): DesktopOrgAccess {
  if (errorStatus === 401) return 'login'
  if (errorStatus === 410 && errorCode === 'organization.archived') return 'archived'
  if (errorStatus === 403 && errorCode === 'organization.suspended') return 'suspended'
  if (errorStatus === 403 || errorStatus === 404) return 'denied'
  if (errorStatus) return 'error'
  if (!org) return 'error'
  if (org.id !== requestedId || !member) return 'denied'
  if (org.status === 'archived') return 'archived'
  if (org.status === 'suspended') return 'suspended'
  if (org.status !== 'active') return 'denied'
  if (member.status !== 'active') return 'denied'
  return member.role === 'owner' || member.role === 'organizer' ? 'ready' : 'denied'
}

export function desktopNavItems(orgId: number, subscriptionsEnabled: boolean) {
  const base = `/app/orgs/${orgId}`
  return [
    { key: 'overview', label: 'Обзор', to: base },
    { key: 'events', label: 'События', to: `${base}/events` },
    { key: 'members', label: 'Игроки', to: `${base}/members` },
    ...(subscriptionsEnabled ? [{ key: 'plans', label: 'Абонементы', to: `${base}/plans` }] : []),
    { key: 'payments', label: 'Оплаты', to: `${base}/payments` },
    { key: 'cashbox', label: 'Касса', to: `${base}/cashbox` },
    { key: 'settings', label: 'Настройки', to: `${base}/settings` },
  ]
}

export function isLiveDesktopRoute(currentPath: string, expectedPath: string): boolean {
  return currentPath === expectedPath
}

export function desktopSignInPath(path: string): string {
  return path === '/app' || path === '/app?choose=1' || path.startsWith('/app/')
    ? `/auth/login?redirect=${encodeURIComponent(path)}`
    : '/auth/login'
}
