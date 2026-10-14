import {
  bookingService,
  eventService,
  inviteService,
  memberService,
  organizationService,
  planService,
  venueService,
} from '@volley-time/core'
import {
  asc,
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  eventBalancePurchaseRequests,
  events,
  inviteLinks,
  ledgerEntries,
  organizationEventBalances,
  organizationMembers,
  organizations,
  payments,
  subscriptionPlans,
  subscriptions,
  users,
  venues,
} from '@volley-time/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'
import {
  assertRouteTableComplete,
  buildPath,
  expectDenied,
  hasRouteParams,
  splitRouteKey,
  type OrgFixtureIds,
  type OrgRouteTable,
} from './idor'

/**
 * Task 19.3.1: IDOR-контракт для всех org-scoped эндпоинтов.
 * Таблица = минимальная роль из docs/architecture/permissions-v3.md. Новый роут в
 * server/api/organizations/[orgId]/** без строки здесь роняет первый тест.
 */
const ROUTES: OrgRouteTable = {
  'GET /api/organizations/:orgId': { access: 'tenant' },
  'PATCH /api/organizations/:orgId': { access: 'owner', body: () => ({ name: 'Renamed' }) },
  'POST /api/organizations/:orgId/archive': { access: 'owner', body: () => ({}) },
  'GET /api/organizations/:orgId/audit': { access: 'manager' },
  'POST /api/organizations/:orgId/bookings/:bookingId/cancel': {
    access: 'member',
    body: () => ({}),
  },
  'GET /api/organizations/:orgId/bookings/my': { access: 'member' },
  'GET /api/organizations/:orgId/dashboard': { access: 'member' },
  'GET /api/organizations/:orgId/event-balance': { access: 'manager' },
  'GET /api/organizations/:orgId/event-balance/entries': { access: 'manager' },
  'POST /api/organizations/:orgId/event-balance/purchase-requests': {
    access: 'owner',
    body: () => ({ packageCode: 'events_10' }),
  },
  'POST /api/organizations/:orgId/events/:eventId/attendance': {
    access: 'manager',
    body: (ids) => ({ marks: [{ bookingId: ids.bookingId, attended: true }] }),
  },
  'GET /api/organizations/:orgId/events/:eventId/bookings': { access: 'manager' },
  'POST /api/organizations/:orgId/events/:eventId/bookings': {
    access: 'member',
    body: () => ({ method: 'cash' }),
  },
  'POST /api/organizations/:orgId/events/:eventId/cancel': { access: 'manager', body: () => ({}) },
  'GET /api/organizations/:orgId/events/:eventId': { access: 'member' },
  'PATCH /api/organizations/:orgId/events/:eventId': {
    access: 'manager',
    body: () => ({ title: 'Renamed event' }),
  },
  'POST /api/organizations/:orgId/events/:eventId/settle': { access: 'manager', body: () => ({}) },
  'GET /api/organizations/:orgId/events': { access: 'member' },
  'POST /api/organizations/:orgId/events': {
    access: 'manager',
    body: () => ({
      title: 'New',
      startsAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 50 * 3600_000).toISOString(),
      capacity: 10,
      price: 0,
    }),
  },
  'GET /api/organizations/:orgId/invites': { access: 'manager' },
  'POST /api/organizations/:orgId/invites': { access: 'manager', body: () => ({}) },
  'POST /api/organizations/:orgId/invites/:inviteId/revoke': {
    access: 'manager',
    body: () => ({}),
  },
  'POST /api/organizations/:orgId/ledger/expense': {
    access: 'manager',
    body: () => ({ category: 'rent', amount: 1000 }),
  },
  'POST /api/organizations/:orgId/ledger/income': {
    access: 'manager',
    body: () => ({ category: 'donation', amount: 1000 }),
  },
  'GET /api/organizations/:orgId/ledger': { access: 'manager' },
  'POST /api/organizations/:orgId/members/:memberId/approve': {
    access: 'manager',
    body: () => ({}),
  },
  'POST /api/organizations/:orgId/members/:memberId/block': { access: 'manager', body: () => ({}) },
  'PATCH /api/organizations/:orgId/members/:memberId': {
    access: 'owner',
    body: () => ({ role: 'assistant' }),
  },
  'POST /api/organizations/:orgId/members/:memberId/reject': {
    access: 'manager',
    body: () => ({}),
  },
  'POST /api/organizations/:orgId/members/:memberId/unblock': {
    access: 'manager',
    body: () => ({}),
  },
  'PATCH /api/organizations/:orgId/members/:memberId/level': {
    access: 'manager',
    body: () => ({ level: 'v2' }),
  },
  'GET /api/organizations/:orgId/members': { access: 'member' },
  'POST /api/organizations/:orgId/members/leave': { access: 'tenant', body: () => ({}) },
  'POST /api/organizations/:orgId/payments/:paymentId/confirm': {
    access: 'manager',
    body: () => ({}),
  },
  'POST /api/organizations/:orgId/payments/:paymentId/reject': {
    access: 'manager',
    body: () => ({}),
  },
  'GET /api/organizations/:orgId/payments/history': { access: 'manager' },
  'GET /api/organizations/:orgId/payments': { access: 'manager' },
  'POST /api/organizations/:orgId/plans/:planId/archive': { access: 'manager', body: () => ({}) },
  'PATCH /api/organizations/:orgId/plans/:planId': {
    access: 'manager',
    body: () => ({ name: 'Renamed plan' }),
  },
  'GET /api/organizations/:orgId/plans': { access: 'member' },
  'POST /api/organizations/:orgId/plans': {
    access: 'manager',
    body: () => ({ name: 'P-4', totalSessions: 4, price: 4000 }),
  },
  'GET /api/organizations/:orgId/settings': { access: 'manager' },
  'PATCH /api/organizations/:orgId/settings': {
    access: 'owner',
    body: () => ({ maxSeatsPerBooking: 2 }),
  },
  'POST /api/organizations/:orgId/subscriptions': {
    access: 'member',
    body: (ids) => ({ planId: ids.planId, method: 'cash' }),
  },
  'GET /api/organizations/:orgId/subscriptions/my': { access: 'member' },
  'GET /api/organizations/:orgId/venues': { access: 'member' },
  'POST /api/organizations/:orgId/venues': { access: 'manager', body: () => ({ name: 'Зал 2' }) },
}

interface OrgFixture {
  ids: OrgFixtureIds
  owner: number
  organizer: number
  assistant: number
  player: number
  applicant: number
  marker: string
}

const ENTRIES = Object.entries(ROUTES)

describe('IDOR: org-scoped API contract (19.3.1)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let A: OrgFixture
  let B: OrgFixture
  let root: number

  const newUser = async (name: string, extra: Partial<typeof users.$inferInsert> = {}) =>
    (
      await db
        .insert(users)
        .values({ email: `${name}-${Math.random()}@idor.test`, name, ...extra })
        .returning()
    )[0]!.id

  async function makeOrg(label: string): Promise<OrgFixture> {
    const marker = `secret-${label}-${Math.random().toString(36).slice(2, 8)}`
    const owner = await newUser(`owner${label}`)
    const organizer = await newUser(`organizer${label}`)
    const assistant = await newUser(`assistant${label}`)
    const player = await newUser(`player${label}`)
    const applicant = await newUser(`applicant${label}`)
    const org = await organizationService.create({ userId: owner }, { name: `Org ${label}` })
    const add = (userId: number, extra: Record<string, unknown> = {}) =>
      memberService.add({ userId: owner }, { organizationId: org.id, userId, ...extra })
    await add(organizer, { role: 'organizer' })
    await add(assistant, { role: 'assistant' })
    const playerMember = await add(player)
    await add(applicant, { status: 'pending' })
    const venue = await venueService.create(
      { userId: owner },
      { organizationId: org.id, name: `Зал ${marker}` },
    )
    const ev = await eventService.create({ userId: owner }, org.id, {
      title: `Игра ${marker}`,
      venueId: venue.id,
      startsAt: new Date(Date.now() + 24 * 3600_000),
      endsAt: new Date(Date.now() + 26 * 3600_000),
      capacity: 10,
      price: 1500,
    })
    const booking = await bookingService.book({ userId: player }, org.id, ev.id, {
      method: 'cash',
    })
    const plan = await planService.create(
      { userId: owner },
      { organizationId: org.id, name: `План ${marker}`, totalSessions: 8, price: 8000 },
    )
    const invite = await inviteService.create({ userId: owner }, { organizationId: org.id })
    return {
      ids: {
        orgId: org.id,
        venueId: venue.id,
        eventId: ev.id,
        bookingId: booking.id,
        memberId: playerMember.id,
        paymentId: booking.paymentId!,
        planId: plan.id,
        inviteId: invite.id,
      },
      owner,
      organizer,
      assistant,
      player,
      applicant,
      marker,
    }
  }

  /**
   * Состояние всех строк группы, всего журнала и всех пользователей — чтобы доказать, что
   * отказ ничего не изменил (ни в группе, ни в аудите, ни в профилях).
   */
  async function snapshot(orgId: number): Promise<string> {
    const rows = await Promise.all([
      db.select().from(organizations).where(eq(organizations.id, orgId)),
      db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, orgId)),
      db.select().from(venues).where(eq(venues.organizationId, orgId)),
      db.select().from(events).where(eq(events.organizationId, orgId)),
      db.select().from(bookings).where(eq(bookings.organizationId, orgId)),
      db.select().from(payments).where(eq(payments.organizationId, orgId)),
      db.select().from(subscriptionPlans).where(eq(subscriptionPlans.organizationId, orgId)),
      db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)),
      db.select().from(inviteLinks).where(eq(inviteLinks.organizationId, orgId)),
      db.select().from(ledgerEntries).where(eq(ledgerEntries.organizationId, orgId)),
      db
        .select()
        .from(organizationEventBalances)
        .where(eq(organizationEventBalances.organizationId, orgId)),
      db.select().from(eventBalanceEntries).where(eq(eventBalanceEntries.organizationId, orgId)),
      db
        .select()
        .from(eventBalancePurchaseRequests)
        .where(eq(eventBalancePurchaseRequests.organizationId, orgId)),
      db.select().from(auditLog).orderBy(asc(auditLog.id)),
      db.select().from(users).orderBy(asc(users.id)),
    ])
    return JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  }

  // Фикстуры общие для файла: каждый тест доказывает снимком, что отказ ничего не изменил.
  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(organizations)
    await db.delete(users)
    A = await makeOrg('A')
    B = await makeOrg('B')
    root = await newUser('root', { isRootAdmin: true })
  }, 60_000)

  it('every route under organizations/[orgId] is in the IDOR table', async () => {
    await assertRouteTableComplete(ROUTES)
  })

  it.each(ENTRIES)(
    '%s: member of another group (any role) gets 403 and nothing changes',
    async (key, spec) => {
      const { method, route } = splitRouteKey(key)
      const before = await snapshot(A.ids.orgId)
      for (const user of [B.owner, B.organizer, B.player, root]) {
        const res = await request(method, buildPath(route, A.ids), {
          user,
          body: spec.body?.(A.ids),
        })
        expect(res.status, `${key} as outsider ${user}`).toBe(403)
        expect((res.body as { data?: { code?: string } }).data?.code).toBe('permission.not_member')
        expect(res.text).not.toContain(A.marker)
      }
      expect(await snapshot(A.ids.orgId)).toBe(before)
    },
  )

  it.each(ENTRIES.filter(([key]) => hasRouteParams(splitRouteKey(key).route)))(
    '%s: own-group path with another group resource id → 403/404, other group untouched',
    async (key, spec) => {
      const { method, route } = splitRouteKey(key)
      const before = await snapshot(B.ids.orgId)
      // owner — максимальная роль в своей группе: если он не достаёт чужой ресурс, не достанет никто
      const res = await request(method, buildPath(route, A.ids, B.ids), {
        user: A.owner,
        body: spec.body?.(B.ids),
      })
      expectDenied(res, key, [B.marker])
      expect(await snapshot(B.ids.orgId)).toBe(before)
    },
  )

  it.each(ENTRIES.filter(([, spec]) => spec.access !== 'tenant'))(
    '%s: role below the matrix minimum is denied with 403',
    async (key, spec) => {
      const { method, route } = splitRouteKey(key)
      const below: number[] =
        spec.access === 'member'
          ? [A.applicant]
          : spec.access === 'manager'
            ? [A.applicant, A.player, A.assistant]
            : [A.applicant, A.player, A.assistant, A.organizer]
      const before = await snapshot(A.ids.orgId)
      for (const user of below) {
        const res = await request(method, buildPath(route, A.ids), {
          user,
          body: spec.body?.(A.ids),
        })
        expect(res.status, `${key} as user ${user}`).toBe(403)
      }
      expect(await snapshot(A.ids.orgId)).toBe(before)
    },
  )

  it.each([
    [
      'events.post with venue of another group',
      'POST',
      '/events',
      (b: OrgFixtureIds) => ({
        title: 'X',
        venueId: b.venueId,
        startsAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
        endsAt: new Date(Date.now() + 50 * 3600_000).toISOString(),
        capacity: 5,
        price: 0,
      }),
    ],
    [
      'subscriptions.post with plan of another group',
      'POST',
      '/subscriptions',
      (b: OrgFixtureIds) => ({ planId: b.planId, method: 'cash' }),
    ],
    [
      'ledger.expense with event of another group',
      'POST',
      '/ledger/expense',
      (b: OrgFixtureIds) => ({ category: 'rent', amount: 1000, eventId: b.eventId }),
    ],
    [
      'ledger.income with event of another group',
      'POST',
      '/ledger/income',
      (b: OrgFixtureIds) => ({ category: 'donation', amount: 1000, eventId: b.eventId }),
    ],
    [
      'attendance with booking of another group',
      'POST',
      '/events/:eventId/attendance',
      (b: OrgFixtureIds) => ({ marks: [{ bookingId: b.bookingId, attended: false }] }),
    ],
  ] as const)(
    'foreign id in body: %s is rejected and changes nothing',
    async (_label, method, suffix, body) => {
      const beforeA = await snapshot(A.ids.orgId)
      const beforeB = await snapshot(B.ids.orgId)
      const res = await request(method, buildPath(`/api/organizations/:orgId${suffix}`, A.ids), {
        user: A.owner,
        body: body(B.ids),
      })
      expect(res.status, res.text.slice(0, 200)).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
      expect(res.text).not.toContain(B.marker)
      expect(await snapshot(A.ids.orgId)).toBe(beforeA)
      expect(await snapshot(B.ids.orgId)).toBe(beforeB)
    },
  )

  // Положительный контроль: минимальная роль из матрицы с тем же телом проходит проверку
  // доступа. Иначе отказы выше могли бы быть ложными (сломанный путь или тело тоже дают 403/404).
  // Своя свежая группа на каждый роут: мутации не портят общие фикстуры A/B.
  it.each(ENTRIES)(
    '%s: minimum role passes the access check (positive control)',
    async (key, spec) => {
      const { method, route } = splitRouteKey(key)
      const C = await makeOrg(`C${Math.random().toString(36).slice(2, 6)}`)
      const user = {
        tenant: C.applicant,
        member: C.player,
        manager: C.organizer,
        owner: C.owner,
      }[spec.access]
      const res = await request(method, buildPath(route, C.ids), { user, body: spec.body?.(C.ids) })
      expect(
        [401, 403, 404],
        `${key} as ${spec.access} → ${res.status} ${res.text.slice(0, 200)}`,
      ).not.toContain(res.status)
      expect(res.status, `${key} → ${res.text.slice(0, 200)}`).toBeLessThan(500)
    },
    20_000,
  )

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
