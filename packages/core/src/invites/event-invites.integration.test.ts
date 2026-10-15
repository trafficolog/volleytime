import {
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  eventInviteRequests,
  events,
  inviteLinks,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { organizationSettingsService } from '../organizations/settings'

import { eventInviteRequestService, eventInviteService } from './event-invites'
import { inviteService } from './service'

/**
 * Task 20.1.3: режим записи события (наследование группа → событие), личное однократное
 * приглашение со сроком, запрос приглашения и ответ организатора. Запись на событие `invite` без
 * валидного приглашения отклоняет сервис под lock события — не только UI.
 */
describe('event join mode and invites (20.1.3, PostgreSQL)', () => {
  let ownerId: number
  let orgId: number
  const future = (h = 24) => new Date(Date.now() + h * 3600_000)

  async function player(): Promise<number> {
    const [u] = await db
      .insert(users)
      .values({ email: `p-${Math.random()}@t.by`, name: 'Игрок' })
      .returning()
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
    return u!.id
  }

  const makeEvent = (
    extra: { joinMode?: 'open' | 'invite'; capacity?: number; org?: number } = {},
  ) =>
    eventService.create({ userId: ownerId }, extra.org ?? orgId, {
      title: 'Игра',
      startsAt: future(),
      endsAt: future(26),
      capacity: extra.capacity ?? 10,
      price: 0,
      ...(extra.joinMode ? { joinMode: extra.joinMode } : {}),
    })

  const code = (p: Promise<unknown>) =>
    p.then(
      () => 'ok',
      (e: { code?: string }) => e.code ?? String(e),
    )

  const bookingCount = async (eventId: number) =>
    (await db.select().from(bookings).where(eq(bookings.eventId, eventId))).length

  beforeEach(async () => {
    vi.stubEnv('EVENT_INVITE_MODE_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by`, name: 'Owner' })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Invite' })).id
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('capability flag EVENT_INVITE_MODE_ENABLED', () => {
    it('without the flag invite mode cannot be written to an event or a group default', async () => {
      vi.stubEnv('EVENT_INVITE_MODE_ENABLED', 'false')
      expect(await code(makeEvent({ joinMode: 'invite' }))).toBe('event.invite_mode_disabled')
      expect(
        await code(
          organizationSettingsService.update({ userId: ownerId }, orgId, {
            defaultJoinMode: 'invite',
          }),
        ),
      ).toBe('organization.invalid_settings')
      // группа с умолчанием invite (записанным раньше) не создаёт событие «молча открытым»
      await db
        .update(organizations)
        .set({ defaultJoinMode: 'invite' })
        .where(eq(organizations.id, orgId))
      expect(await code(makeEvent())).toBe('event.invite_mode_disabled')
      expect((await makeEvent({ joinMode: 'open' })).joinMode).toBe('open')
      const ev = await makeEvent({ joinMode: 'open' })
      expect(
        await code(eventService.update({ userId: ownerId }, ev.id, { joinMode: 'invite' })),
      ).toBe('event.invite_mode_disabled')
    })
  })

  describe('inheritance group → event', () => {
    it('new event takes the group default and may override it', async () => {
      expect((await makeEvent()).joinMode).toBe('open')
      await organizationSettingsService.update({ userId: ownerId }, orgId, {
        defaultJoinMode: 'invite',
      })
      expect((await makeEvent()).joinMode).toBe('invite')
      expect((await makeEvent({ joinMode: 'open' })).joinMode).toBe('open')
    })

    it('changing the group setting does not change created events', async () => {
      const open = await makeEvent()
      await organizationSettingsService.update({ userId: ownerId }, orgId, {
        defaultJoinMode: 'invite',
      })
      const invite = await makeEvent()
      await organizationSettingsService.update({ userId: ownerId }, orgId, {
        defaultJoinMode: 'open',
      })
      const rows = await db.select({ id: events.id, joinMode: events.joinMode }).from(events)
      expect(Object.fromEntries(rows.map((r) => [r.id, r.joinMode]))).toEqual({
        [open.id]: 'open',
        [invite.id]: 'invite',
      })
    })

    it('join mode is independent of group page indexing (seoIndex)', async () => {
      await organizationSettingsService.update({ userId: ownerId }, orgId, { seoIndex: true })
      expect((await makeEvent()).joinMode).toBe('open')
      await organizationSettingsService.update({ userId: ownerId }, orgId, {
        defaultJoinMode: 'invite',
      })
      const s = await organizationSettingsService.get({ userId: ownerId }, orgId)
      expect(s).toMatchObject({ seoIndex: true, defaultJoinMode: 'invite' })
      await organizationSettingsService.update({ userId: ownerId }, orgId, { seoIndex: false })
      expect((await makeEvent()).joinMode).toBe('invite')
    })

    it('the event may switch its mode later (open ↔ invite)', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const p = await player()
      expect(await code(bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' }))).toBe(
        'booking.invite_required',
      )
      await eventService.update({ userId: ownerId }, ev.id, { joinMode: 'open' })
      expect(await code(bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' }))).toBe(
        'ok',
      )
    })
  })

  describe('booking on an invite event', () => {
    it('is impossible without a valid invite of this event', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const other = await makeEvent({ joinMode: 'invite' })
      const otherInvite = await eventInviteService.create({ userId: ownerId }, orgId, other.id)
      const orgInvite = await inviteService.create({ userId: ownerId }, { organizationId: orgId })
      const p = await player()
      for (const inviteToken of [
        undefined,
        'x'.repeat(21),
        otherInvite.invite.token,
        orgInvite.token,
      ]) {
        expect(
          await code(
            bookingService.book({ userId: p }, orgId, ev.id, {
              method: 'free',
              ...(inviteToken ? { inviteToken } : {}),
            }),
          ),
        ).toBe('booking.invite_required')
      }
      expect(await bookingCount(ev.id)).toBe(0)
      // приглашение чужого события не израсходовано
      const [row] = await db
        .select()
        .from(inviteLinks)
        .where(eq(inviteLinks.id, otherInvite.invite.id))
      expect(row!.usesCount).toBe(0)
    })

    it('a personal link is unguessable, expires with the event and is single-use', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const { invite, startParam } = await eventInviteService.create(
        { userId: ownerId },
        orgId,
        ev.id,
      )
      expect(invite.token).toMatch(/^[A-Za-z0-9_-]{21,}$/)
      expect(startParam).toBe(`event_${ev.id}_${invite.token}`)
      expect(startParam.length).toBeLessThanOrEqual(64)
      expect(invite).toMatchObject({ type: 'event_join', eventId: ev.id, maxUses: 1 })
      expect(invite.expiresAt!.getTime()).toBeLessThanOrEqual(ev.startsAt.getTime())

      const a = await player()
      const b = await player()
      const booking = await bookingService.book({ userId: a }, orgId, ev.id, {
        method: 'free',
        inviteToken: invite.token,
      })
      expect(booking.inviteId).toBe(invite.id)
      expect(
        await code(
          bookingService.book({ userId: b }, orgId, ev.id, {
            method: 'free',
            inviteToken: invite.token,
          }),
        ),
      ).toBe('booking.invite_required')

      // срок: короче, чем до начала события
      const short = await eventInviteService.create({ userId: ownerId }, orgId, ev.id, {
        expiresInHours: 1,
      })
      expect(short.invite.expiresAt!.getTime()).toBeLessThan(Date.now() + 3600_000 + 5_000)
      await db
        .update(inviteLinks)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(inviteLinks.id, short.invite.id))
      expect(
        await code(
          bookingService.book({ userId: b }, orgId, ev.id, {
            method: 'free',
            inviteToken: short.invite.token,
          }),
        ),
      ).toBe('invite.expired')

      // отозванное приглашение — как отсутствующее
      const revoked = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      await inviteService.revoke({ userId: ownerId }, orgId, revoked.invite.id)
      expect(
        await code(
          bookingService.book({ userId: b }, orgId, ev.id, {
            method: 'free',
            inviteToken: revoked.invite.token,
          }),
        ),
      ).toBe('booking.invite_required')
    })

    it('a failed booking does not burn the invite (one transaction)', async () => {
      vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
      const ev = await makeEvent({ joinMode: 'invite', capacity: 1 })
      const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      const p = await player()
      expect(
        await code(
          bookingService.book({ userId: p }, orgId, ev.id, {
            method: 'free',
            seats: 2,
            inviteToken: invite.token,
          }),
        ),
      ).toBe('booking.seats_over_limit')
      const [row] = await db.select().from(inviteLinks).where(eq(inviteLinks.id, invite.id))
      expect(row!.usesCount).toBe(0)
      expect(
        await code(
          bookingService.book({ userId: p }, orgId, ev.id, {
            method: 'free',
            inviteToken: invite.token,
          }),
        ),
      ).toBe('ok')
    })

    it('the invited player may rebook after cancelling without a new invite', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      const p = await player()
      const b = await bookingService.book({ userId: p }, orgId, ev.id, {
        method: 'free',
        inviteToken: invite.token,
      })
      await bookingService.cancel({ userId: p }, b.id)
      const again = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' })
      expect(again).toMatchObject({ id: b.id, status: 'confirmed', inviteId: invite.id })
    })

    it('rebook re-checks the stored invite: not after admin cancel, not revoked, not expired', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const bookWith = async (p: number) => {
        const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
        return bookingService.book({ userId: p }, orgId, ev.id, {
          method: 'free',
          inviteToken: invite.token,
        })
      }
      const rebook = (p: number) =>
        code(bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' }))

      // отмена организатором — повторная запись без нового приглашения запрещена (даже с отзывом)
      const a = await player()
      const ba = await bookWith(a)
      await bookingService.cancel({ userId: ownerId }, ba.id, { byAdmin: true })
      expect(await rebook(a)).toBe('booking.invite_required')
      await inviteService.revoke({ userId: ownerId }, orgId, ba.inviteId!)
      expect(await rebook(a)).toBe('booking.invite_required')

      // своя отмена → можно; отозванное после отмены приглашение → нельзя
      const b = await player()
      const bb = await bookWith(b)
      await bookingService.cancel({ userId: b }, bb.id)
      expect(await rebook(b)).toBe('ok')
      await bookingService.cancel({ userId: b }, bb.id)
      await inviteService.revoke({ userId: ownerId }, orgId, bb.inviteId!)
      expect(await rebook(b)).toBe('booking.invite_required')

      // истёкшее приглашение → ссылка просрочена
      const c = await player()
      const bc = await bookWith(c)
      await bookingService.cancel({ userId: c }, bc.id)
      await db
        .update(inviteLinks)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(inviteLinks.id, bc.inviteId!))
      expect(await rebook(c)).toBe('invite.expired')
      // новое приглашение снова пускает
      const fresh = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      expect(
        await code(
          bookingService.book({ userId: c }, orgId, ev.id, {
            method: 'free',
            inviteToken: fresh.invite.token,
          }),
        ),
      ).toBe('ok')
    })

    it('owner and organizer book themselves without an invite; assistant and player do not', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const role = async (r: 'organizer' | 'assistant') => {
        const [u] = await db
          .insert(users)
          .values({ email: `${r}-${Math.random()}@t.by` })
          .returning()
        await memberService.add(
          { userId: ownerId },
          { organizationId: orgId, userId: u!.id, role: r },
        )
        return u!.id
      }
      const organizer = await role('organizer')
      const assistant = await role('assistant')
      const own = await bookingService.book({ userId: ownerId }, orgId, ev.id, { method: 'free' })
      expect(own).toMatchObject({ userId: ownerId, inviteId: null, status: 'confirmed' })
      const org = await bookingService.book({ userId: organizer }, orgId, ev.id, { method: 'free' })
      expect(org).toMatchObject({ userId: organizer, inviteId: null })
      expect(
        await code(bookingService.book({ userId: assistant }, orgId, ev.id, { method: 'free' })),
      ).toBe('booking.invite_required')
      expect(
        await code(
          bookingService.book({ userId: await player() }, orgId, ev.id, { method: 'free' }),
        ),
      ).toBe('booking.invite_required')
      // записи созданы только за самих управляющих
      const rows = await db.select().from(bookings).where(eq(bookings.eventId, ev.id))
      expect(rows.map((r) => r.userId).sort()).toEqual([ownerId, organizer].sort())
    })

    it('event invites would only create a pending application in an old redeem (I-2)', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      expect(invite.defaultMemberStatus).toBe('pending')
      const p = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      const approved = await eventInviteRequestService.approve(
        { userId: ownerId },
        orgId,
        ev.id,
        req.id,
      )
      const [issued] = await db
        .select()
        .from(inviteLinks)
        .where(eq(inviteLinks.id, approved.inviteId!))
      expect(issued!.defaultMemberStatus).toBe('pending')
    })

    it('event invite tokens never work as group invites', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      const [stranger] = await db
        .insert(users)
        .values({ email: `s-${Math.random()}@t.by` })
        .returning()
      expect(await code(inviteService.redeem({ userId: stranger!.id }, invite.token))).toBe(
        'invite.not_found',
      )
      expect((await inviteService.preview({ userId: stranger!.id }, invite.token)).status).toBe(
        'not_found',
      )
      expect(await code(inviteService.getValidByToken({ userId: ownerId }, invite.token))).toBe(
        'invite.not_found',
      )
      expect(
        (await inviteService.listByOrg({ userId: ownerId }, orgId)).map((i) => i.id),
      ).not.toContain(invite.id)
    })

    it('invites are issued only for invite events of this group that are still ahead', async () => {
      const open = await makeEvent()
      expect(await code(eventInviteService.create({ userId: ownerId }, orgId, open.id))).toBe(
        'event.join_mode_open',
      )
      const [u2] = await db
        .insert(users)
        .values({ email: `o2-${Math.random()}@t.by` })
        .returning()
      const org2 = (await organizationService.create({ userId: u2!.id }, { name: 'Other' })).id
      const foreign = await eventService.create({ userId: u2!.id }, org2, {
        title: 'Чужое',
        startsAt: future(),
        endsAt: future(26),
        capacity: 5,
        price: 0,
        joinMode: 'invite',
      })
      expect(await code(eventInviteService.create({ userId: ownerId }, orgId, foreign.id))).toBe(
        'event.not_found',
      )
      const cancelled = await makeEvent({ joinMode: 'invite' })
      await eventService.cancel({ userId: ownerId }, cancelled.id)
      expect(await code(eventInviteService.create({ userId: ownerId }, orgId, cancelled.id))).toBe(
        'booking.event_not_bookable',
      )
    })
  })

  describe('invite requests', () => {
    it('player requests, organizer approves, player books with the issued invite', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const p = await player()
      expect(await eventInviteRequestService.mine({ userId: p }, ev.id)).toBeNull()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id, {
        message: 'Можно?',
      })
      expect(req).toMatchObject({ status: 'pending', userId: p, eventId: ev.id })
      expect(await code(eventInviteRequestService.request({ userId: p }, orgId, ev.id))).toBe(
        'invite_request.already_pending',
      )
      expect(await eventInviteRequestService.mine({ userId: p }, ev.id)).toMatchObject({
        id: req.id,
        status: 'pending',
      })

      const list = await eventInviteRequestService.list({ userId: ownerId }, orgId, ev.id)
      expect(list).toHaveLength(1)
      expect(list[0]!.user).toEqual({
        id: p,
        name: 'Игрок',
        telegramUsername: null,
        image: null,
      })
      expect(JSON.stringify(list)).not.toContain('@t.by')

      const approved = await eventInviteRequestService.approve(
        { userId: ownerId },
        orgId,
        ev.id,
        req.id,
      )
      expect(approved).toMatchObject({ status: 'approved', decidedByUserId: ownerId })
      expect(approved.inviteId).not.toBeNull()
      expect(
        await code(eventInviteRequestService.approve({ userId: ownerId }, orgId, ev.id, req.id)),
      ).toBe('invite_request.not_pending')
      expect(await eventInviteRequestService.mine({ userId: p }, ev.id)).toMatchObject({
        status: 'approved',
      })

      // одобренный игрок записывается без токена: приглашение выдано ему лично
      const booking = await bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' })
      expect(booking.inviteId).toBe(approved.inviteId)
      // приглашение одобренного запроса не работает для другого игрока без токена
      const other = await player()
      expect(
        await code(bookingService.book({ userId: other }, orgId, ev.id, { method: 'free' })),
      ).toBe('booking.invite_required')

      const actions = (await db.select().from(auditLog)).map((a) => a.action)
      expect(actions).toEqual(
        expect.arrayContaining(['event_invite_request.created', 'event_invite_request.approved']),
      )
    })

    it('declined request gives no access; player may ask again', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const p = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      const declined = await eventInviteRequestService.decline(
        { userId: ownerId },
        orgId,
        ev.id,
        req.id,
      )
      expect(declined).toMatchObject({ status: 'declined', inviteId: null })
      expect(await code(bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' }))).toBe(
        'booking.invite_required',
      )
      expect(await code(eventInviteRequestService.request({ userId: p }, orgId, ev.id))).toBe('ok')
    })

    it('rejects requests that make no sense and hides foreign ids', async () => {
      const open = await makeEvent()
      const ev = await makeEvent({ joinMode: 'invite' })
      const other = await makeEvent({ joinMode: 'invite' })
      const p = await player()
      expect(await code(eventInviteRequestService.request({ userId: p }, orgId, open.id))).toBe(
        'event.join_mode_open',
      )
      const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      await bookingService.book({ userId: p }, orgId, ev.id, {
        method: 'free',
        inviteToken: invite.token,
      })
      expect(await code(eventInviteRequestService.request({ userId: p }, orgId, ev.id))).toBe(
        'booking.already_booked',
      )

      const q = await player()
      const req = await eventInviteRequestService.request({ userId: q }, orgId, ev.id)
      // запрос другого события по пути этого — 404
      expect(
        await code(eventInviteRequestService.approve({ userId: ownerId }, orgId, other.id, req.id)),
      ).toBe('invite_request.not_found')
      expect(
        await code(eventInviteRequestService.decline({ userId: ownerId }, orgId, ev.id, 999999)),
      ).toBe('invite_request.not_found')
      // событие другой группы
      const [u2] = await db
        .insert(users)
        .values({ email: `o3-${Math.random()}@t.by` })
        .returning()
      const org2 = (await organizationService.create({ userId: u2!.id }, { name: 'Group B' })).id
      expect(await code(eventInviteRequestService.list({ userId: u2!.id }, org2, ev.id))).toBe(
        'event.not_found',
      )
      expect(
        await code(eventInviteRequestService.approve({ userId: u2!.id }, org2, ev.id, req.id)),
      ).toBe('event.not_found')
      const [row] = await db
        .select()
        .from(eventInviteRequests)
        .where(eq(eventInviteRequests.id, req.id))
      expect(row!.status).toBe('pending')
    })
  })

  describe('concurrency', () => {
    it('a single-use link admits exactly one of many parallel bookings', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      const ids = await Promise.all(Array.from({ length: 6 }, () => player()))
      const results = await Promise.all(
        ids.map((userId) =>
          code(
            bookingService.book({ userId }, orgId, ev.id, {
              method: 'free',
              inviteToken: invite.token,
            }),
          ),
        ),
      )
      expect(results.filter((r) => r === 'ok')).toHaveLength(1)
      expect(results.filter((r) => r === 'booking.invite_required')).toHaveLength(5)
      expect(await bookingCount(ev.id)).toBe(1)
      const [row] = await db.select().from(inviteLinks).where(eq(inviteLinks.id, invite.id))
      expect(row!.usesCount).toBe(1)
    })

    it('parallel approve and decline of one request settle exactly once', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const p = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      const results = await Promise.all([
        code(eventInviteRequestService.approve({ userId: ownerId }, orgId, ev.id, req.id)),
        code(eventInviteRequestService.approve({ userId: ownerId }, orgId, ev.id, req.id)),
        code(eventInviteRequestService.decline({ userId: ownerId }, orgId, ev.id, req.id)),
      ])
      expect(results.filter((r) => r === 'ok')).toHaveLength(1)
      expect(results.filter((r) => r === 'invite_request.not_pending')).toHaveLength(2)
      const issued = await db.select().from(inviteLinks).where(eq(inviteLinks.eventId, ev.id))
      const [row] = await db
        .select()
        .from(eventInviteRequests)
        .where(eq(eventInviteRequests.id, req.id))
      expect(issued).toHaveLength(row!.status === 'approved' ? 1 : 0)
    })

    it('parallel requests of one player leave one pending request', async () => {
      const ev = await makeEvent({ joinMode: 'invite' })
      const p = await player()
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          code(eventInviteRequestService.request({ userId: p }, orgId, ev.id)),
        ),
      )
      expect(results.filter((r) => r === 'ok')).toHaveLength(1)
      expect(results.filter((r) => r === 'invite_request.already_pending')).toHaveLength(3)
    })

    it('switching the event to invite serializes with bookings under the event lock', async () => {
      const ev = await makeEvent()
      const ids = await Promise.all(Array.from({ length: 5 }, () => player()))
      const switching = eventService.update({ userId: ownerId }, ev.id, { joinMode: 'invite' })
      const results = await Promise.all(
        ids.map((userId) =>
          code(bookingService.book({ userId }, orgId, ev.id, { method: 'free' })),
        ),
      )
      const switched = await switching
      // каждая принятая запись без приглашения создана до переключения режима
      const rows = await db.select().from(bookings).where(eq(bookings.eventId, ev.id))
      expect(rows).toHaveLength(results.filter((r) => r === 'ok').length)
      for (const r of rows)
        expect(r.bookedAt.getTime()).toBeLessThanOrEqual(switched.updatedAt.getTime())
      expect(results.every((r) => r === 'ok' || r === 'booking.invite_required')).toBe(true)
    })
  })
})
