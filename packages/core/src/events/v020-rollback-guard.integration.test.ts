import { readFileSync } from 'node:fs'

import {
  bookings,
  closeDb,
  collections,
  db,
  eq,
  events,
  inviteLinks,
  organizations,
  payments,
  sql,
  users,
  waitlistOffers,
} from '@volley-time/db'
import { afterAll, describe, expect, it } from 'vitest'

import { postgresTestTransport } from '../__tests__/split-rollback-postgres-transport'
import {
  type RollbackCapability,
  splitRollbackFixture,
  splitRollbackScript,
} from '../__tests__/split-rollback-shell-fixture'
import { organizationService } from '../organizations/service'

import { eventService } from './service'

type Seeded = { eventId: number; organizationId: number; userId: number }

// Each case writes exactly one row that a runtime without the capability misreads (20.7.1).
const cases: Array<{
  capability: RollbackCapability
  name: string
  data: string
  seed: (s: Seeded) => Promise<unknown>
}> = [
  {
    capability: 'multiSeat',
    name: 'multi-seat',
    data: 'booking with two seats',
    seed: (s) =>
      db.insert(bookings).values({ ...s, status: 'confirmed', method: 'cash', seats: 2 }),
  },
  {
    capability: 'multiSeat',
    name: 'multi-seat',
    data: 'booking with a waitlisted extra seat',
    seed: (s) =>
      db.insert(bookings).values({ ...s, status: 'confirmed', method: 'cash', waitlistSeats: 1 }),
  },
  {
    capability: 'inviteMode',
    name: 'invite-mode',
    data: 'published invite-only event',
    seed: (s) => db.update(events).set({ joinMode: 'invite' }).where(eq(events.id, s.eventId)),
  },
  {
    capability: 'inviteMode',
    name: 'invite-mode',
    data: 'live event_join link',
    seed: (s) =>
      db.insert(inviteLinks).values({
        token: crypto.randomUUID().replaceAll('-', ''),
        organizationId: s.organizationId,
        eventId: s.eventId,
        type: 'event_join',
        createdByUserId: s.userId,
        defaultMemberStatus: 'pending',
      }),
  },
  {
    capability: 'scheduler',
    name: 'scheduler',
    data: 'active waitlist offer',
    seed: async (s) => {
      const [booking] = await db
        .insert(bookings)
        .values({ ...s, status: 'waitlisted', method: 'cash' })
        .returning()
      await db.insert(waitlistOffers).values({
        organizationId: s.organizationId,
        eventId: s.eventId,
        bookingId: booking!.id,
        seats: 1,
        expiresAt: new Date(Date.now() + 1_800_000),
      })
    },
  },
  {
    capability: 'scheduler',
    name: 'scheduler',
    data: 'future booking_opens_at',
    seed: (s) =>
      db
        .update(events)
        .set({ bookingOpensAt: sql`now() + interval '1 hour'` })
        .where(eq(events.id, s.eventId)),
  },
  {
    capability: 'collections',
    name: 'collections',
    data: 'pending contribution',
    seed: async (s) => {
      const [collection] = await db
        .insert(collections)
        .values({
          organizationId: s.organizationId,
          title: 'Мячи',
          status: 'active',
          createdByUserId: s.userId,
        })
        .returning()
      await db.insert(payments).values({
        organizationId: s.organizationId,
        userId: s.userId,
        collectionId: collection!.id,
        amount: 1500,
        method: 'cash',
      })
    },
  },
]

afterAll(closeDb)

describe(
  'v0.2.0 and v0.3.0 rollback data guard (real PostgreSQL schema)',
  { timeout: 30_000 },
  () => {
    it.each(cases)(
      '$data denies a target without $name support',
      async ({ capability, name, seed }) => {
        // Explicitly authorized test-only container; never discover or operate app containers.
        const transport = await postgresTestTransport()
        const f = await splitRollbackFixture()
        const [owner] = await db
          .insert(users)
          .values({ email: `v020-guard-${crypto.randomUUID()}@test.by` })
          .returning()
        const org = await organizationService.create(
          { userId: owner!.id },
          { name: 'v0.2.0 rollback guard fixture' },
        )
        try {
          const event = await eventService.create({ userId: owner!.id }, org.id, {
            title: 'v0.2.0 rollback guard',
            startsAt: new Date(Date.now() + 2 * 86400000),
            endsAt: new Date(Date.now() + 2 * 86400000 + 7200000),
            capacity: 4,
            price: 0,
          })
          await seed({ eventId: event.id, organizationId: org.id, userId: owner!.id })
          // Only the capability under test is missing; leftover data of other suites cannot deny.
          f.targets.web = {
            split: '1',
            multiSeat: '1',
            inviteMode: '1',
            scheduler: '1',
            collections: '1',
          }
          f.targets.bot = { ...f.targets.web }
          f.targets.web[capability] = '<no value>'
          f.targets.bot[capability] = '<no value>'
          f.hook = async (args) =>
            args.includes('psql') ? transport.query(args.at(-1)!) : undefined
          const result = await f.run()
          // Every real schema/data query parsed and answered t/f: the denial names the rows.
          expect(result.status).toBe(1)
          expect(result.stderr).toContain(`split rollback: ${name} rows require compatible`)
          expect(result.stderr).not.toContain('query failed')
          expect(f.containers.every((c) => c.running)).toBe(true)
        } finally {
          await f.close()
          await db.delete(organizations).where(eq(organizations.id, org.id))
          await db.delete(users).where(eq(users.id, owner!.id))
        }
      },
      35_000,
    )
  },
)

// The exact data predicates the guard runs, read from the script (vector order of the guard).
const guardRows = (() => {
  const script = readFileSync(splitRollbackScript, 'utf8')
  const start = script.indexOf('capability_rows=(')
  const block = script.slice(start, script.indexOf('\n)', start))
  return [...block.matchAll(/^ {2}"(.+)"$/gm)].map((match) => match[1]!)
})()
const vectorIndex: Record<RollbackCapability, number> = {
  split: 0,
  multiSeat: 1,
  inviteMode: 2,
  scheduler: 3,
  collections: 4,
}
type Ids = { org: number; user: number; event: number }
// Boundary rows that must NOT require the capability, each paired with the minimal change that does.
const boundaries: Array<{
  name: string
  capability: RollbackCapability
  negative: (ids: Ids) => string
  positive: (ids: Ids) => string
}> = [
  {
    name: 'fixed-price event',
    capability: 'split',
    negative: () => 'SELECT 1',
    positive: ({ event }) =>
      `UPDATE events SET price_mode = 'split', price = 0, target_amount = 10001 WHERE id = ${event}`,
  },
  {
    name: 'booking with one seat and no waitlisted seats',
    capability: 'multiSeat',
    negative: ({ org, user, event }) =>
      `INSERT INTO bookings (event_id, user_id, organization_id, status, method, seats, waitlist_seats) VALUES (${event}, ${user}, ${org}, 'confirmed', 'cash', 1, 0)`,
    positive: ({ event }) => `UPDATE bookings SET seats = 2 WHERE event_id = ${event}`,
  },
  ...(['cancelled', 'finished'] as const).map((status) => ({
    name: `${status} invite-only event`,
    capability: 'inviteMode' as const,
    negative: ({ event }: Ids) =>
      `UPDATE events SET join_mode = 'invite', status = '${status}' WHERE id = ${event}`,
    positive: ({ event }: Ids) => `UPDATE events SET status = 'published' WHERE id = ${event}`,
  })),
  ...[
    ['revoked', 'is_revoked = true', 'is_revoked = false'],
    ['expired', "expires_at = now() - interval '1 hour'", "expires_at = now() + interval '1 hour'"],
    ['exhausted', 'max_uses = 2, uses_count = 2', 'uses_count = 1'],
    ['over-used', 'max_uses = 2, uses_count = 3', 'max_uses = NULL'],
  ].map(([state, negative, positive]) => ({
    name: `${state} event_join link`,
    capability: 'inviteMode' as const,
    negative: ({ org, user, event }: Ids) =>
      `INSERT INTO invite_links (token, organization_id, event_id, type, created_by_user_id, default_member_status) VALUES ('${state}', ${org}, ${event}, 'event_join', ${user}, 'pending'); UPDATE invite_links SET ${negative} WHERE token = '${state}'`,
    positive: () => `UPDATE invite_links SET ${positive} WHERE token = '${state}'`,
  })),
  {
    name: 'organization_join link',
    capability: 'inviteMode',
    negative: ({ org, user }) =>
      `INSERT INTO invite_links (token, organization_id, type, created_by_user_id) VALUES ('org-join', ${org}, 'organization_join', ${user})`,
    positive: ({ org, user, event }) =>
      `INSERT INTO invite_links (token, organization_id, event_id, type, created_by_user_id) VALUES ('event-join', ${org}, ${event}, 'event_join', ${user})`,
  },
  {
    name: 'booking_opens_at in the past',
    capability: 'scheduler',
    negative: ({ event }) =>
      `UPDATE events SET booking_opens_at = now() - interval '1 hour' WHERE id = ${event}`,
    positive: ({ event }) =>
      `UPDATE events SET booking_opens_at = now() + interval '1 hour' WHERE id = ${event}`,
  },
  ...(['cancelled', 'finished'] as const).map((status) => ({
    name: `future booking_opens_at on a ${status} event`,
    capability: 'scheduler' as const,
    negative: ({ event }: Ids) =>
      `UPDATE events SET booking_opens_at = now() + interval '1 hour', status = '${status}' WHERE id = ${event}`,
    positive: ({ event }: Ids) => `UPDATE events SET status = 'draft' WHERE id = ${event}`,
  })),
  ...(['accepted', 'declined', 'expired', 'revoked'] as const).map((status) => ({
    name: `${status} waitlist offer`,
    capability: 'scheduler' as const,
    negative: ({ org, user, event }: Ids) =>
      `WITH b AS (INSERT INTO bookings (event_id, user_id, organization_id, status, method) VALUES (${event}, ${user}, ${org}, 'waitlisted', 'cash') RETURNING id) INSERT INTO waitlist_offers (organization_id, event_id, booking_id, seats, status, expires_at) SELECT ${org}, ${event}, b.id, 1, '${status}', now() + interval '30 minutes' FROM b`,
    positive: ({ event }: Ids) =>
      `UPDATE waitlist_offers SET status = 'offered' WHERE event_id = ${event}`,
  })),
  {
    name: 'pending payment without a collection',
    capability: 'collections',
    negative: ({ org, user }) =>
      `INSERT INTO payments (organization_id, user_id, amount, method, status) VALUES (${org}, ${user}, 1500, 'cash', 'pending')`,
    positive: ({ org, user }) =>
      `WITH c AS (INSERT INTO collections (organization_id, title, status, created_by_user_id) VALUES (${org}, 'Мячи', 'active', ${user}) RETURNING id) INSERT INTO payments (organization_id, user_id, collection_id, amount, method) SELECT ${org}, ${user}, c.id, 700, 'cash' FROM c`,
  },
  ...(['succeeded', 'cancelled', 'refunded'] as const).map((status) => ({
    name: `${status} contribution`,
    capability: 'collections' as const,
    negative: ({ org, user }: Ids) =>
      `WITH c AS (INSERT INTO collections (organization_id, title, status, created_by_user_id) VALUES (${org}, 'Форма', 'active', ${user}) RETURNING id) INSERT INTO payments (organization_id, user_id, collection_id, amount, method, status) SELECT ${org}, ${user}, c.id, 1500, 'cash', '${status}' FROM c`,
    positive: () => `UPDATE payments SET status = 'pending' WHERE collection_id IS NOT NULL`,
  })),
]

class Rollback extends Error {}

// A guard query is `SET search_path ...; SELECT ...`: postgres.js returns one row set per statement.
type Row = Record<string, unknown>
function lastResult(result: unknown): Row[] {
  const sets = result as unknown[]
  return (Array.isArray(sets[0]) ? sets.at(-1) : sets) as Row[]
}

describe('v0.2.0 rollback data guard boundaries (real PostgreSQL)', () => {
  it('reads exactly the five guard predicates from the script', () => {
    expect(guardRows).toHaveLength(5)
    expect(guardRows[vectorIndex.multiSeat]).toContain('waitlist_seats > 0')
  })
  it('a schema shadowing public earlier in the session search_path cannot answer the guard', async () => {
    await db
      .transaction(async (tx) => {
        await tx.execute(
          sql.raw(
            'TRUNCATE events, bookings, invite_links, waitlist_offers, payments, collections CASCADE',
          ),
        )
        // Every shadow table holds exactly the row each predicate looks for.
        for (const statement of [
          'CREATE SCHEMA vt_guard_shadow',
          "CREATE TABLE vt_guard_shadow.events AS SELECT 'split'::text AS price_mode, 'invite'::text AS join_mode, 'published'::text AS status, now() + interval '1 hour' AS booking_opens_at",
          'CREATE TABLE vt_guard_shadow.bookings AS SELECT 2 AS seats, 0 AS waitlist_seats',
          "CREATE TABLE vt_guard_shadow.invite_links AS SELECT 'event_join'::text AS type, false AS is_revoked, NULL::timestamptz AS expires_at, NULL::int AS max_uses, 0 AS uses_count",
          "CREATE TABLE vt_guard_shadow.waitlist_offers AS SELECT 'offered'::text AS status",
          "CREATE TABLE vt_guard_shadow.payments AS SELECT 1 AS collection_id, 'pending'::text AS status",
          'SET LOCAL search_path TO vt_guard_shadow, public',
        ])
          await tx.execute(sql.raw(statement))
        let vector = ''
        for (const query of guardRows) {
          const [row] = lastResult(await tx.execute(sql.raw(query)))
          vector += Object.values(row!)[0] ? 't' : 'f'
        }
        // The guard reads only public, which is clean: the shadow rows neither deny nor allow.
        expect(vector).toBe('fffff')
        throw new Rollback()
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error
      })
  })
  it.each(boundaries)(
    '$name does not require $capability; the paired change does',
    async ({ capability, negative, positive }) => {
      await db
        .transaction(async (tx) => {
          const vector = async () => {
            let result = ''
            for (const query of guardRows) {
              const [row] = lastResult(await tx.execute(sql.raw(query)))
              const value = Object.values(row!)[0]
              expect(typeof value).toBe('boolean')
              result += value ? 't' : 'f'
            }
            return result
          }
          // Clean slate inside the transaction only: rows of other suites cannot leak in or out.
          await tx.execute(
            sql.raw(
              'TRUNCATE events, bookings, invite_links, waitlist_offers, payments, collections CASCADE',
            ),
          )
          const [user] = await tx
            .insert(users)
            .values({ email: `v020-boundary-${crypto.randomUUID()}@test.by` })
            .returning()
          const [org] = await tx
            .insert(organizations)
            .values({
              slug: `v020-boundary-${crypto.randomUUID()}`.slice(0, 64),
              name: 'v0.2.0 guard boundary',
              ownerUserId: user!.id,
            })
            .returning()
          const [event] = await tx
            .insert(events)
            .values({
              organizationId: org!.id,
              createdByUserId: user!.id,
              title: 'v0.2.0 guard boundary',
              startsAt: new Date(Date.now() + 2 * 86400000),
              endsAt: new Date(Date.now() + 2 * 86400000 + 7200000),
              capacity: 4,
            })
            .returning()
          const ids = { org: org!.id, user: user!.id, event: event!.id }
          expect(await vector(), 'clean slate').toBe('fffff')
          for (const statement of negative(ids).split('; ')) await tx.execute(sql.raw(statement))
          expect(await vector(), 'boundary row').toBe('fffff')
          await tx.execute(sql.raw(positive(ids)))
          const expected = ['f', 'f', 'f', 'f', 'f']
          expected[vectorIndex[capability]] = 't'
          expect(await vector(), 'paired positive row').toBe(expected.join(''))
          throw new Rollback()
        })
        .catch((error: unknown) => {
          if (!(error instanceof Rollback)) throw error
        })
    },
  )
})
