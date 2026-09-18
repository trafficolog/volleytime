/** Разбор orgId из pathname (без query/hash). Task 4.9.12. */
export type OrgPathResult = { kind: 'none' } | { kind: 'invalid' } | { kind: 'org'; orgId: number }

const ORG_URL_PATTERN = /^\/api\/organizations\/([^/]+)(?:\/|$)/

export function parseOrgIdFromPath(pathname: string): OrgPathResult {
  const m = pathname.match(ORG_URL_PATTERN)
  if (!m) return { kind: 'none' }
  const raw = m[1]!
  if (!/^\d+$/.test(raw)) return { kind: 'invalid' }
  const orgId = Number(raw)
  return orgId > 0 && Number.isSafeInteger(orgId) ? { kind: 'org', orgId } : { kind: 'invalid' }
}
