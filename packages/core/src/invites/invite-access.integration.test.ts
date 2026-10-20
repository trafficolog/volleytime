import {
  bookings,
  closeDb,
  db,
  eq,
  eventInviteRequests,
  inviteLinks,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { auditService } from '../audit/service'
import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import type { PendingNotification } from '../notifier/types'
import { organizationService } from '../organizations/service'

import { eventInviteRequestService, eventInviteService } from './event-invites'

/**
 * Task 20.4.7: состояния записи по приглашению для Mini App (D-06) — «без приглашения», «запрос
 * отправлен», «приглашён», «ссылка просрочена»; отзыв своего запроса; уведомления организатору и
 * игроку. Миграций нет: статус `cancelled` и поля приглашения заложены 20.1.3 (0026).
 */
describe('invite access for the Mini App (20.4.7, PostgreSQL)', () => {
  let ownerId: number
  let organizerId: number
  let orgId: number
  const hours = (h: number) => new Date(Date.now() + h * 3600_000)

  async function user(name: string, extra: { username?: string } = {}): Promise<number> {
    const [u] = await db
      .insert(users)
      .values({
        email: `u-${Math.random()}@t.by`,
        name,
        telegramUsername: extra.username ?? null,
      })
      .returning()
    return u!.id
  }
  async function player(name = 'Игрок'): Promise<number> {
    const id = await user(name)
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: id })
    return id
  }
  const makeEvent = (extra: { joinMode?: 'open' | 'invite'; by?: number } = {}) =>
    eventService.create({ userId: extra.by ?? organizerId }, orgId, {
      title: 'Основа',
      startsAt: hours(48),
      endsAt: hours(50),
      capacity: 10,
      price: 0,
      joinMode: extra.joinMode ?? 'invite',
    })
  const code = (p: Promise<unknown>) =>
    p.then(
      () => 'ok',
      (e: { code?: string }) => e.code ?? String(e),
    )
  const access = (userId: number, eventId: number, inviteToken?: string) =>
    eventInviteService.access({ userId }, orgId, eventId, { inviteToken })

  beforeEach(async () => {
    vi.stubEnv('EVENT_INVITE_MODE_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await user('Owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Access' })).id
    organizerId = await user('Иван Петренко', { username: 'ivan_p' })
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: organizerId, role: 'organizer' },
    )
  })
  afterEach(() => vi.unstubAllEnvs())
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('cancel (withdraw own request)', () => {
    it('player withdraws a pending request and may ask again', async () => {
      const ev = await makeEvent()
      const p = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      const cancelled = await eventInviteRequestService.cancel({ userId: p }, orgId, ev.id, req.id)
      expect(cancelled).toMatchObject({ id: req.id, status: 'cancelled', inviteId: null })
      expect((await access(p, ev.id)).state).toBe('none')
      expect(await code(eventInviteRequestService.request({ userId: p }, orgId, ev.id))).toBe('ok')
      const actions = await db.query.auditLog.findMany()
      expect(actions.map((a) => a.action)).toContain('event_invite_request.cancelled')
    })

    it('only the author, only while pending, only inside this group and event', async () => {
      const ev = await makeEvent()
      const other = await makeEvent()
      const p = await player()
      const q = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      // чужой запрос неотличим от несуществующего
      expect(
        await code(eventInviteRequestService.cancel({ userId: q }, orgId, ev.id, req.id)),
      ).toBe('invite_request.not_found')
      // запрос другого события по пути этого
      expect(
        await code(eventInviteRequestService.cancel({ userId: p }, orgId, other.id, req.id)),
      ).toBe('invite_request.not_found')
      expect(
        await code(eventInviteRequestService.cancel({ userId: p }, orgId, ev.id, 999999)),
      ).toBe('invite_request.not_found')
      // другая группа
      const u2 = await user('O2')
      const org2 = (await organizationService.create({ userId: u2 }, { name: 'Group B' })).id
      expect(await code(eventInviteRequestService.cancel({ userId: p }, org2, ev.id, req.id))).toBe(
        'event.not_found',
      )
      const [row] = await db
        .select()
        .from(eventInviteRequests)
        .where(eq(eventInviteRequests.id, req.id))
      expect(row!.status).toBe('pending')

      await eventInviteRequestService.approve({ userId: ownerId }, orgId, ev.id, req.id)
      expect(
        await code(eventInviteRequestService.cancel({ userId: p }, orgId, ev.id, req.id)),
      ).toBe('invite_request.not_pending')
    })

    it('withdrawal and the organizer decision settle exactly once', async () => {
      const ev = await makeEvent()
      const p = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      const results = await Promise.all([
        code(eventInviteRequestService.cancel({ userId: p }, orgId, ev.id, req.id)),
        code(eventInviteRequestService.approve({ userId: ownerId }, orgId, ev.id, req.id)),
      ])
      expect(results.filter((r) => r === 'ok')).toHaveLength(1)
      expect(results.filter((r) => r === 'invite_request.not_pending')).toHaveLength(1)
      const issued = await db.select().from(inviteLinks).where(eq(inviteLinks.eventId, ev.id))
      const [row] = await db
        .select()
        .from(eventInviteRequests)
        .where(eq(eventInviteRequests.id, req.id))
      expect(issued).toHaveLength(row!.status === 'approved' ? 1 : 0)
    })
  })

  describe('access state', () => {
    it('none: no invite, no request — with the organizer who decides', async () => {
      const ev = await makeEvent()
      const p = await player()
      expect(await access(p, ev.id)).toEqual({
        state: 'none',
        request: null,
        invite: null,
        organizer: { name: 'Иван Петренко', telegramUsername: 'ivan_p', image: null },
      })
    })

    it('requested: pending request with its time; declined and cancelled go back to none', async () => {
      const ev = await makeEvent()
      const p = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      const asked = await access(p, ev.id)
      expect(asked.state).toBe('requested')
      expect(asked.request).toEqual({
        id: req.id,
        status: 'pending',
        createdAt: req.createdAt,
      })
      await eventInviteRequestService.decline({ userId: ownerId }, orgId, ev.id, req.id)
      const declined = await access(p, ev.id)
      expect(declined.state).toBe('none')
      expect(declined.request).toMatchObject({ status: 'declined' })
    })

    it('invited by a personal link: expiry and the inviter name, token is not echoed', async () => {
      const ev = await makeEvent()
      const p = await player()
      const { invite } = await eventInviteService.create({ userId: organizerId }, orgId, ev.id, {
        expiresInHours: 5,
      })
      const view = await access(p, ev.id, invite.token)
      expect(view.state).toBe('invited')
      expect(view.invite).toEqual({
        source: 'link',
        expiresAt: invite.expiresAt,
        inviter: { name: 'Иван Петренко', telegramUsername: 'ivan_p', image: null },
      })
      expect(JSON.stringify(view)).not.toContain(invite.token)
      // без токена та же ссылка ничего не даёт; просмотр не расходует приглашение
      expect((await access(p, ev.id)).state).toBe('none')
      const [row] = await db.select().from(inviteLinks).where(eq(inviteLinks.id, invite.id))
      expect(row!.usesCount).toBe(0)
      expect(
        await bookingService
          .book({ userId: p }, orgId, ev.id, { method: 'free', inviteToken: invite.token })
          .then((b) => b.inviteId),
      ).toBe(invite.id)
    })

    it('invited by an approved request: no token needed, inviter is who approved', async () => {
      const ev = await makeEvent()
      const p = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      const approved = await eventInviteRequestService.approve(
        { userId: ownerId },
        orgId,
        ev.id,
        req.id,
      )
      const view = await access(p, ev.id)
      expect(view.state).toBe('invited')
      expect(view.invite).toMatchObject({ source: 'request', inviter: { name: 'Owner' } })
      expect(view.request).toMatchObject({ id: req.id, status: 'approved' })
      expect(approved.inviteId).not.toBeNull()
      // состояние «приглашён» ⇒ запись проходит без токена
      await expect(
        bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' }),
      ).resolves.toMatchObject({ inviteId: approved.inviteId })
    })

    it('expired: an elapsed link of this event shows the expiry date, booking agrees', async () => {
      const ev = await makeEvent()
      const p = await player()
      const { invite } = await eventInviteService.create({ userId: organizerId }, orgId, ev.id)
      const expiresAt = new Date(Date.now() - 3600_000)
      await db.update(inviteLinks).set({ expiresAt }).where(eq(inviteLinks.id, invite.id))
      const view = await access(p, ev.id, invite.token)
      expect(view.state).toBe('expired')
      expect(view.invite).toMatchObject({ expiresAt, inviter: { name: 'Иван Петренко' } })
      expect(
        await code(
          bookingService.book({ userId: p }, orgId, ev.id, {
            method: 'free',
            inviteToken: invite.token,
          }),
        ),
      ).toBe('invite.expired')
    })

    it('expired: an approved invite that elapsed before the player booked', async () => {
      const ev = await makeEvent()
      const p = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      const approved = await eventInviteRequestService.approve(
        { userId: ownerId },
        orgId,
        ev.id,
        req.id,
      )
      await db
        .update(inviteLinks)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(inviteLinks.id, approved.inviteId!))
      expect((await access(p, ev.id)).state).toBe('expired')
      expect(await code(bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' }))).toBe(
        'invite.expired',
      )
    })

    it('a new pending request wins over an expired link: the player already asked', async () => {
      const ev = await makeEvent()
      const p = await player()
      const { invite } = await eventInviteService.create({ userId: organizerId }, orgId, ev.id)
      await db
        .update(inviteLinks)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(inviteLinks.id, invite.id))
      await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      expect((await access(p, ev.id, invite.token)).state).toBe('requested')
    })

    it('revoked, used, foreign-event and unknown tokens show nothing (no oracle)', async () => {
      const ev = await makeEvent()
      const other = await makeEvent()
      const p = await player()
      const q = await player()
      const { invite: revoked } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      await db.update(inviteLinks).set({ isRevoked: true }).where(eq(inviteLinks.id, revoked.id))
      const { invite: used } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      await bookingService.book({ userId: q }, orgId, ev.id, {
        method: 'free',
        inviteToken: used.token,
      })
      const { invite: foreign } = await eventInviteService.create(
        { userId: ownerId },
        orgId,
        other.id,
      )
      for (const token of [revoked.token, used.token, foreign.token, 'x'.repeat(24)]) {
        const view = await access(p, ev.id, token)
        expect(view, token).toMatchObject({ state: 'none', invite: null })
        expect(JSON.stringify(view)).not.toContain(token)
      }
    })

    it('self-cancelled booking keeps the stored invite; organizer cancel does not (D-06 B)', async () => {
      const ev = await makeEvent()
      const p = await player()
      const q = await player()
      const issue = async (userId: number) => {
        const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
        const b = await bookingService.book({ userId }, orgId, ev.id, {
          method: 'free',
          inviteToken: invite.token,
        })
        return { invite, bookingId: b.id }
      }
      const mine = await issue(p)
      const theirs = await issue(q)
      await bookingService.cancel({ userId: p }, mine.bookingId)
      await bookingService.cancel({ userId: ownerId }, theirs.bookingId, { byAdmin: true })
      const again = await access(p, ev.id)
      expect(again.state).toBe('invited')
      expect(again.invite).toMatchObject({ source: 'previous', expiresAt: mine.invite.expiresAt })
      expect((await access(q, ev.id)).state).toBe('none')
      await expect(
        bookingService.book({ userId: p }, orgId, ev.id, { method: 'free' }),
      ).resolves.toBeTruthy()
    })

    it('open events have no invite access; foreign group and drafts are 404', async () => {
      const open = await makeEvent({ joinMode: 'open' })
      const p = await player()
      expect(await code(access(p, open.id))).toBe('event.join_mode_open')
      const draft = await eventService.create({ userId: ownerId }, orgId, {
        title: 'Черновик',
        startsAt: hours(48),
        endsAt: hours(50),
        capacity: 5,
        price: 0,
        joinMode: 'invite',
        status: 'draft',
      })
      expect(await code(access(p, draft.id))).toBe('event.not_found')
      const u2 = await user('O2')
      const org2 = (await organizationService.create({ userId: u2 }, { name: 'Group B' })).id
      const ev = await makeEvent()
      expect(await code(eventInviteService.access({ userId: u2 }, org2, ev.id, {}))).toBe(
        'event.not_found',
      )
    })

    it('a booked player does not need an invite: the state is not shown as an invite', async () => {
      const ev = await makeEvent()
      const p = await player()
      const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
      await bookingService.book({ userId: p }, orgId, ev.id, {
        method: 'free',
        inviteToken: invite.token,
      })
      const rows = await db.select().from(bookings).where(eq(bookings.eventId, ev.id))
      expect(rows).toHaveLength(1)
      // приглашение использовано, активная запись — отдельное состояние экрана, не «приглашён»
      expect((await access(p, ev.id)).state).toBe('none')
    })
  })

  describe('notifications', () => {
    const collector = () => {
      const notifications: PendingNotification[] = []
      return { notifications, ctx: (userId: number) => ({ userId, notifications }) }
    }

    it('request tells owner and organizers (not the requester) once, with the player name', async () => {
      const ev = await makeEvent()
      const p = await player('Соня')
      const c = collector()
      const req = await eventInviteRequestService.request(c.ctx(p), orgId, ev.id)
      expect(c.notifications.map((n) => [n.userId, n.type]).sort()).toEqual(
        [
          [ownerId, 'invite_request_organizer'],
          [organizerId, 'invite_request_organizer'],
        ].sort(),
      )
      for (const n of c.notifications) {
        expect(n.params).toMatchObject({
          eventId: ev.id,
          organizationId: orgId,
          eventTitle: 'Основа',
          playerName: 'Соня',
        })
        expect(n.dedupKey).toBe(`invite_request_organizer:request:${req.id}:user:${n.userId}`)
      }
      // организатор-игрок не получает уведомление о собственном запросе
      const c2 = collector()
      const ev2 = await makeEvent()
      await eventInviteRequestService.request(c2.ctx(organizerId), orgId, ev2.id)
      expect(c2.notifications.map((n) => n.userId)).toEqual([ownerId])
    })

    it('the answer goes to the player; withdrawal and failed requests notify nobody', async () => {
      const ev = await makeEvent()
      const p = await player()
      const req = await eventInviteRequestService.request({ userId: p }, orgId, ev.id)
      const approve = collector()
      await eventInviteRequestService.approve(approve.ctx(ownerId), orgId, ev.id, req.id)
      expect(approve.notifications).toHaveLength(1)
      expect(approve.notifications[0]).toMatchObject({
        userId: p,
        type: 'invite_request_decided',
        params: { eventId: ev.id, inviteApproved: true, organizationId: orgId },
      })

      const q = await player()
      const req2 = await eventInviteRequestService.request({ userId: q }, orgId, ev.id)
      const decline = collector()
      await eventInviteRequestService.decline(decline.ctx(ownerId), orgId, ev.id, req2.id)
      expect(decline.notifications[0]).toMatchObject({
        userId: q,
        type: 'invite_request_decided',
        params: { inviteApproved: false },
      })
      // повторное решение не шлёт второго уведомления
      const again = collector()
      await code(eventInviteRequestService.decline(again.ctx(ownerId), orgId, ev.id, req2.id))
      expect(again.notifications).toHaveLength(0)

      const r = await player()
      const c = collector()
      const req3 = await eventInviteRequestService.request({ userId: r }, orgId, ev.id)
      await eventInviteRequestService.cancel(c.ctx(r), orgId, ev.id, req3.id)
      expect(c.notifications).toHaveLength(0)
      const dup = collector()
      await code(eventInviteRequestService.request(dup.ctx(r), orgId, ev.id))
      await code(eventInviteRequestService.request(dup.ctx(r), orgId, ev.id))
      expect(dup.notifications.filter((n) => n.type === 'invite_request_organizer')).toHaveLength(2)
    })
  })

  it('audit keeps the latest booking cancel author for the stored-invite rule', async () => {
    const ev = await makeEvent()
    const p = await player()
    const { invite } = await eventInviteService.create({ userId: ownerId }, orgId, ev.id)
    const b = await bookingService.book({ userId: p }, orgId, ev.id, {
      method: 'free',
      inviteToken: invite.token,
    })
    await bookingService.cancel({ userId: p }, b.id)
    expect(await auditService.latest({ userId: p }, 'booking', b.id, 'booking.cancelled')).not.toBe(
      null,
    )
  })
})
