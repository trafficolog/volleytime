import {
  auditLog,
  closeDb,
  db,
  eq,
  organizationMembers,
  organizations,
  organizationTelegramChats,
  telegramChatLinkCodes,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { DeliveryError, setNotifierTransport, type NotifyPayload } from '../notifier'
import { organizationService } from '../organizations/service'

import { hashLinkCode } from './code'
import { telegramChatService } from './service'

/**
 * Task 20.3.4: привязка Telegram-чата к группе по одноразовому коду и анонс события в чат.
 * Бот проверяет администратора чата; здесь — правила web: код привязан к группе, одноразовый и с TTL,
 * один чат — одна группа, недействительность по `my_chat_member`, анонс только в действующий чат.
 */
describe('telegram chat link (20.3.4, PostgreSQL)', () => {
  let ownerId: number
  let organizerId: number
  let orgId: number
  let otherOrgId: number
  let otherOwnerId: number
  const sent: NotifyPayload[] = []
  const send = vi.fn(async (p: NotifyPayload) => {
    sent.push(p)
  })

  const claimInput = (code: string, over: Record<string, unknown> = {}) => ({
    verdict: 'admin' as const,
    code,
    chatId: '-1001000000001',
    chatType: 'supergroup' as const,
    title: 'Чат «Основа»',
    botCanPost: true,
    confirmedByTelegramId: '777001',
    ...over,
  })

  const newUser = async (name: string) =>
    (
      await db
        .insert(users)
        .values({ email: `${name}-${Math.random()}@t.by`, name })
        .returning()
    )[0]!.id

  const future = (h = 24) => new Date(Date.now() + h * 3600_000)
  const makeEvent = (org = orgId, owner = ownerId, extra: Record<string, unknown> = {}) =>
    eventService.create({ userId: owner }, org, {
      title: 'Основа',
      startsAt: future(),
      endsAt: future(26),
      capacity: 10,
      price: 0,
      ...extra,
    })

  /** Выдать код и привязать чат: готовая привязка группы. */
  async function linkChat(chatId = '-1001000000001', org = orgId, by = ownerId) {
    const { code } = await telegramChatService.issueCode({ userId: by }, org)
    const res = await telegramChatService.claim(claimInput(code, { chatId }))
    expect(res.outcome).toBe('linked')
  }

  const linkRow = async (org = orgId) => {
    const rows = await db
      .select()
      .from(organizationTelegramChats)
      .where(eq(organizationTelegramChats.organizationId, org))
    return rows.find((r) => r.status !== 'unlinked') ?? rows[0]
  }
  const kick = (chatId = '-1001000000001', status: 'kicked' | 'left' = 'kicked') =>
    telegramChatService.syncBotMembership({
      chatId,
      chatType: 'supergroup',
      status,
      canPost: false,
    })

  const errCode = (p: Promise<unknown>) =>
    p.then(
      () => 'ok',
      (e: { code?: string }) => e.code ?? String(e),
    )

  beforeEach(async () => {
    sent.length = 0
    send.mockClear()
    send.mockImplementation(async (p: NotifyPayload) => {
      sent.push(p)
    })
    setNotifierTransport({ send })
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    otherOwnerId = await newUser('owner2')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Группа А' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Группа Б' }))
      .id
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: organizerId, role: 'organizer' },
    )
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('issuing a code', () => {
    it('returns the code once, stores only its hash and writes the audit without the code', async () => {
      const { code, expiresAt } = await telegramChatService.issueCode(
        { userId: organizerId },
        orgId,
      )
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
      const ttl = expiresAt.getTime() - Date.now()
      expect(ttl).toBeGreaterThan(14 * 60_000)
      expect(ttl).toBeLessThanOrEqual(15 * 60_000)

      const rows = await db.select().from(telegramChatLinkCodes)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.codeHash).toBe(hashLinkCode(code.replace('-', '')))
      expect(JSON.stringify(rows)).not.toContain(code.replace('-', ''))
      expect(rows[0]!.createdByUserId).toBe(organizerId)

      const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      const issued = audit.filter((a) => a.action === 'telegram_chat.code_issued')
      expect(issued).toHaveLength(1)
      expect(JSON.stringify(audit)).not.toContain(code.replace('-', ''))

      const status = await telegramChatService.status({ userId: organizerId }, orgId)
      expect(status.pendingCode?.expiresAt).toEqual(expiresAt)
      expect(JSON.stringify(status)).not.toContain(code.replace('-', ''))
    })

    it('a new code revokes the previous unused one', async () => {
      const first = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      const second = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      expect((await telegramChatService.claim(claimInput(first.code))).outcome).toBe('code_invalid')
      expect((await telegramChatService.claim(claimInput(second.code))).outcome).toBe('linked')
    })

    it('refuses while the group already has a chat; allowed again after unlinking', async () => {
      await linkChat()
      expect(await errCode(telegramChatService.issueCode({ userId: ownerId }, orgId))).toBe(
        'telegram_chat.group_has_chat',
      )
      await telegramChatService.unlink({ userId: ownerId }, orgId)
      expect(await errCode(telegramChatService.issueCode({ userId: ownerId }, orgId))).toBe('ok')
    })
  })

  describe('claiming a code (bot, group admin already verified)', () => {
    it('links the chat to the group that issued the code and records who confirmed', async () => {
      const { code } = await telegramChatService.issueCode({ userId: organizerId }, orgId)
      const res = await telegramChatService.claim(claimInput(code.toLowerCase()))
      expect(res).toEqual({ outcome: 'linked', organizationName: 'Группа А', botCanPost: true })

      const row = (await linkRow())!
      expect(row.status).toBe('active')
      expect(row.telegramChatId).toBe(-1001000000001n)
      expect(row.confirmedByTelegramId).toBe(777001n)
      expect(row.linkedByUserId).toBe(organizerId)
      expect(await linkRow(otherOrgId)).toBeUndefined()

      const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      const linked = audit.filter((a) => a.action === 'telegram_chat.linked')
      expect(linked).toHaveLength(1)
      expect(linked[0]!.userId).toBe(organizerId)
      // Telegram id администратора чата и код в журнал не попадают
      expect(JSON.stringify(audit)).not.toContain('777001')
      expect(JSON.stringify(audit)).not.toContain(code.replace('-', ''))
    })

    it('stores that the bot cannot post and shows it to the organizer', async () => {
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      await telegramChatService.claim(claimInput(code, { botCanPost: false }))
      const status = await telegramChatService.status({ userId: ownerId }, orgId)
      expect(status.link).toMatchObject({ status: 'active', botCanPost: false })
    })

    it('the code is one-time: a second use does nothing, even for another chat', async () => {
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('linked')
      await telegramChatService.unlink({ userId: ownerId }, orgId)
      expect(
        (await telegramChatService.claim(claimInput(code, { chatId: '-1001000000009' }))).outcome,
      ).toBe('code_invalid')
      expect(await db.select().from(organizationTelegramChats)).toHaveLength(1)
    })

    it('an expired code does not link', async () => {
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      await db.update(telegramChatLinkCodes).set({ expiresAt: new Date(Date.now() - 1000) })
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('code_invalid')
      expect(await db.select().from(organizationTelegramChats)).toHaveLength(0)
    })

    it('unknown, malformed and foreign-looking codes do not link and reveal nothing', async () => {
      await telegramChatService.issueCode({ userId: ownerId }, orgId)
      for (const bad of ['AAAA-AAAA', 'short', '', "'; DROP TABLE users;--", 'ABCD-EFG0']) {
        expect(await telegramChatService.claim(claimInput(bad))).toEqual({
          outcome: 'code_invalid',
        })
      }
      expect(await db.select().from(organizationTelegramChats)).toHaveLength(0)
    })

    it("a code of one group never links a chat to another group's account", async () => {
      const { code } = await telegramChatService.issueCode({ userId: otherOwnerId }, otherOrgId)
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('linked')
      expect(await linkRow(orgId)).toBeUndefined()
      expect((await linkRow(otherOrgId))!.organizationId).toBe(otherOrgId)
    })

    it('a chat already linked to another group is refused and the code is burned', async () => {
      await linkChat('-1001000000001', otherOrgId, otherOwnerId)
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      expect(await telegramChatService.claim(claimInput(code))).toEqual({ outcome: 'chat_taken' })
      expect(await linkRow(orgId)).toBeUndefined()
      // код, прозвучавший в чате, сгорел: другой чат им не привязать
      expect(
        (await telegramChatService.claim(claimInput(code, { chatId: '-1001000000002' }))).outcome,
      ).toBe('code_invalid')
      expect(await linkRow(orgId)).toBeUndefined()
    })

    it('a chat whose link lost the right to post still belongs to its group', async () => {
      await linkChat('-1001000000001', otherOrgId, otherOwnerId)
      await telegramChatService.syncBotMembership({
        chatId: '-1001000000001',
        chatType: 'supergroup',
        status: 'restricted',
        canPost: false,
      })
      expect((await linkRow(otherOrgId))!.status).toBe('invalid')
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('chat_taken')
    })

    it('removing the bot frees the chat: any group can link it with a new code', async () => {
      await linkChat('-1001000000001', otherOrgId, otherOwnerId)
      await kick()
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('linked')
      expect((await linkRow(orgId))!.status).toBe('active')
      expect((await linkRow(otherOrgId))!.status).toBe('unlinked')
    })

    it('a code spoken in a chat by a non-admin is burned without linking', async () => {
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      expect(
        await telegramChatService.claim({ verdict: 'rejected', code, chatId: '-1001000000001' }),
      ).toEqual({ outcome: 'rejected' })
      expect(await db.select().from(organizationTelegramChats)).toHaveLength(0)
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('code_invalid')
      // неверный код при отказе ничего не раскрывает и не расходует чужой
      const other = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      expect(
        await telegramChatService.claim({
          verdict: 'rejected',
          code: 'ZZZZ-ZZZZ',
          chatId: '-1001000000001',
        }),
      ).toEqual({ outcome: 'code_invalid' })
      expect((await telegramChatService.claim(claimInput(other.code))).outcome).toBe('linked')
    })

    it('a group with a chat cannot link a second one', async () => {
      await linkChat()
      // код выдан до привязки (например, в другой вкладке)
      await db.insert(telegramChatLinkCodes).values({
        organizationId: orgId,
        createdByUserId: ownerId,
        codeHash: hashLinkCode('ABCDEFGH'),
        expiresAt: future(1),
      })
      expect(
        await telegramChatService.claim(claimInput('ABCD-EFGH', { chatId: '-1001000000002' })),
      ).toEqual({ outcome: 'group_has_chat' })
      expect((await linkRow())!.telegramChatId).toBe(-1001000000001n)
    })

    it('a code issued by someone who is no longer organizer or owner is invalid', async () => {
      const { code } = await telegramChatService.issueCode({ userId: organizerId }, orgId)
      await db
        .update(organizationMembers)
        .set({ role: 'player' })
        .where(eq(organizationMembers.userId, organizerId))
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('code_invalid')
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('code_invalid')

      const second = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      await db.update(organizations).set({ status: 'archived' }).where(eq(organizations.id, orgId))
      expect((await telegramChatService.claim(claimInput(second.code))).outcome).toBe(
        'code_invalid',
      )
    })

    it('rejects a private or malformed chat before touching the database', async () => {
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      await expect(
        telegramChatService.claim(claimInput(code, { chatId: '123456' })),
      ).rejects.toMatchObject({ name: 'ZodError' })
      await expect(
        telegramChatService.claim(claimInput(code, { chatType: 'private' })),
      ).rejects.toMatchObject({ name: 'ZodError' })
      // код не расходован
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('linked')
    })

    it('one code links at most one chat under concurrency', async () => {
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      const results = await Promise.all(
        [1, 2, 3, 4, 5, 6].map((i) =>
          telegramChatService.claim(claimInput(code, { chatId: `-100100000010${i}` })),
        ),
      )
      expect(results.filter((r) => r.outcome === 'linked')).toHaveLength(1)
      expect(await db.select().from(organizationTelegramChats)).toHaveLength(1)
    })

    it('two groups claiming the same chat concurrently: exactly one wins', async () => {
      const a = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      const b = await telegramChatService.issueCode({ userId: otherOwnerId }, otherOrgId)
      const results = await Promise.all([
        telegramChatService.claim(claimInput(a.code)),
        telegramChatService.claim(claimInput(b.code)),
      ])
      expect(results.map((r) => r.outcome).sort()).toEqual(['chat_taken', 'linked'])
      expect(await db.select().from(organizationTelegramChats)).toHaveLength(1)
    })

    it('re-adding the bot does not bring a removed link back; only a new code links again', async () => {
      await linkChat()
      await kick()
      expect(await db.select().from(organizationTelegramChats)).toMatchObject([
        { status: 'unlinked', unlinkReason: 'bot_removed', botCanPost: false },
      ])
      expect(
        await telegramChatService.syncBotMembership({
          chatId: '-1001000000001',
          chatType: 'supergroup',
          status: 'member',
          canPost: true,
        }),
      ).toEqual({ matched: false })
      expect((await telegramChatService.status({ userId: ownerId }, orgId)).link).toBeNull()
      await linkChat()
      const rows = await db.select().from(organizationTelegramChats)
      expect(rows.map((r) => r.status).sort()).toEqual(['active', 'unlinked'])
    })
  })

  describe('bot membership updates (my_chat_member in groups)', () => {
    const update = (
      status: 'member' | 'kicked' | 'left' | 'restricted',
      canPost: boolean,
      title?: string,
    ) =>
      telegramChatService.syncBotMembership({
        chatId: '-1001000000001',
        chatType: 'supergroup',
        status,
        canPost,
        ...(title ? { title } : {}),
      })

    it('does not create a link for an unknown chat', async () => {
      expect(await update('member', true)).toEqual({ matched: false })
      expect(await db.select().from(organizationTelegramChats)).toHaveLength(0)
    })

    it('releases the link with a reason when the bot is removed, keeping the row as history', async () => {
      await linkChat()
      expect(await update('kicked', false)).toEqual({ matched: true })
      expect(await linkRow()).toMatchObject({
        status: 'unlinked',
        unlinkReason: 'bot_removed',
        invalidReason: null,
        botCanPost: false,
        unlinkedByUserId: null,
      })
      const status = await telegramChatService.status({ userId: ownerId }, orgId)
      expect(status.link).toBeNull()
      expect(status.released).toMatchObject({ reason: 'bot_removed' })
      const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      const released = audit.filter((a) => a.action === 'telegram_chat.unlinked')
      expect(released).toHaveLength(1)
      expect(released[0]!.userId).toBeNull()
      expect(released[0]!.newValue).toEqual({ reason: 'bot_removed' })
    })

    it('a left bot releases the link too', async () => {
      await linkChat()
      await update('left', false)
      expect((await linkRow())!.unlinkReason).toBe('bot_removed')
    })

    it('marks the link invalid when the bot loses the right to post, and restores it', async () => {
      await linkChat()
      await update('restricted', false)
      expect(await linkRow()).toMatchObject({ status: 'invalid', invalidReason: 'no_rights' })
      await update('member', true, 'Новое название')
      expect(await linkRow()).toMatchObject({
        status: 'active',
        invalidReason: null,
        botCanPost: true,
        title: 'Новое название',
      })
      const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      const changes = audit.filter((a) => a.action === 'telegram_chat.status_changed')
      expect(changes).toHaveLength(2)
      expect(changes.every((a) => a.userId === null)).toBe(true)
    })

    it('a chat migrated to a supergroup does not come back', async () => {
      await linkChat()
      const ev = await makeEvent()
      send.mockRejectedValueOnce(new DeliveryError('blocked', undefined, 'migrated'))
      await telegramChatService
        .announceEvent({ userId: ownerId }, orgId, ev.id, { botUsername: 'volleytime_test_bot' })
        .catch(() => undefined)
      expect(await linkRow()).toMatchObject({ status: 'invalid', invalidReason: 'migrated' })
      await update('member', true)
      expect(await linkRow()).toMatchObject({ status: 'invalid', invalidReason: 'migrated' })
    })

    it('ignores unlinked history', async () => {
      await linkChat()
      await telegramChatService.unlink({ userId: ownerId }, orgId)
      expect(await update('kicked', false)).toEqual({ matched: false })
      expect((await linkRow())!.unlinkReason).toBe('organizer')
    })
  })

  describe('unlinking', () => {
    it('unlinks with an audit entry, frees the chat for another group, is idempotent', async () => {
      await linkChat()
      expect(await telegramChatService.unlink({ userId: organizerId }, orgId)).toEqual({
        unlinked: true,
      })
      expect(await linkRow()).toMatchObject({
        status: 'unlinked',
        unlinkReason: 'organizer',
        unlinkedByUserId: organizerId,
      })
      expect(await telegramChatService.unlink({ userId: organizerId }, orgId)).toEqual({
        unlinked: false,
      })
      const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      expect(audit.filter((a) => a.action === 'telegram_chat.unlinked')).toHaveLength(1)
      await linkChat('-1001000000001', otherOrgId, otherOwnerId)
      expect((await linkRow(otherOrgId))!.status).toBe('active')
    })

    it('concurrent unlink and bot removal release once and write one audit entry', async () => {
      await linkChat()
      await Promise.all([
        telegramChatService.unlink({ userId: ownerId }, orgId),
        telegramChatService.unlink({ userId: organizerId }, orgId),
        kick(),
      ])
      const rows = await db.select().from(organizationTelegramChats)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.status).toBe('unlinked')
      const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      expect(audit.filter((a) => a.action === 'telegram_chat.unlinked')).toHaveLength(1)
    })

    it('revokes an unused code so it cannot link the chat afterwards', async () => {
      const { code } = await telegramChatService.issueCode({ userId: ownerId }, orgId)
      await telegramChatService.unlink({ userId: ownerId }, orgId)
      expect((await telegramChatService.claim(claimInput(code))).outcome).toBe('code_invalid')
    })

    it('the status never exposes ids of the chat or of the confirming admin', async () => {
      await linkChat()
      const json = JSON.stringify(await telegramChatService.status({ userId: ownerId }, orgId))
      expect(json).not.toContain('1001000000001')
      expect(json).not.toContain('777001')
    })
  })

  describe('announcing an event', () => {
    const announce = (eventId: number, org = orgId, user = organizerId) =>
      telegramChatService.announceEvent({ userId: user }, org, eventId, {
        botUsername: 'volleytime_test_bot',
      })

    it('sends date, place and free seats with url deeplinks only to the linked chat', async () => {
      await linkChat()
      const ev = await makeEvent()
      await bookingService.book({ userId: ownerId }, orgId, ev.id, { method: 'cash' })
      expect(await announce(ev.id)).toEqual({ announced: true })

      expect(send).toHaveBeenCalledTimes(1)
      const msg = sent[0]!
      expect(msg.telegramId).toBe('-1001000000001')
      expect(msg.text).toContain('Основа · Группа А')
      expect(msg.text).toContain('Свободно 9 из 10 мест.')
      const buttons = msg.keyboard!.flat()
      expect(buttons.map((b) => b.text)).toEqual(['Записаться', 'Открыть тренировку'])
      for (const b of buttons) {
        expect(b.url).toBe(`https://t.me/volleytime_test_bot?startapp=event_${ev.id}`)
        expect(b.webAppUrl).toBeUndefined()
        expect(b.callbackData).toBeUndefined()
      }
      const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      expect(audit.filter((a) => a.action === 'telegram_chat.event_announced')).toHaveLength(1)
    })

    it('an event of another group is indistinguishable from a missing one and sends nothing', async () => {
      await linkChat()
      await linkChat('-1001000000002', otherOrgId, otherOwnerId)
      const foreign = await makeEvent(otherOrgId, otherOwnerId)
      expect(await errCode(announce(foreign.id))).toBe('event.not_found')
      expect(await errCode(announce(999_999))).toBe('event.not_found')
      expect(send).not.toHaveBeenCalled()
    })

    it('does not announce drafts, cancelled or started events', async () => {
      await linkChat()
      const draft = await makeEvent(orgId, ownerId, { status: 'draft' })
      expect(await errCode(announce(draft.id))).toBe('telegram_chat.event_not_announceable')
      const cancelled = await makeEvent()
      await eventService.cancel({ userId: ownerId }, cancelled.id)
      expect(await errCode(announce(cancelled.id))).toBe('telegram_chat.event_not_announceable')
      expect(send).not.toHaveBeenCalled()
    })

    it('requires a linked chat', async () => {
      const ev = await makeEvent()
      expect(await errCode(announce(ev.id))).toBe('telegram_chat.not_linked')
      await linkChat()
      await telegramChatService.unlink({ userId: ownerId }, orgId)
      expect(await errCode(announce(ev.id))).toBe('telegram_chat.not_linked')
      expect(send).not.toHaveBeenCalled()
    })

    it('does not send to an invalid link and names the reason', async () => {
      await linkChat()
      const ev = await makeEvent()
      await telegramChatService.syncBotMembership({
        chatId: '-1001000000001',
        chatType: 'supergroup',
        status: 'restricted',
        canPost: false,
      })
      expect(await errCode(announce(ev.id))).toBe('telegram_chat.no_rights')
      expect(send).not.toHaveBeenCalled()
    })

    it('after the bot is removed the group has no chat to announce to', async () => {
      await linkChat()
      const ev = await makeEvent()
      await kick()
      expect(await errCode(announce(ev.id))).toBe('telegram_chat.not_linked')
      expect(send).not.toHaveBeenCalled()
    })

    it.each([
      ['no_rights', 'telegram_chat.no_rights'],
      ['migrated', 'telegram_chat.migrated'],
    ] as const)(
      'delivery failure %s marks the link invalid and returns %s',
      async (reason, code) => {
        await linkChat()
        const ev = await makeEvent()
        send.mockRejectedValueOnce(new DeliveryError('blocked', undefined, reason))
        expect(await errCode(announce(ev.id))).toBe(code)
        expect(await linkRow()).toMatchObject({ status: 'invalid', invalidReason: reason })
        const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
        expect(audit.filter((a) => a.action === 'telegram_chat.event_announced')).toHaveLength(0)
      },
    )

    it.each(['bot_removed', undefined] as const)(
      'delivery failure %s (bot removed) releases the link and frees the chat',
      async (reason) => {
        await linkChat()
        const ev = await makeEvent()
        send.mockRejectedValueOnce(new DeliveryError('blocked', undefined, reason))
        expect(await errCode(announce(ev.id))).toBe('telegram_chat.bot_removed')
        expect(await linkRow()).toMatchObject({ status: 'unlinked', unlinkReason: 'bot_removed' })
        expect(await errCode(announce(ev.id))).toBe('telegram_chat.not_linked')
        await linkChat('-1001000000001', otherOrgId, otherOwnerId)
        expect((await linkRow(otherOrgId))!.status).toBe('active')
      },
    )

    it('a rate limit or a transient failure keeps the link active and exposes no internals', async () => {
      await linkChat()
      const ev = await makeEvent()
      send.mockRejectedValueOnce(new DeliveryError('rate_limited', 5000))
      expect(await errCode(announce(ev.id))).toBe('telegram_chat.rate_limited')
      send.mockRejectedValueOnce(new Error('connect ECONNREFUSED http://bot:3001 secret-token-xyz'))
      const err = await announce(ev.id).catch((e: Error) => e)
      expect(err).toMatchObject({ code: 'telegram_chat.delivery_failed' })
      expect((err as Error).message).not.toContain('secret-token-xyz')
      expect((err as Error).message).not.toContain('bot:3001')
      expect((await linkRow())!.status).toBe('active')
    })

    it('uses the venue as the place when the event has one', async () => {
      await linkChat()
      const { venueService } = await import('../venues/service')
      const venue = await venueService.create(
        { userId: ownerId },
        { organizationId: orgId, name: 'Школа №24' },
      )
      const ev = await makeEvent(orgId, ownerId, { venueId: venue.id })
      await announce(ev.id)
      expect(sent[0]!.text).toContain('Основа · Школа №24')
    })
  })
})
