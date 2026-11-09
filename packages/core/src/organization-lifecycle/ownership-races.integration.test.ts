import {
  and,
  closeDb,
  db,
  eq,
  organizationMembers,
  organizations,
  sql,
  users,
  type Organization,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { ownershipTransferService } from './service'

/**
 * Task 21.2.17, ревью PR #239: принятие передачи и одновременная мутация участника (смена роли,
 * блокировка, выход). Детерминированный порядок: журнал аудита удерживается `LOCK … IN SHARE MODE`,
 * поэтому первая транзакция доходит до своей записи в журнал и ждёт с уже взятыми блокировками
 * строк; вторая стартует и встаёт в очередь (ожидание видно в `pg_locks`); затем журнал отпускается.
 * Инвариант после любого исхода: ровно один owner, и `organizations.owner_user_id` — это он, активный.
 */
describe(
  'ownership transfer vs concurrent member mutations (PostgreSQL)',
  { timeout: 30_000 },
  () => {
    interface Setup {
      owner: number
      recipient: number
      org: Organization
      recipientMemberId: number
      token: string
    }

    async function setup(): Promise<Setup> {
      const [a] = await db
        .insert(users)
        .values({ email: `race-a-${crypto.randomUUID()}@t.by` })
        .returning()
      const [b] = await db
        .insert(users)
        .values({ email: `race-b-${crypto.randomUUID()}@t.by` })
        .returning()
      const org = await organizationService.create({ userId: a!.id }, { name: 'Race' })
      const mb = await memberService.add(
        { userId: a!.id },
        { organizationId: org.id, userId: b!.id },
      )
      const { token } = await ownershipTransferService.start({ userId: a!.id }, org.id, {
        recipientMemberId: mb.id,
      })
      return { owner: a!.id, recipient: b!.id, org, recipientMemberId: mb.id, token }
    }

    /** Ровно один активный owner, совпадающий с `owner_user_id`. */
    async function expectSingleOwner(orgId: number) {
      const owners = await db
        .select({ userId: organizationMembers.userId, status: organizationMembers.status })
        .from(organizationMembers)
        .where(
          and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.role, 'owner')),
        )
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
      expect(owners).toHaveLength(1)
      expect(owners[0]).toEqual({ userId: org!.ownerUserId, status: 'active' })
      return org!.ownerUserId
    }

    const settle = <T>(p: Promise<T>) =>
      p.then(
        (value) => ({ ok: true as const, value }),
        (error: { code?: string; message?: string }) => ({
          ok: false as const,
          code: error?.code ?? error?.message,
        }),
      )

    async function lockWaiters(): Promise<number> {
      const [row] = await db.execute(
        sql`SELECT count(DISTINCT pid)::int AS n FROM pg_locks WHERE NOT granted`,
      )
      return Number(row!.n)
    }

    async function untilWaiters(n: number) {
      const deadline = Date.now() + 10_000
      while ((await lockWaiters()) < n) {
        if (Date.now() > deadline) throw new Error(`expected ${n} lock waiters`)
        await new Promise((r) => setTimeout(r, 20))
      }
    }

    /** Запускает `first`, ждёт, пока он упрётся в журнал, затем `second`, ждёт его очереди и отпускает. */
    async function inOrder<A, B>(first: () => Promise<A>, second: () => Promise<B>) {
      let release!: () => void
      let ready!: () => void
      const gate = new Promise<void>((r) => (release = r))
      const locked = new Promise<void>((r) => (ready = r))
      const holder = db.transaction(async (tx) => {
        await tx.execute(sql`LOCK TABLE audit_log IN SHARE MODE`)
        ready()
        await gate
      })
      await locked
      const a = settle(first())
      await untilWaiters(1)
      const b = settle(second())
      await untilWaiters(2)
      release()
      await holder
      return [await a, await b] as const
    }

    beforeEach(async () => {
      await db.delete(organizations)
      await db.delete(users)
    })

    afterAll(async () => {
      await db.delete(organizations)
      await db.delete(users)
      await closeDb()
    })

    it('changeRole of the recipient queued behind an accept in flight cannot demote the new owner', async () => {
      const s = await setup()
      const [accept, change] = await inOrder(
        () => ownershipTransferService.accept({ userId: s.recipient }, s.token),
        () =>
          memberService.changeRole(
            { userId: s.owner, organization: s.org },
            s.recipientMemberId,
            'organizer',
          ),
      )
      expect(accept.ok).toBe(true)
      expect(change).toEqual({ ok: false, code: 'member.cannot_change_owner_role' })
      expect(await expectSingleOwner(s.org.id)).toBe(s.recipient)
    })

    it('block of the recipient committed first makes the accept refuse; no blocked owner', async () => {
      const s = await setup()
      const [block, accept] = await inOrder(
        () => memberService.block({ userId: s.owner, organization: s.org }, s.recipientMemberId),
        () => ownershipTransferService.accept({ userId: s.recipient }, s.token),
      )
      expect(block.ok).toBe(true)
      expect(accept).toEqual({ ok: false, code: 'ownership_transfer.recipient_not_member' })
      expect(await expectSingleOwner(s.org.id)).toBe(s.owner)
    })

    it('block of the recipient queued behind an accept in flight is refused as blocking the owner', async () => {
      const s = await setup()
      const [accept, block] = await inOrder(
        () => ownershipTransferService.accept({ userId: s.recipient }, s.token),
        () => memberService.block({ userId: s.owner, organization: s.org }, s.recipientMemberId),
      )
      expect(accept.ok).toBe(true)
      expect(block).toEqual({ ok: false, code: 'member.cannot_block_owner' })
      expect(await expectSingleOwner(s.org.id)).toBe(s.recipient)
    })

    it('the recipient leaving behind an accept in flight is refused: the owner cannot leave', async () => {
      const s = await setup()
      const [accept, leave] = await inOrder(
        () => ownershipTransferService.accept({ userId: s.recipient }, s.token),
        () => memberService.leaveOrg({ userId: s.recipient }, s.org.id),
      )
      expect(accept.ok).toBe(true)
      expect(leave).toEqual({ ok: false, code: 'member.owner_cannot_leave' })
      expect(await expectSingleOwner(s.org.id)).toBe(s.recipient)
    })
  },
)
