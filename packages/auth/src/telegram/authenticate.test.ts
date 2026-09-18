import { createHmac } from 'node:crypto'

import { accounts, closeDb, db, eq, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { authenticateViaTelegram } from './authenticate'

const BOT_TOKEN = '123456:AUTH_TEST'

function signInitData(tgId: number, extra: Record<string, unknown> = {}): string {
  const params: Record<string, string> = {
    user: JSON.stringify({
      id: tgId,
      first_name: 'Иван',
      last_name: 'П',
      username: 'ivan',
      ...extra,
    }),
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

describe('authenticateViaTelegram (integration)', () => {
  beforeEach(async () => {
    await db.delete(users)
  })

  it('creates new user on first auth (isNewUser=true)', async () => {
    const result = await authenticateViaTelegram(signInitData(5001), BOT_TOKEN)
    expect(result.isNewUser).toBe(true)
    const u = await db.query.users.findFirst({ where: eq(users.id, result.userId) })
    expect(u?.telegramUserId).toBe(5001n)
    expect(u?.name).toBe('Иван П')
    expect(u?.telegramUsername).toBe('ivan')
  })

  it('creates telegram account link for new user', async () => {
    const result = await authenticateViaTelegram(signInitData(5002), BOT_TOKEN)
    const acc = await db.select().from(accounts).where(eq(accounts.userId, result.userId))
    expect(acc.some((a) => a.providerId === 'telegram' && a.accountId === '5002')).toBe(true)
  })

  it('finds existing user on repeat auth (isNewUser=false, no duplicate)', async () => {
    const first = await authenticateViaTelegram(signInitData(5003), BOT_TOKEN)
    const second = await authenticateViaTelegram(signInitData(5003), BOT_TOKEN)
    expect(second.isNewUser).toBe(false)
    expect(second.userId).toBe(first.userId)
    const all = await db.select().from(users).where(eq(users.telegramUserId, 5003n))
    expect(all).toHaveLength(1)
  })

  it('rejects invalid signature', async () => {
    await expect(authenticateViaTelegram(signInitData(5004), 'WRONG:TOKEN')).rejects.toThrow(
      /signature/,
    )
  })

  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })
})
