import { afterEach, describe, expect, it } from 'vitest'

import { loadBotChatInfo, setBotChatInfoTransport } from './bot-info'

const UNAVAILABLE = {
  memberCount: null,
  webhook: { state: 'unavailable', pendingUpdateCount: null },
}

afterEach(() => setBotChatInfoTransport(null))

describe('loadBotChatInfo (21.4.6)', () => {
  it('passes the chat id to the bot and returns the validated answer', async () => {
    const calls: string[] = []
    setBotChatInfoTransport({
      async chatInfo(chatId) {
        calls.push(chatId)
        return { memberCount: 12, webhook: { state: 'not_used', pendingUpdateCount: null } }
      },
    })
    expect(await loadBotChatInfo('-1001')).toEqual({
      memberCount: 12,
      webhook: { state: 'not_used', pendingUpdateCount: null },
    })
    expect(calls).toEqual(['-1001'])
  })

  it('degrades to "unavailable" when the bot is down, never throws', async () => {
    setBotChatInfoTransport({
      async chatInfo() {
        throw new Error('connect ECONNREFUSED bot:3001 123456:SECRET')
      },
    })
    expect(await loadBotChatInfo('-1001')).toEqual(UNAVAILABLE)
  })

  it('degrades when no transport is configured', async () => {
    expect(await loadBotChatInfo('-1001')).toEqual(UNAVAILABLE)
  })

  it('rejects a malformed bot answer instead of passing it to the cabinet', async () => {
    for (const bad of [
      null,
      'ok',
      { memberCount: -1, webhook: { state: 'ok', pendingUpdateCount: 0 } },
      { memberCount: 3, webhook: { state: 'weird', pendingUpdateCount: 0 } },
      { memberCount: 3 },
    ]) {
      setBotChatInfoTransport({ chatInfo: async () => bad })
      expect(await loadBotChatInfo('-1001')).toEqual(UNAVAILABLE)
    }
  })

  it('strips fields outside the contract (no webhook url or secrets)', async () => {
    setBotChatInfoTransport({
      chatInfo: async () => ({
        memberCount: 5,
        webhook: { state: 'ok', pendingUpdateCount: 2, url: 'https://x/tg/webhook/SECRET' },
        token: '123456:SECRET',
      }),
    })
    const info = await loadBotChatInfo('-1001')
    expect(JSON.stringify(info)).not.toContain('SECRET')
    expect(info.webhook).toEqual({ state: 'ok', pendingUpdateCount: 2 })
  })
})
