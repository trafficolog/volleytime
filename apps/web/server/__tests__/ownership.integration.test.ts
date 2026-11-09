import {
  bookingService,
  eventService,
  excludeMember,
  inviteService,
  ledgerService,
  memberService,
  organizationBrandingService,
  organizationService,
  planService,
  subscriptionService,
  telegramChatService,
  venueService,
} from '@volley-time/core'
import {
  and,
  asc,
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  events,
  inviteLinks,
  ledgerEntries,
  organizationEventBalances,
  organizationMembers,
  organizationOwnershipTransfers,
  organizations,
  organizationTelegramChats,
  payments,
  sql,
  subscriptions,
  users,
} from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'
import { pngBytes } from './logo-fixtures'

type Res = Awaited<ReturnType<Awaited<ReturnType<typeof createTestApi>>>>
const code = (res: Res) => (res.body as { data?: { code?: string } }).data?.code

/**
 * Task 21.2.17 (D-15): передача владения и мягкое удаление группы по HTTP. Права (только owner),
 * личная ссылка (одноразовая, привязана к получателю, истекает, хранится хешем), ровно один owner
 * при гонках, удалённая группа скрыта и заблокирована, деньги в окне не меняются, восстановление.
 * IDOR по таблице маршрутов — в idor.integration.test.ts.
 */
describe('ownership transfer and soft delete API (HTTP integration)', { timeout: 60_000 }, () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let assistantId: number
  let playerId: number
  let applicantId: number
  let outsiderId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  let members: Record<'organizer' | 'assistant' | 'player' | 'applicant' | 'owner', number>
  let otherMemberId: number
  const ORG_NAME = 'Волейбол Минск'
  const base = (id = orgId) => `/api/organizations/${id}`

  async function newUser(tag: string, extra: Partial<typeof users.$inferInsert> = {}) {
    const [u] = await db
      .insert(users)
      .values({ email: `own-${tag}-${Math.random()}@t.by`, name: `Имя ${tag}`, ...extra })
      .returning()
    return u!.id
  }

  const memberRow = (userId: number, org = orgId) =>
    db.query.organizationMembers.findFirst({
      where: and(eq(organizationMembers.organizationId, org), eq(organizationMembers.userId, userId)),
    })

  async function owners(org = orgId) {
    const rows = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, org), eq(organizationMembers.role, 'owner')))
    const [o] = await db.select().from(organizations).where(eq(organizations.id, org))
    return { members: rows.map((r) => r.userId), ownerUserId: o!.ownerUserId }
  }

  async function start(recipient: number = members.player) {
    const res = await request('POST', `${base()}/ownership-transfer`, {
      user: ownerId,
      body: { recipientMemberId: recipient },
    })
    expect(res.status, res.text).toBe(200)
    const body = res.body as {
      transfer: { id: number; toUserId: number; expiresAt: string }
      links: { telegram: string | null; web: string }
    }
    const token = body.links.web.split('#')[1]!
    return { ...body, token }
  }

  const accept = (user: number, token: unknown) =>
    request('POST', '/api/ownership-transfers/accept', { user, body: { token } })
  const preview = (user: number, token: unknown) =>
    request('POST', '/api/ownership-transfers/preview', { user, body: { token } })

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    assistantId = await newUser('assistant')
    playerId = await newUser('player')
    applicantId = await newUser('applicant')
    outsiderId = await newUser('outsider')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: ORG_NAME })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Другая' })).id
    const add = async (userId: number, extra: Record<string, unknown> = {}) =>
      (await memberService.add({ userId: ownerId }, { organizationId: orgId, userId, ...extra })).id
    members = {
      owner: (await memberRow(ownerId))!.id,
      organizer: await add(organizerId, { role: 'organizer' }),
      assistant: await add(assistantId, { role: 'assistant' }),
      player: await add(playerId),
      applicant: await add(applicantId, { status: 'pending' }),
    }
    otherMemberId = (
      await memberService.add(
        { userId: otherOwnerId },
        { organizationId: otherOrgId, userId: outsiderId },
      )
    ).id
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('ownership transfer', () => {
    it('start creates one pending transfer with a personal link; the token is stored only hashed', async () => {
      const logs: string[] = []
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
        vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
          logs.push(args.map(String).join(' '))
        }),
      )
      try {
        const { transfer, links, token } = await start()
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(links.web).toBe(`http://localhost:3000/app/transfer#${token}`)
        expect(links.telegram).toBe(
          `https://t.me/volleytime_test_bot?startapp=transfer_${token}`,
        )
        expect(transfer.toUserId).toBe(playerId)
        // до принятия владелец не меняется
        expect(await owners()).toEqual({ members: [ownerId], ownerUserId: ownerId })
        const [row] = await db.select().from(organizationOwnershipTransfers)
        expect(row).toMatchObject({ status: 'pending', fromUserId: ownerId, toUserId: playerId })
        expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/)
        expect(JSON.stringify(row)).not.toContain(token)
        // токена нет ни в журнале, ни в повторном чтении, ни в логах
        const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
        expect(audit.some((e) => e.action === 'ownership_transfer.started')).toBe(true)
        expect(JSON.stringify(audit)).not.toContain(token)
        const current = await request('GET', `${base()}/ownership-transfer`, { user: ownerId })
        expect(current.status).toBe(200)
        expect(current.body).toMatchObject({
          transfer: { id: transfer.id, toUserId: playerId, toMemberId: members.player },
          restoreWindowDays: 30,
        })
        expect(current.text).not.toContain(token)
        await accept(playerId, token)
        expect(logs.join('\n')).not.toContain(token)
      } finally {
        for (const s of spies) s.mockRestore()
      }
    })

    it('allows at most one pending transfer, also under parallel starts', async () => {
      const results = await Promise.all(
        [members.player, members.organizer, members.assistant].map((m) =>
          request('POST', `${base()}/ownership-transfer`, {
            user: ownerId,
            body: { recipientMemberId: m },
          }),
        ),
      )
      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409])
      for (const r of results.filter((x) => x.status === 409))
        expect(code(r)).toBe('ownership_transfer.pending_exists')
      const pending = await db
        .select()
        .from(organizationOwnershipTransfers)
        .where(eq(organizationOwnershipTransfers.status, 'pending'))
      expect(pending).toHaveLength(1)
    })

    it('rejects a transfer to yourself, an applicant, a former member and a member of another group', async () => {
      const blockedId = await newUser('blocked')
      const blocked = (
        await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: blockedId })
      ).id
      await memberService.block({ userId: ownerId }, blocked)
      const leftId = await newUser('left')
      const left = (
        await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: leftId })
      ).id
      await excludeMember({ userId: ownerId }, left)
      for (const recipient of [members.owner, members.applicant, blocked, left, otherMemberId, 2_000_000_000]) {
        const res = await request('POST', `${base()}/ownership-transfer`, {
          user: ownerId,
          body: { recipientMemberId: recipient },
        })
        expect(res.status, `recipient ${recipient}`).toBe(422)
        expect(code(res)).toBe('ownership_transfer.recipient_invalid')
        expect(res.text).not.toContain('Другая')
      }
      expect(await db.select().from(organizationOwnershipTransfers)).toHaveLength(0)
    })

    it('only the recipient can preview or accept; foreign and unknown links look the same', async () => {
      const { token } = await start()
      const unknown = 'x'.repeat(43)
      const expected = { status: 'invalid', organization: null, fromName: null, expiresAt: null }
      for (const user of [ownerId, organizerId, assistantId, outsiderId, otherOwnerId]) {
        const p = await preview(user, token)
        expect(p.status).toBe(200)
        expect(p.body).toEqual(expected)
        expect(p.text).not.toContain(ORG_NAME)
        const a = await accept(user, token)
        expect(a.status, `accept as ${user}`).toBe(404)
        expect(code(a)).toBe('ownership_transfer.invalid')
      }
      for (const bad of [unknown, '', 'short', 42, null, `${token}x`]) {
        expect((await preview(playerId, bad)).body).toEqual(expected)
        expect(code(await accept(playerId, bad))).toBe('ownership_transfer.invalid')
      }
      // без входа — 401
      expect(
        (await request('POST', '/api/ownership-transfers/accept', { body: { token } })).status,
      ).toBe(401)
      // ничего не изменилось
      expect(await owners()).toEqual({ members: [ownerId], ownerUserId: ownerId })
      const mine = await preview(playerId, token)
      expect(mine.body).toMatchObject({
        status: 'pending',
        organization: { id: orgId, name: ORG_NAME },
        fromName: 'Имя owner',
      })
    })

    it('accept makes the recipient the only owner and the previous owner an organizer at once', async () => {
      const { token, transfer } = await start()
      const res = await accept(playerId, token)
      expect(res.status, res.text).toBe(200)
      expect(res.body).toEqual({ organizationId: orgId })
      expect(await owners()).toEqual({ members: [playerId], ownerUserId: playerId })
      expect((await memberRow(ownerId))!.role).toBe('organizer')
      const [t] = await db.select().from(organizationOwnershipTransfers)
      expect(t).toMatchObject({ status: 'accepted' })
      const actions = (
        await db
          .select()
          .from(auditLog)
          .where(eq(auditLog.organizationId, orgId))
          .orderBy(asc(auditLog.id))
      ).map((e) => [e.action, e.userId, e.entityId])
      expect(actions).toEqual(
        expect.arrayContaining([
          ['ownership_transfer.accepted', playerId, transfer.id],
          ['member.role_changed', playerId, members.owner],
          ['member.role_changed', playerId, members.player],
        ]),
      )
      // прежний owner сразу теряет права owner, новый — получает
      for (const [method, path, body] of [
        ['GET', '/ownership-transfer', undefined],
        ['POST', '/delete', { confirmName: ORG_NAME }],
        ['PATCH', '', { name: 'Захват' }],
      ] as const) {
        const denied = await request(method, `${base()}${path}`, { user: ownerId, body })
        expect(denied.status, `${method} ${path}`).toBe(403)
      }
      expect((await request('GET', `${base()}/ownership-transfer`, { user: playerId })).status).toBe(200)
      // прежний owner остаётся организатором: управляет контентом
      expect((await request('GET', `${base()}/audit`, { user: ownerId })).status).toBe(200)
      // повторное использование ссылки отклоняется
      const again = await accept(playerId, token)
      expect(again.status).toBe(409)
      expect(code(again)).toBe('ownership_transfer.used')
      expect((await preview(playerId, token)).body).toMatchObject({ status: 'accepted' })
    })

    it('parallel accepts of one link produce exactly one owner change', async () => {
      const { token } = await start()
      const results = await Promise.all([1, 2, 3, 4].map(() => accept(playerId, token)))
      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409])
      expect(await owners()).toEqual({ members: [playerId], ownerUserId: playerId })
      expect(
        await db.select().from(auditLog).where(eq(auditLog.action, 'ownership_transfer.accepted')),
      ).toHaveLength(1)
    })

    it('cancel and accept racing leave exactly one consistent outcome', async () => {
      for (let i = 0; i < 5; i++) {
        const { token } = await start()
        const [cancel, acc] = await Promise.all([
          request('DELETE', `${base()}/ownership-transfer`, { user: ownerId }),
          accept(playerId, token),
        ])
        const [t] = await db
          .select()
          .from(organizationOwnershipTransfers)
          .orderBy(sql`id desc`)
          .limit(1)
        const own = await owners()
        expect(own.members).toHaveLength(1)
        expect(own.members[0]).toBe(own.ownerUserId)
        if (t!.status === 'accepted') {
          expect(acc.status).toBe(200)
          // отмена после принятия: прежний owner уже не owner
          expect([200, 403]).toContain(cancel.status)
          expect(own.ownerUserId).toBe(playerId)
          // вернуть владение обратно для следующего круга
          await db.transaction(async (tx) => {
            await tx
              .update(organizationMembers)
              .set({ role: 'player' })
              .where(eq(organizationMembers.id, members.player))
            await tx
              .update(organizationMembers)
              .set({ role: 'owner' })
              .where(eq(organizationMembers.id, members.owner))
            await tx.update(organizations).set({ ownerUserId: ownerId }).where(eq(organizations.id, orgId))
          })
        } else {
          expect(t!.status).toBe('cancelled')
          expect(cancel.status).toBe(200)
          expect(acc.status).toBe(410)
          expect(code(acc)).toBe('ownership_transfer.cancelled')
          expect(own.ownerUserId).toBe(ownerId)
        }
      }
    })

    it('cancel invalidates the link; repeat cancel is a no-op', async () => {
      const { token } = await start()
      const res = await request('DELETE', `${base()}/ownership-transfer`, { user: ownerId })
      expect(res.body).toEqual({ cancelled: true })
      expect(
        (await request('DELETE', `${base()}/ownership-transfer`, { user: ownerId })).body,
      ).toEqual({ cancelled: false })
      const acc = await accept(playerId, token)
      expect(acc.status).toBe(410)
      expect(code(acc)).toBe('ownership_transfer.cancelled')
      expect((await request('GET', `${base()}/ownership-transfer`, { user: ownerId })).body).toMatchObject({
        transfer: null,
      })
      expect(await owners()).toEqual({ members: [ownerId], ownerUserId: ownerId })
      expect(
        await db.select().from(auditLog).where(eq(auditLog.action, 'ownership_transfer.cancelled')),
      ).toHaveLength(1)
      // новая передача после отмены возможна
      await start(members.organizer)
    })

    it('an expired link is rejected, recorded as expired, and frees the group for a new transfer', async () => {
      const { token } = await start()
      // срок ссылки прошёл (72 ч сдвинуты в прошлое), планировщик её ещё не закрыл
      await db.update(organizationOwnershipTransfers).set({
        createdAt: sql`now() - interval '73 hours'`,
        expiresAt: sql`now() - interval '1 hour'`,
      })
      const acc = await accept(playerId, token)
      expect(acc.status).toBe(410)
      expect(code(acc)).toBe('ownership_transfer.expired')
      const [t] = await db.select().from(organizationOwnershipTransfers)
      expect(t!.status).toBe('expired')
      const audit = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, 'ownership_transfer.expired'))
      expect(audit).toHaveLength(1)
      expect(audit[0]!.userId).toBeNull()
      expect(await owners()).toEqual({ members: [ownerId], ownerUserId: ownerId })
      expect((await preview(playerId, token)).body).toMatchObject({ status: 'expired' })
      await start(members.organizer)
    })

    it('a recipient excluded before accepting cannot take the group; the transfer stays pending', async () => {
      const { token } = await start()
      await excludeMember({ userId: ownerId }, members.player)
      const acc = await accept(playerId, token)
      expect(acc.status).toBe(409)
      expect(code(acc)).toBe('ownership_transfer.recipient_not_member')
      expect(await owners()).toEqual({ members: [ownerId], ownerUserId: ownerId })
      expect((await db.select().from(organizationOwnershipTransfers))[0]!.status).toBe('pending')
    })

    it('rolls back the whole accept on failure: no partial role change', async () => {
      const { token } = await start()
      // сбой посреди транзакции: запись журнала о принятии отклоняется CHECK — откатывается всё
      await db.execute(sql`ALTER TABLE audit_log ADD CONSTRAINT audit_fail_chk
        CHECK (action <> 'ownership_transfer.accepted') NOT VALID`)
      try {
        const res = await accept(playerId, token)
        expect(res.status).toBe(500)
      } finally {
        await db.execute(sql`ALTER TABLE audit_log DROP CONSTRAINT audit_fail_chk`)
      }
      expect(await owners()).toEqual({ members: [ownerId], ownerUserId: ownerId })
      expect((await memberRow(playerId))!.role).toBe('player')
      expect((await db.select().from(organizationOwnershipTransfers))[0]!.status).toBe('pending')
      expect((await accept(playerId, token)).status).toBe(200)
    })
  })

  describe('soft delete and restore', () => {
    /** Деньги и связи группы: всё, что удаление в окне не должно изменить. */
    async function groupState() {
      const rows = await Promise.all([
        db.select().from(events).where(eq(events.organizationId, orgId)).orderBy(events.id),
        db.select().from(bookings).where(eq(bookings.organizationId, orgId)).orderBy(bookings.id),
        db.select().from(payments).where(eq(payments.organizationId, orgId)).orderBy(payments.id),
        db.select().from(ledgerEntries).where(eq(ledgerEntries.organizationId, orgId)),
        db
          .select()
          .from(organizationEventBalances)
          .where(eq(organizationEventBalances.organizationId, orgId)),
        db.select().from(eventBalanceEntries).where(eq(eventBalanceEntries.organizationId, orgId)),
        db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)),
        db.select().from(inviteLinks).where(eq(inviteLinks.organizationId, orgId)),
        db
          .select()
          .from(organizationTelegramChats)
          .where(eq(organizationTelegramChats.organizationId, orgId)),
        db
          .select()
          .from(organizationMembers)
          .where(eq(organizationMembers.organizationId, orgId))
          .orderBy(organizationMembers.id),
      ])
      return JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    }

    async function fixture() {
      const venue = await venueService.create({ userId: ownerId }, { organizationId: orgId, name: 'Зал' })
      const ev = await eventService.create({ userId: ownerId }, orgId, {
        title: 'Будущая игра',
        venueId: venue.id,
        startsAt: new Date(Date.now() + 48 * 3600_000),
        endsAt: new Date(Date.now() + 50 * 3600_000),
        capacity: 10,
        price: 1500,
      })
      const booking = await bookingService.book({ userId: playerId }, orgId, ev.id, { method: 'cash' })
      const plan = await planService.create(
        { userId: ownerId },
        { organizationId: orgId, name: 'Абонемент', totalSessions: 8, price: 8000 },
      )
      await subscriptionService.purchase({ userId: organizerId }, orgId, plan.id, { method: 'cash' })
      await ledgerService.addExpense({ userId: ownerId }, orgId, {
        category: 'rent',
        amount: 5000,
        description: 'Аренда',
      })
      const invite = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
      const { code: chatCode } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      await telegramChatService.claim({
        verdict: 'admin',
        code: chatCode,
        chatId: `-100${Math.floor(1e9 + Math.random() * 9e9)}`,
        chatType: 'supergroup',
        title: 'Чат группы',
        botCanPost: true,
        confirmedByTelegramId: '777',
      })
      await organizationBrandingService.setLogo({ userId: ownerId }, orgId, {
        declaredType: 'image/png',
        data: pngBytes(64),
      })
      const [withSlug] = await db.select().from(events).where(eq(events.id, ev.id))
      return { ev, booking, invite, publicSlug: withSlug!.publicSlug }
    }

    const del = (user: number, confirmName: unknown = ORG_NAME) =>
      request('POST', `${base()}/delete`, { user, body: { confirmName } })

    it('requires the exact group name; a mismatch changes nothing', async () => {
      await fixture()
      const before = await groupState()
      for (const name of ['', 'волейбол минск', 'Волейбол', 'Другая']) {
        const res = await del(ownerId, name)
        expect(res.status).toBe(422)
        expect(code(res)).toBe('organization.delete_confirmation_mismatch')
      }
      const noName = await request('POST', `${base()}/delete`, { user: ownerId, body: {} })
      expect(noName.status).toBe(422)
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
      expect(org!.deletedAt).toBeNull()
      expect(await groupState()).toBe(before)
      // лишние пробелы по краям не мешают
      expect((await del(ownerId, `  ${ORG_NAME} `)).status).toBe(200)
    })

    it('is refused while an ownership transfer is pending', async () => {
      await start()
      const res = await del(ownerId)
      expect(res.status).toBe(409)
      expect(code(res)).toBe('organization.transfer_pending')
      await request('DELETE', `${base()}/ownership-transfer`, { user: ownerId })
      expect((await del(ownerId)).status).toBe(200)
    })

    it('hides and blocks the group, keeps money and links untouched, and restore brings it back', async () => {
      vi.stubEnv('GROUP_RESTORE_WINDOW_DAYS', '14')
      const { ev, booking, invite, publicSlug } = await fixture()
      const before = await groupState()
      const t0 = Date.now()
      const res = await del(ownerId)
      expect(res.status, res.text).toBe(200)
      const { deletedAt, restoreUntil } = res.body as { deletedAt: string; restoreUntil: string }
      expect(new Date(restoreUntil).getTime() - new Date(deletedAt).getTime()).toBe(14 * 86_400_000)
      expect(new Date(deletedAt).getTime()).toBeGreaterThanOrEqual(t0 - 1000)
      // деньги и связи — без изменений: события, записи, платежи, касса, баланс событий, абонементы,
      // приглашения, привязка чата, участники
      expect(await groupState()).toBe(before)

      // участники: группа скрыта из списков и недоступна (410), включая owner вне карточки группы
      for (const user of [organizerId, assistantId, playerId]) {
        const list = await request('GET', '/api/organizations', { user })
        expect((list.body as { organizations: { id: number }[] }).organizations.map((o) => o.id)).not.toContain(orgId)
        expect((list.body as { deletedOrganizations: unknown[] }).deletedOrganizations).toEqual([])
        const org = await request('GET', base(), { user })
        expect(org.status).toBe(410)
        expect(code(org)).toBe('organization.deleted')
      }
      const ownerList = await request('GET', '/api/organizations', { user: ownerId })
      const ownerBody = ownerList.body as {
        organizations: { id: number }[]
        deletedOrganizations: { id: number; name: string; restoreUntil: string; restorable: boolean }[]
      }
      expect(ownerBody.organizations.map((o) => o.id)).not.toContain(orgId)
      expect(ownerBody.deletedOrganizations).toEqual([
        expect.objectContaining({ id: orgId, name: ORG_NAME, restoreUntil, restorable: true }),
      ])
      // запись, оплата, управление — заблокированы для всех ролей
      const blocked: [string, string, number, unknown][] = [
        ['POST', `/events/${ev.id}/bookings`, organizerId, { method: 'cash' }],
        ['POST', `/bookings/${booking.id}/cancel`, playerId, {}],
        ['GET', '/events', playerId, undefined],
        ['GET', '/payments', ownerId, undefined],
        ['POST', '/subscriptions', playerId, { planId: 1, method: 'cash' }],
        ['POST', '/ledger/expense', ownerId, { category: 'rent', amount: 100, description: 'x' }],
        ['POST', '/ownership-transfer', ownerId, { recipientMemberId: members.player }],
        ['POST', '/delete', ownerId, { confirmName: ORG_NAME }],
        ['PATCH', '', ownerId, { name: 'Новое' }],
        ['POST', '/archive', ownerId, {}],
        ['GET', '/settings', ownerId, undefined],
      ]
      for (const [method, path, user, body] of blocked) {
        const r = await request(method, `${base()}${path}`, { user, body })
        expect(r.status, `${method} ${path}`).toBe(410)
        expect(code(r)).toBe('organization.deleted')
      }
      // посторонний не узнаёт, что группа удалена
      const outsider = await request('GET', base(), { user: otherOwnerId })
      expect(outsider.status).toBe(403)
      expect(code(outsider)).toBe('permission.not_member')
      // публичные страницы и приглашения: как неизвестные
      expect((await request('GET', `/api/public/events/${publicSlug}`)).status).toBe(404)
      expect((await request('GET', `${base()}/logo`)).status).toBe(404)
      expect((await request('GET', `/api/invites/${invite.token}`, { user: outsiderId })).body).toEqual({
        status: 'not_found',
      })
      const redeem = await request('POST', `/api/invites/${invite.token}/redeem`, { user: outsiderId })
      expect(redeem.status).toBe(404)
      expect(await memberRow(outsiderId)).toBeUndefined()
      // owner видит карточку удалённой группы с окном восстановления
      const card = await request('GET', base(), { user: ownerId })
      expect(card.status).toBe(200)
      expect((card.body as { organization: { deletedAt: string; restoreUntil: string } }).organization).toMatchObject({
        deletedAt,
        restoreUntil,
      })
      expect(await groupState()).toBe(before)

      // восстанавливает только owner
      for (const user of [organizerId, assistantId, playerId]) {
        const r = await request('POST', `${base()}/restore`, { user })
        expect(r.status).toBe(410)
      }
      const restored = await request('POST', `${base()}/restore`, { user: ownerId })
      expect(restored.status, restored.text).toBe(200)
      expect(await groupState()).toBe(before)
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
      expect(org).toMatchObject({ deletedAt: null, restoreUntil: null, status: 'active' })
      for (const user of [ownerId, playerId]) {
        const list = await request('GET', '/api/organizations', { user })
        expect((list.body as { organizations: { id: number }[] }).organizations.map((o) => o.id)).toContain(orgId)
      }
      expect((await request('GET', `/api/public/events/${publicSlug}`)).status).toBe(200)
      expect((await request('GET', `${base()}/logo`)).status).toBe(200)
      const book = await request('POST', `${base()}/events/${ev.id}/bookings`, {
        user: organizerId,
        body: { method: 'cash' },
      })
      expect(book.status, book.text).toBe(200)
      const actions = (
        await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      ).map((e) => e.action)
      expect(actions).toEqual(expect.arrayContaining(['organization.deleted', 'organization.restored']))
      // повторное восстановление — 409
      const again = await request('POST', `${base()}/restore`, { user: ownerId })
      expect(again.status).toBe(409)
      expect(code(again)).toBe('organization.not_deleted')
    })

    it('after the window: restore is refused, nothing is purged and the audit stays', async () => {
      await fixture()
      expect((await del(ownerId)).status).toBe(200)
      const before = await groupState()
      // окно истекло
      await db
        .update(organizations)
        .set({
          deletedAt: sql`now() - interval '31 days'`,
          restoreUntil: sql`now() - interval '1 day'`,
        })
        .where(eq(organizations.id, orgId))
      const res = await request('POST', `${base()}/restore`, { user: ownerId })
      expect(res.status).toBe(410)
      expect(code(res)).toBe('organization.restore_window_closed')
      const list = await request('GET', '/api/organizations', { user: ownerId })
      expect((list.body as { deletedOrganizations: { restorable: boolean }[] }).deletedOrganizations).toEqual([
        expect.objectContaining({ id: orgId, restorable: false }),
      ])
      // очистка не включена: данные и журнал на месте
      expect(await groupState()).toBe(before)
      const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      expect(audit.map((e) => e.action)).toContain('organization.deleted')
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
      expect(org!.deletedAt).not.toBeNull()
    })

    it('parallel deletes delete once; delete racing a transfer start never yields both', async () => {
      const results = await Promise.all([1, 2, 3].map(() => del(ownerId)))
      expect(results.map((r) => r.status).sort()).toEqual([200, 410, 410])
      expect(
        await db.select().from(auditLog).where(eq(auditLog.action, 'organization.deleted')),
      ).toHaveLength(1)
      await request('POST', `${base()}/restore`, { user: ownerId })

      for (let i = 0; i < 4; i++) {
        const [d, s] = await Promise.all([
          del(ownerId),
          request('POST', `${base()}/ownership-transfer`, {
            user: ownerId,
            body: { recipientMemberId: members.player },
          }),
        ])
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
        const pending = await db
          .select()
          .from(organizationOwnershipTransfers)
          .where(eq(organizationOwnershipTransfers.status, 'pending'))
        // либо группа удалена и передачи нет, либо передача ожидает и группа жива
        expect(org!.deletedAt !== null && pending.length === 0).toBe(d.status === 200)
        expect(pending.length === 1 && org!.deletedAt === null).toBe(s.status === 200)
        expect(d.status === 200 && s.status === 200).toBe(false)
        if (d.status === 200) await request('POST', `${base()}/restore`, { user: ownerId })
        else await request('DELETE', `${base()}/ownership-transfer`, { user: ownerId })
      }
    })

    it('restore is idempotent under parallel calls', async () => {
      await del(ownerId)
      const results = await Promise.all([1, 2, 3].map(() => request('POST', `${base()}/restore`, { user: ownerId })))
      expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409])
    })
  })
})
