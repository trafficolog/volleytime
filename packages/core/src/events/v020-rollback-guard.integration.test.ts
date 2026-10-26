import {
  bookings,
  closeDb,
  db,
  eq,
  events,
  inviteLinks,
  organizations,
  sql,
  users,
  waitlistOffers,
} from '@volley-time/db'
import { afterAll, describe, expect, it } from 'vitest'

import { postgresTestTransport } from '../__tests__/split-rollback-postgres-transport'
import {
  type RollbackCapability,
  splitRollbackFixture,
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
]

describe('v0.2.0 rollback data guard (real PostgreSQL schema)', { timeout: 30_000 }, () => {
  afterAll(closeDb)
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
        f.targets.web = { split: '1', multiSeat: '1', inviteMode: '1', scheduler: '1' }
        f.targets.bot = { ...f.targets.web }
        f.targets.web[capability] = '<no value>'
        f.targets.bot[capability] = '<no value>'
        f.hook = async (args) => (args.includes('psql') ? transport.query(args.at(-1)!) : undefined)
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
})
