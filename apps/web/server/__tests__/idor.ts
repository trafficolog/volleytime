/**
 * Переиспользуемый IDOR-хелпер (Task 19.3.1).
 *
 * Контракт: каждый org-scoped роут `server/api/organizations/[orgId]/**` описан в таблице
 * `OrgRouteTable` с минимальной ролью из матрицы прав (docs/architecture/permissions-v3.md).
 * `assertRouteTableComplete` падает, если в файловой системе появился роут, которого нет в
 * таблице (или наоборот) — новый эндпоинт нельзя добавить без IDOR-покрытия.
 */
import { expect } from 'vitest'

import { listApiRoutes, type TestResponse } from './harness'

/** Минимальный уровень доступа роута (см. матрицу прав v3). */
export type OrgAccess =
  /** любая не снятая связь с группой, включая заявку (`pending`) */
  | 'tenant'
  /** активный участник (`requireOrgMember`) */
  | 'member'
  /** owner + organizer (`requireCanManageContent` / `requireCanManageMembers`) */
  | 'manager'
  /** только owner */
  | 'owner'

/** Идентификаторы ресурсов одной группы, которыми подставляются параметры пути. */
export interface OrgFixtureIds {
  orgId: number
  venueId: number
  eventId: number
  bookingId: number
  memberId: number
  paymentId: number
  planId: number
  inviteId: number
}

export interface OrgRouteCase {
  access: OrgAccess
  /** Валидное тело для своей группы: так 403/404 не маскируются ответом 422 валидации. */
  body?: (ids: OrgFixtureIds) => unknown
}

/** Ключ — `METHOD /api/organizations/:orgId/...` как его строит харнесс. */
export type OrgRouteTable = Record<string, OrgRouteCase>

export const ORG_ROUTE_PREFIX = '/api/organizations/:orgId'

export async function listOrgScopedRouteKeys(): Promise<string[]> {
  return (await listApiRoutes())
    .filter(({ route }) => route === ORG_ROUTE_PREFIX || route.startsWith(`${ORG_ROUTE_PREFIX}/`))
    .map(({ method, route }) => `${method.toUpperCase()} ${route}`)
    .sort()
}

export async function assertRouteTableComplete(table: OrgRouteTable): Promise<void> {
  expect(Object.keys(table).sort()).toEqual(await listOrgScopedRouteKeys())
}

export function splitRouteKey(key: string): { method: string; route: string } {
  const [method, route] = key.split(' ') as [string, string]
  return { method, route }
}

/**
 * Подставить параметры пути. `orgIds` — группа из префикса пути, `resourceIds` — группа,
 * чьи вложенные ресурсы (`:eventId`, `:memberId`, …) подставляются в путь.
 */
export function buildPath(
  route: string,
  orgIds: OrgFixtureIds,
  resourceIds: OrgFixtureIds = orgIds,
): string {
  return route.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const source = name === 'orgId' ? orgIds : resourceIds
    const value = source[name as keyof OrgFixtureIds]
    if (value === undefined) throw new Error(`No fixture id for route param :${name}`)
    return String(value)
  })
}

/** Отказ без раскрытия: 403 (нет права/не участник) или 404 (ресурс чужой или не найден). */
export function expectDenied(res: TestResponse, label: string, leakMarkers: string[] = []): void {
  expect([403, 404], `${label} → ${res.status} ${res.text.slice(0, 200)}`).toContain(res.status)
  for (const marker of leakMarkers) {
    expect(res.text, `${label} leaks ${marker}`).not.toContain(marker)
  }
}

export function hasRouteParams(route: string): boolean {
  return /:(?!orgId\b)[A-Za-z]+/.test(route)
}
