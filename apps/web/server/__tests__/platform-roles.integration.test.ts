import { organizationService, platformEventBalanceGrantsService } from '@volley-time/core'
import {
  asc,
  auditLog,
  closeDb,
  db,
  eq,
  organizations,
  platformStaff,
  users,
} from '@volley-time/db'
import { grantPlatformRole } from '@volley-time/db/test-utils'
import {
  PLATFORM_POLICIES,
  PLATFORM_ROLES,
  type PlatformPolicy,
  type PlatformRole,
} from '@volley-time/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi, listApiRoutes } from './harness'

/**
 * Task 29.3.1 (R-15, D-28): каждый маршрут `/api/platform/**` проверяет роль команды платформы по
 * матрице. Таблица — политика маршрута (`PLATFORM_POLICIES`); новый маршрут без строки здесь
 * роняет первый тест, как `idor.integration.test` для групп.
 */
const ROUTES: Record<string, PlatformPolicy> = {
  'GET /api/platform/audit': 'audit',
  'GET /api/platform/event-balance/grants': 'balance',
  'POST /api/platform/event-balance/packages/:id/archive': 'plansManage',
  'POST /api/platform/event-balance/packages/:id/duplicate': 'plansManage',
  'PATCH /api/platform/event-balance/packages/:id': 'plansManage',
  'GET /api/platform/event-balance/packages/history': 'plans',
  'GET /api/platform/event-balance/packages': 'plans',
  'POST /api/platform/event-balance/packages': 'plansManage',
  'POST /api/platform/event-balance/purchase-requests/:id/approve': 'balanceManage',
  'POST /api/platform/event-balance/purchase-requests/:id/reject': 'balanceManage',
  'GET /api/platform/event-balance/purchase-requests/export': 'balance',
  'GET /api/platform/event-balance/purchase-requests': 'balance',
  'GET /api/platform/event-balance/purchase-requests/summary': 'balance',
  'GET /api/platform/feature-analytics': 'overview',
  'POST /api/platform/group-page-complaints/:id/reject': 'groupPageComplaintsReject',
  'POST /api/platform/group-page-complaints/:id/resolve': 'groupPageComplaintsResolve',
  'GET /api/platform/group-page-complaints': 'groupPageComplaints',
  'GET /api/platform/group-pages/:id/history': 'groupPages',
  'POST /api/platform/group-pages/:id/moderation': 'groupPagesModerate',
  'POST /api/platform/group-pages/:id/restore': 'groupPagesModerate',
  'GET /api/platform/group-pages/cities': 'groupPages',
  'GET /api/platform/group-pages': 'groupPages',
  'POST /api/platform/organizations/:id/event-balance-grants': 'balanceManage',
  'PUT /api/platform/organizations/:id/event-balance/unlimited': 'balanceManage',
  'POST /api/platform/organizations/:id/event-balance/unlimited/cancel': 'balanceManage',
  'GET /api/platform/organizations/:id': 'organizations',
  'GET /api/platform/organizations': 'organizations',
  'POST /api/platform/organizations': 'organizationsManage',
  'GET /api/platform/overview': 'overview',
  'GET /api/platform/settings/history': 'settings',
  'GET /api/platform/settings': 'settings',
  'PATCH /api/platform/settings': 'settings',
  'GET /api/platform/staff': 'team',
  'POST /api/platform/staff': 'team',
  'GET /api/platform/staff/me': 'self',
  'PATCH /api/platform/staff/:userId': 'team',
  'DELETE /api/platform/staff/:userId': 'team',
  'POST /api/platform/users/:id/block': 'usersManage',
  'GET /api/platform/users/:id': 'users',
  'POST /api/platform/users/:id/unblock': 'usersManage',
  'GET /api/platform/users': 'users',
}
const ENTRIES = Object.entries(ROUTES)
/** Несуществующий ресурс: разрешённая роль получает 404/422, а не 403, и ничего не меняет. */
const MISSING = 2_147_483_000
const PII_EMAIL = 'pii-owner@vt.test'
const PII_TG = 'pii_owner_tg'
const ROOT_EMAIL = 'pii-root@vt.test'

const split = (key: string) => {
  const [method, route] = key.split(' ') as [string, string]
  return { method, path: route.replace(/:[A-Za-z]+/g, String(MISSING)) }
}
const allowed = (role: PlatformRole, policy: PlatformPolicy) =>
  (PLATFORM_POLICIES[policy] as readonly PlatformRole[]).includes(role)
const codeOf = (body: unknown) => (body as { data?: { code?: string } }).data?.code

describe('platform roles: every /api/platform route follows the R-15 matrix (29.3.1)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  const staff = {} as Record<PlatformRole, number>
  let outsider: number
  let orgOwner: number
  let orgId: number

  const snapshot = async () =>
    JSON.stringify(
      await Promise.all([
        db.select().from(platformStaff).orderBy(asc(platformStaff.userId)),
        db.select().from(users).orderBy(asc(users.id)),
        db.select().from(organizations).orderBy(asc(organizations.id)),
        db.select().from(auditLog).orderBy(asc(auditLog.id)),
      ]),
    )

  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(organizations)
    await db.delete(users)
    for (const role of PLATFORM_ROLES) {
      const [u] = await db
        .insert(users)
        .values({
          name: `Staff ${role}`,
          email: role === 'owner' ? ROOT_EMAIL : `${role}@vt.test`,
          telegramUsername: `${role}_staff_tg`,
        })
        .returning()
      staff[role] = u!.id
      await grantPlatformRole(u!.id, role)
    }
    const [o, x] = await db
      .insert(users)
      .values([
        { name: 'PII Owner', email: PII_EMAIL, telegramUsername: PII_TG, phone: '+375291112233' },
        { name: 'Outsider', email: 'outsider@vt.test' },
      ])
      .returning()
    orgOwner = o!.id
    outsider = x!.id
    orgId = (await organizationService.create({ userId: orgOwner }, { name: 'PII Org' })).id
    await platformEventBalanceGrantsService.grant(
      { userId: staff.owner },
      {
        organizationId: orgId,
        units: 3,
        comment: 'Компенсация за сбой',
        idempotencyKey: crypto.randomUUID(),
      },
    )
  }, 60_000)

  afterAll(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('every route under /api/platform is in the role table', async () => {
    const actual = (await listApiRoutes())
      .filter(({ route }) => route.startsWith('/api/platform/'))
      .map(({ method, route }) => `${method.toUpperCase()} ${route}`)
      .sort()
    expect(Object.keys(ROUTES).sort()).toEqual(actual)
  })

  it.each(ENTRIES)('%s: anonymous 401, outsider forbidden.root_only', async (key) => {
    const { method, path } = split(key)
    const before = await snapshot()
    const body = method === 'GET' ? undefined : {}
    expect((await request(method, path, { body })).status).toBe(401)
    for (const user of [outsider, orgOwner]) {
      const res = await request(method, path, { user, body })
      expect(res.status, `${key} as ${user}`).toBe(403)
      expect(codeOf(res.body)).toBe('forbidden.root_only')
    }
    expect(await snapshot()).toBe(before)
  })

  it.each(ENTRIES)(
    '%s: roles outside the policy get 403, roles inside pass',
    async (key, policy) => {
      const { method, path } = split(key)
      const before = await snapshot()
      for (const role of PLATFORM_ROLES) {
        const res = await request(method, path, {
          user: staff[role],
          body: method === 'GET' ? undefined : {},
        })
        if (allowed(role, policy)) {
          expect(res.status, `${key} as ${role}: ${res.text.slice(0, 200)}`).not.toBe(403)
        } else {
          expect(res.status, `${key} as ${role}`).toBe(403)
          expect(codeOf(res.body), `${key} as ${role}`).toBe('forbidden.platform_role')
        }
      }
      // разрешённые роли бьют в несуществующий ресурс или пустое тело: данные не меняются
      if (method === 'GET') expect(await snapshot()).toBe(before)
    },
  )

  it('Support cannot hide a group page, set noindex or grant balance (403, nothing changes)', async () => {
    const before = await snapshot()
    for (const state of ['hidden', 'noindex']) {
      const res = await request('POST', `/api/platform/group-pages/${orgId}/moderation`, {
        user: staff.support,
        body: { state, reasonCode: 'spam' },
      })
      expect(res.status).toBe(403)
    }
    const grant = await request(
      'POST',
      `/api/platform/organizations/${orgId}/event-balance-grants`,
      {
        user: staff.support,
        body: { units: 5, comment: 'Компенсация за сбой', idempotencyKey: crypto.randomUUID() },
      },
    )
    expect(grant.status).toBe(403)
    expect(await snapshot()).toBe(before)
  })

  it('Analyst gets no user contacts in any response it can read', async () => {
    const reads = ENTRIES.filter(([key, p]) => key.startsWith('GET ') && allowed('analyst', p))
    expect(reads.length).toBeGreaterThan(5)
    const paths = reads.map(([key]) =>
      key.replace('GET ', '').replace(':id', String(orgId)).replace(':userId', String(orgOwner)),
    )
    const markers = [PII_EMAIL, PII_TG, ROOT_EMAIL, 'owner_staff_tg', '+375291112233', '@vt.test']
    for (const path of paths) {
      const res = await request('GET', path, { user: staff.analyst })
      expect(res.status, `${path}: ${res.text.slice(0, 200)}`).toBe(200)
      for (const marker of markers)
        expect(res.text, `${path} leaks ${marker}`).not.toContain(marker)
    }
    // те же ответы для Finance содержат контакты: маскирование — по роли, а не потеря данных
    const org = await request('GET', `/api/platform/organizations/${orgId}`, {
      user: staff.finance,
    })
    expect(org.text).toContain(PII_EMAIL)
    const grants = await request('GET', '/api/platform/event-balance/grants', {
      user: staff.finance,
    })
    expect(grants.text).toContain(ROOT_EMAIL)
  })

  it('Analyst cannot find an organization by the owner email or Telegram; others can', async () => {
    const found = async (role: PlatformRole, q: string) => {
      const res = await request('GET', `/api/platform/organizations?q=${encodeURIComponent(q)}`, {
        user: staff[role],
      })
      expect(res.status).toBe(200)
      return (res.body as { items: { id: number }[] }).items.map((o) => o.id)
    }
    for (const q of [PII_EMAIL, PII_TG, 'pii-owner']) {
      expect(await found('analyst', q), `analyst q=${q}`).toEqual([])
      for (const role of ['owner', 'admin'] as const)
        expect(await found(role, q), `${role} q=${q}`).toEqual([orgId])
    }
    // поиск по названию Analyst сохраняет
    expect(await found('analyst', 'PII Org')).toEqual([orgId])
  })

  it('Owner manages the team over HTTP; a role change applies on the next request', async () => {
    const invited = await request('POST', '/api/platform/staff', {
      user: staff.owner,
      body: { user: 'outsider@vt.test', role: 'support' },
    })
    expect(invited.status).toBe(201)
    expect(invited.body).toMatchObject({ userId: outsider, role: 'support' })
    expect((await request('GET', '/api/platform/group-pages', { user: outsider })).status).toBe(200)
    expect((await request('GET', '/api/platform/settings', { user: outsider })).status).toBe(403)

    const changed = await request('PATCH', `/api/platform/staff/${outsider}`, {
      user: staff.owner,
      body: { role: 'admin' },
    })
    expect(changed.status).toBe(200)
    expect((await request('GET', '/api/platform/settings', { user: outsider })).status).toBe(200)
    const me = await request('GET', '/api/platform/staff/me', { user: outsider })
    expect(me.body).toMatchObject({ userId: outsider, role: 'admin' })

    const last = await request('DELETE', `/api/platform/staff/${staff.owner}`, {
      user: staff.owner,
    })
    expect(last.status).toBe(409)
    expect(codeOf(last.body)).toBe('platform.staff_last_owner')
    const demote = await request('PATCH', `/api/platform/staff/${staff.owner}`, {
      user: staff.owner,
      body: { role: 'admin' },
    })
    expect(codeOf(demote.body)).toBe('platform.staff_last_owner')

    const removed = await request('DELETE', `/api/platform/staff/${outsider}`, {
      user: staff.owner,
    })
    expect(removed.status).toBe(200)
    const gone = await request('GET', '/api/platform/overview', { user: outsider })
    expect(gone.status).toBe(403)
    expect(codeOf(gone.body)).toBe('forbidden.root_only')

    const list = await request('GET', '/api/platform/staff', { user: staff.owner })
    expect((list.body as { members: unknown[] }).members).toHaveLength(PLATFORM_ROLES.length)
    const audit = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityType, 'platform_staff'))
      .orderBy(asc(auditLog.id))
    expect(audit.map((a) => a.action)).toEqual([
      'platform.staff.invited',
      'platform.staff.role_changed',
      'platform.staff.removed',
    ])
  })

  it('IDOR: an Admin cannot change or remove team members, including the Owner', async () => {
    const before = await snapshot()
    for (const [method, body] of [
      ['PATCH', { role: 'analyst' }],
      ['DELETE', undefined],
    ] as const) {
      for (const target of [staff.owner, staff.support, staff.admin]) {
        const res = await request(method, `/api/platform/staff/${target}`, {
          user: staff.admin,
          body,
        })
        expect(res.status).toBe(403)
      }
    }
    const invite = await request('POST', '/api/platform/staff', {
      user: staff.admin,
      body: { user: 'outsider@vt.test', role: 'owner' },
    })
    expect(invite.status).toBe(403)
    expect(await snapshot()).toBe(before)
  })
})
