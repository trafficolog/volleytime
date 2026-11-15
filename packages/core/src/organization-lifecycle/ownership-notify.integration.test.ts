import {
  and,
  auditLog,
  closeDb,
  db,
  eq,
  notifications,
  organizationMembers,
  organizationOwnershipTransfers,
  organizations,
  scheduledJobs,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { memberService } from '../members/service'
import { DeliveryError } from '../notifier/delivery-error'
import { setNotifierTransport } from '../notifier/service'
import type { NotifyPayload } from '../notifier/types'
import { organizationService } from '../organizations/service'

import { ownershipTransferService } from './service'

/**
 * Task 21.4.7 (решение владельца 2026-11-11): бот присылает получателю личную ссылку передачи
 * прямой отправкой; прежнему owner — исход (принятие, отмена, истечение). Токен — только в
 * сообщении получателю: ни в ленте, ни в очереди, ни в журнале, ни в логах.
 */
describe('ownership transfer bot notifications (PostgreSQL)', { timeout: 30_000 }, () => {
  const TG = { owner: 7001n, recipient: 7002n, other: 7003n }
  let owner: number
  let recipient: number
  let other: number
  let orgId: number
  let recipientMemberId: number
  let sent: NotifyPayload[]
  let failWith: (() => Error) | null
  let logs: string[]

  const newUser = async (tag: string, tg?: bigint) =>
    (
      await db
        .insert(users)
        .values({
          email: `notify-${tag}-${crypto.randomUUID()}@t.by`,
          name: `Имя ${tag}`,
          telegramUserId: tg ?? null,
        })
        .returning()
    )[0]!.id

  const LINK = (token: string) => `https://t.me/vt_bot?startapp=transfer_${token}`

  async function start() {
    const { transfer, token } = await ownershipTransferService.start({ userId: owner }, orgId, {
      recipientMemberId,
    })
    return { transfer, token, url: LINK(token) }
  }

  const to = (tg: bigint) => sent.filter((p) => p.telegramId === String(tg))

  /** Всё, что приложение сохранило или залогировало, кроме самого сообщения получателю. */
  async function persistedText() {
    const rows = [
      await db.select().from(auditLog),
      await db.select().from(notifications),
      await db.select().from(scheduledJobs),
      await db.select().from(organizationOwnershipTransfers),
    ]
    return JSON.stringify(rows) + logs.join('\n')
  }

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    sent = []
    failWith = null
    logs = []
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const)
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
        logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
      })
    setNotifierTransport({
      async send(payload) {
        if (failWith) throw failWith()
        sent.push(payload)
      },
    })
    owner = await newUser('owner', TG.owner)
    recipient = await newUser('recipient', TG.recipient)
    other = await newUser('other', TG.other)
    orgId = (await organizationService.create({ userId: owner }, { name: 'Волейбол Минск' })).id
    recipientMemberId = (
      await memberService.add({ userId: owner }, { organizationId: orgId, userId: recipient })
    ).id
    await memberService.add({ userId: owner }, { organizationId: orgId, userId: other })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setNotifierTransport({ async send() {} })
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('link to the recipient', () => {
    it('sends the personal link only to the recipient personal chat', async () => {
      const { transfer, token, url } = await start()
      const result = await ownershipTransferService.deliverLink(
        { userId: owner },
        orgId,
        transfer.id,
        url,
      )
      expect(result).toEqual({ status: 'delivered' })
      expect(sent).toHaveLength(1)
      const msg = sent[0]!
      expect(msg.telegramId).toBe(String(TG.recipient))
      expect(msg.text).toContain('Волейбол Минск')
      expect(msg.text).toContain('Имя owner')
      expect(msg.text).toContain(token)
      expect(JSON.stringify(msg.keyboard)).toContain(token)
      expect(to(TG.owner)).toHaveLength(0)
      expect(to(TG.other)).toHaveLength(0)
    })

    it('never leaves the token in the feed, the queue, the audit log, the row or the logs', async () => {
      const { transfer, token, url } = await start()
      await ownershipTransferService.deliverLink({ userId: owner }, orgId, transfer.id, url)
      // недоставка тоже не пишет ссылку в журнал и логи
      failWith = () => new DeliveryError('transient')
      await ownershipTransferService.cancel({ userId: owner }, orgId)
      const again = await ownershipTransferService.start({ userId: owner }, orgId, {
        recipientMemberId,
      })
      await ownershipTransferService.deliverLink(
        { userId: owner },
        orgId,
        again.transfer.id,
        LINK(again.token),
      )
      const text = await persistedText()
      expect(text).not.toContain(token)
      expect(text).not.toContain(again.token)
      expect(await db.select().from(notifications)).toHaveLength(0)
      expect(await db.select().from(scheduledJobs)).toHaveLength(0)
    })

    it('a transfer is created and the owner sees "not delivered" when the recipient has no bot chat', async () => {
      await db.update(users).set({ telegramUserId: null }).where(eq(users.id, recipient))
      const { transfer, url } = await start()
      const result = await ownershipTransferService.deliverLink(
        { userId: owner },
        orgId,
        transfer.id,
        url,
      )
      expect(result).toEqual({ status: 'not_delivered', reason: 'no_telegram' })
      expect(sent).toHaveLength(0)
      const current = await ownershipTransferService.current({ userId: owner }, orgId)
      expect(current?.id).toBe(transfer.id)
      expect(current?.botDelivery).toEqual({ status: 'not_delivered', reason: 'no_telegram' })
    })

    it.each([
      ['blocked', () => new DeliveryError('blocked'), 'blocked'],
      ['rate limited', () => new DeliveryError('rate_limited', 1000), 'failed'],
      ['transient', () => new DeliveryError('transient'), 'failed'],
      ['unknown', () => new Error('boom'), 'failed'],
    ])(
      'bot unavailable (%s): transfer stays, state is "not delivered"',
      async (_name, make, reason) => {
        failWith = make
        const { transfer, url } = await start()
        const result = await ownershipTransferService.deliverLink(
          { userId: owner },
          orgId,
          transfer.id,
          url,
        )
        expect(result).toEqual({ status: 'not_delivered', reason })
        const current = await ownershipTransferService.current({ userId: owner }, orgId)
        expect(current?.id).toBe(transfer.id)
        expect(current?.botDelivery).toEqual({ status: 'not_delivered', reason })
        const [row] = await db.select().from(organizationOwnershipTransfers)
        expect(row!.status).toBe('pending')
      },
    )

    it('logs only the fact and the status of delivery', async () => {
      failWith = () => new DeliveryError('blocked')
      const { transfer, token, url } = await start()
      await ownershipTransferService.deliverLink({ userId: owner }, orgId, transfer.id, url)
      const line = logs.find((l) => l.includes('ownership-transfer'))
      expect(line).toBeDefined()
      expect(line).toContain('not_delivered')
      expect(line).not.toContain(token)
      expect(line).not.toContain('startapp')
    })

    it('state "delivered" is readable by the owner after a successful send', async () => {
      const { transfer, url } = await start()
      await ownershipTransferService.deliverLink({ userId: owner }, orgId, transfer.id, url)
      const current = await ownershipTransferService.current({ userId: owner }, orgId)
      expect(current?.botDelivery).toEqual({ status: 'delivered' })
    })

    it('a fresh transfer without a delivery attempt has no delivery state', async () => {
      await start()
      const current = await ownershipTransferService.current({ userId: owner }, orgId)
      expect(current?.botDelivery).toBeNull()
    })
  })

  describe('IDOR', () => {
    it('only the starting owner of that group can trigger delivery; nothing is sent otherwise', async () => {
      const { transfer, url } = await start()
      // не owner (участник той же группы) и получатель
      for (const uid of [other, recipient]) {
        await expect(
          ownershipTransferService.deliverLink({ userId: uid }, orgId, transfer.id, url),
        ).rejects.toBeInstanceOf(Error)
      }
      // owner другой группы: и со своей группой, и с группой жертвы
      const foreignOwner = await newUser('foreign', 7099n)
      const foreignOrg = (
        await organizationService.create({ userId: foreignOwner }, { name: 'Чужая' })
      ).id
      await expect(
        ownershipTransferService.deliverLink(
          { userId: foreignOwner },
          foreignOrg,
          transfer.id,
          url,
        ),
      ).rejects.toBeInstanceOf(Error)
      await expect(
        ownershipTransferService.deliverLink({ userId: foreignOwner }, orgId, transfer.id, url),
      ).rejects.toBeInstanceOf(Error)
      expect(sent).toHaveLength(0)
    })

    it('another user and another group never see the delivery state', async () => {
      const { transfer, url } = await start()
      await ownershipTransferService.deliverLink({ userId: owner }, orgId, transfer.id, url)
      const foreignOwner = await newUser('foreign2', 7098n)
      const foreignOrg = (
        await organizationService.create({ userId: foreignOwner }, { name: 'Чужая 2' })
      ).id
      expect(
        await ownershipTransferService.current({ userId: foreignOwner }, foreignOrg),
      ).toBeNull()
    })
  })

  describe('outcome to the previous owner', () => {
    it('accept: the previous owner is told who took the group, nobody else is notified', async () => {
      const { token } = await start()
      await ownershipTransferService.accept({ userId: recipient }, token)
      expect(to(TG.owner)).toHaveLength(1)
      const msg = to(TG.owner)[0]!
      expect(msg.text).toContain('Волейбол Минск')
      expect(msg.text).toContain('Имя recipient')
      expect(msg.text).not.toContain(token)
      expect(to(TG.recipient)).toHaveLength(0)
      expect(to(TG.other)).toHaveLength(0)
      expect(await persistedText()).not.toContain(token)
    })

    it('cancel: the owner gets a confirmation; the recipient and others get nothing', async () => {
      const { token } = await start()
      await ownershipTransferService.cancel({ userId: owner }, orgId)
      expect(to(TG.owner)).toHaveLength(1)
      expect(to(TG.owner)[0]!.text).toContain('отмен')
      expect(to(TG.recipient)).toHaveLength(0)
      expect(to(TG.other)).toHaveLength(0)
      expect(JSON.stringify(sent)).not.toContain(token)
    })

    it('a repeated cancel with nothing pending sends nothing', async () => {
      await start()
      await ownershipTransferService.cancel({ userId: owner }, orgId)
      sent.length = 0
      await ownershipTransferService.cancel({ userId: owner }, orgId)
      expect(sent).toHaveLength(0)
    })

    it('expiry by the scheduler: the owner is told once; a second pass sends nothing', async () => {
      await start()
      const later = new Date(Date.now() + 73 * 3_600_000)
      expect(await ownershipTransferService.expireDue(later)).toBe(1)
      expect(to(TG.owner)).toHaveLength(1)
      expect(to(TG.owner)[0]!.text).toContain('истёк')
      expect(await ownershipTransferService.expireDue(later)).toBe(0)
      expect(to(TG.owner)).toHaveLength(1)
      expect(to(TG.recipient)).toHaveLength(0)
    })

    it('expiry found on accept: the expired link is rejected and the owner is told', async () => {
      const { token, transfer } = await start()
      await db
        .update(organizationOwnershipTransfers)
        .set({
          expiresAt: new Date(Date.now() - 1000),
          createdAt: new Date(Date.now() - 3_600_000),
        })
        .where(eq(organizationOwnershipTransfers.id, transfer.id))
      await expect(
        ownershipTransferService.accept({ userId: recipient }, token),
      ).rejects.toMatchObject({ code: 'ownership_transfer.expired' })
      expect(to(TG.owner)).toHaveLength(1)
      expect(to(TG.owner)[0]!.text).toContain('истёк')
    })

    it('a failing bot never breaks accept, cancel or expiry', async () => {
      failWith = () => new DeliveryError('blocked')
      const a = await start()
      await expect(
        ownershipTransferService.accept({ userId: recipient }, a.token),
      ).resolves.toEqual({ organizationId: orgId })
      // новый owner — recipient; бывший owner теперь organizer и тоже участник
      const formerOwner = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, owner),
        ),
      })
      await ownershipTransferService.start({ userId: recipient }, orgId, {
        recipientMemberId: formerOwner!.id,
      })
      await expect(ownershipTransferService.cancel({ userId: recipient }, orgId)).resolves.toEqual({
        cancelled: true,
      })
    })
  })
})
