import { createHmac } from 'node:crypto'

import { accounts, closeDb, db, eq, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  AccountAlreadyLinkedError,
  AccountLinkedToOtherUserError,
  linkTelegramToUser,
} from './linking'

const BOT_TOKEN = '123456:LINK_TEST'

function signInitData(tgId: number, username: string): string {
  const params: Record<string, string> = {
    user: JSON.stringify({ id: tgId, first_name: 'T', username }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  }
  const dcs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = createHmac('sha256', secret).update(dcs).digest('hex')
  const sp = new URLSearchParams(params)
  sp.set('hash', hash)
  return sp.toString()
}

describe('linkTelegramToUser (integration)', () => {
  beforeEach(async () => {
    await db.delete(users)
  })

  it('links telegram to a user (updates user + creates account)', async () => {
    const [u] = await db.insert(users).values({ email: 'e@test.by' }).returning()
    const result = await linkTelegramToUser(u!.id, signInitData(1001, 'alice'), BOT_TOKEN)
    expect(result.linkedTelegramId).toBe(1001n)

    const updated = await db.query.users.findFirst({ where: eq(users.id, u!.id) })
    expect(updated?.telegramUserId).toBe(1001n)
    expect(updated?.telegramUsername).toBe('alice')

    const acc = await db.select().from(accounts).where(eq(accounts.userId, u!.id))
    expect(acc.some((a) => a.providerId === 'telegram' && a.accountId === '1001')).toBe(true)
  })

  it('throws if telegram already linked to the same user', async () => {
    const [u] = await db.insert(users).values({ email: 'e2@test.by' }).returning()
    await linkTelegramToUser(u!.id, signInitData(1002, 'bob'), BOT_TOKEN)
    await expect(linkTelegramToUser(u!.id, signInitData(1002, 'bob'), BOT_TOKEN)).rejects.toThrow(
      AccountAlreadyLinkedError,
    )
  })

  it('throws if telegram belongs to another user', async () => {
    const [u1] = await db.insert(users).values({ email: 'u1@test.by' }).returning()
    const [u2] = await db.insert(users).values({ email: 'u2@test.by' }).returning()
    await linkTelegramToUser(u1!.id, signInitData(1003, 'carol'), BOT_TOKEN)
    await expect(
      linkTelegramToUser(u2!.id, signInitData(1003, 'carol'), BOT_TOKEN),
    ).rejects.toThrow(AccountLinkedToOtherUserError)
  })

  it('throws if user already has a different telegram linked', async () => {
    const [u] = await db.insert(users).values({ email: 'e3@test.by' }).returning()
    await linkTelegramToUser(u!.id, signInitData(1004, 'dave'), BOT_TOKEN)
    await expect(linkTelegramToUser(u!.id, signInitData(2222, 'other'), BOT_TOKEN)).rejects.toThrow(
      AccountAlreadyLinkedError,
    )
  })

  it('rejects invalid initData signature', async () => {
    const [u] = await db.insert(users).values({ email: 'e4@test.by' }).returning()
    await expect(linkTelegramToUser(u!.id, signInitData(1005, 'x'), 'WRONG:TOKEN')).rejects.toThrow(
      /signature/,
    )
  })

  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })
})
