import type { AddressInfo } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import { collectChatInfo, isChatInfoRequest } from './chat-info'
import { MAX_BODY_BYTES, startInternalServer } from './internal-server'
import { makeTestBot, type ApiCall } from './test-bot'

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0)
const CHAT = '-1001234567890'
const HOOK = 'https://vt.by/tg/webhook/SECRET'

/** Ответы Bot API по методам; метод со значением `Error` отвечает ошибкой. */
function api(replies: Record<string, unknown>) {
  const { bot, calls } = makeTestBot({
    reply: (c: ApiCall) => {
      const r = replies[c.method]
      if (r instanceof Error) throw r
      return r
    },
  })
  return { api: bot.api, calls }
}

describe('collectChatInfo (21.4.6)', () => {
  it('polling mode: counts members, never asks Telegram for webhook info', async () => {
    const { api: a, calls } = api({ getChatMemberCount: 14 })
    expect(await collectChatInfo(a, CHAT, 'polling', HOOK, NOW)).toEqual({
      memberCount: 14,
      webhook: { state: 'not_used', pendingUpdateCount: null },
    })
    expect(calls.map((c) => c.method)).toEqual(['getChatMemberCount'])
    expect(calls[0]!.payload).toMatchObject({ chat_id: CHAT })
  })

  it('webhook mode: healthy when registered and no recent error', async () => {
    const { api: a } = api({
      getChatMemberCount: 3,
      getWebhookInfo: {
        url: 'https://vt.by/tg/webhook/SECRET',
        has_custom_certificate: false,
        pending_update_count: 2,
      },
    })
    const info = await collectChatInfo(a, CHAT, 'webhook', HOOK, NOW)
    expect(info).toEqual({ memberCount: 3, webhook: { state: 'ok', pendingUpdateCount: 2 } })
    expect(JSON.stringify(info)).not.toContain('SECRET')
  })

  it('webhook mode: error when not registered or Telegram saw a fresh delivery error', async () => {
    const empty = api({
      getChatMemberCount: 3,
      getWebhookInfo: { url: '', has_custom_certificate: false, pending_update_count: 0 },
    })
    expect((await collectChatInfo(empty.api, CHAT, 'webhook', HOOK, NOW)).webhook.state).toBe(
      'error',
    )
    const failing = api({
      getChatMemberCount: 3,
      getWebhookInfo: {
        url: 'https://vt.by/tg/webhook/SECRET',
        has_custom_certificate: false,
        pending_update_count: 9,
        last_error_date: Math.floor(NOW / 1000) - 60,
        last_error_message: 'Wrong response from the webhook: 502 Bad Gateway',
      },
    })
    const bad = await collectChatInfo(failing.api, CHAT, 'webhook', HOOK, NOW)
    expect(bad.webhook).toEqual({ state: 'error', pendingUpdateCount: 9 })
    expect(JSON.stringify(bad)).not.toContain('502')
    const stale = api({
      getChatMemberCount: 3,
      getWebhookInfo: {
        url: 'https://vt.by/tg/webhook/SECRET',
        has_custom_certificate: false,
        pending_update_count: 0,
        last_error_date: Math.floor(NOW / 1000) - 3 * 3600,
      },
    })
    expect((await collectChatInfo(stale.api, CHAT, 'webhook', HOOK, NOW)).webhook.state).toBe('ok')
  })

  it('webhook mode: a webhook registered on an unexpected address is an error, address not leaked', async () => {
    const { api: a } = api({
      getChatMemberCount: 3,
      getWebhookInfo: {
        url: 'https://evil.example/hook/OTHER',
        has_custom_certificate: false,
        pending_update_count: 0,
      },
    })
    const info = await collectChatInfo(a, CHAT, 'webhook', HOOK, NOW)
    expect(info.webhook.state).toBe('error')
    expect(JSON.stringify(info)).not.toContain('evil')
  })

  it('a failing Telegram call degrades only its own field', async () => {
    const noChat = api({ getChatMemberCount: new Error('Bad Request: chat not found') })
    expect(await collectChatInfo(noChat.api, CHAT, 'polling', HOOK, NOW)).toEqual({
      memberCount: null,
      webhook: { state: 'not_used', pendingUpdateCount: null },
    })
    const noHook = api({ getChatMemberCount: 5, getWebhookInfo: new Error('boom') })
    expect(await collectChatInfo(noHook.api, CHAT, 'webhook', HOOK, NOW)).toEqual({
      memberCount: 5,
      webhook: { state: 'unavailable', pendingUpdateCount: null },
    })
  })

  it('accepts only a group chat id in the request body', () => {
    expect(isChatInfoRequest({ chatId: CHAT })).toBe(true)
    for (const bad of [
      null,
      {},
      { chatId: '42' },
      { chatId: 42 },
      { chatId: '-1; drop' },
      { chatId: '@channel' },
    ])
      expect(isChatInfoRequest(bad)).toBe(false)
  })
})

describe('POST /internal/chat-info (21.4.6)', () => {
  let server: ReturnType<typeof startInternalServer> | null = null
  afterEach(() => {
    server?.close()
    server = null
  })

  async function start(replies: Record<string, unknown>) {
    const { api: a, calls } = api(replies)
    server = startInternalServer({ api: a } as never, 0)
    await new Promise((r) => server!.once('listening', r))
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/internal/chat-info`
    return { url, calls }
  }
  const post = (url: string, body: string, secret?: string) =>
    fetch(url, {
      method: 'POST',
      headers: secret ? { 'x-internal-secret': secret } : {},
      body,
    })

  it('answers the contract under the shared secret', async () => {
    const { url, calls } = await start({ getChatMemberCount: 21 })
    const res = await post(url, JSON.stringify({ chatId: CHAT }), 'dev-internal-secret')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      memberCount: 21,
      webhook: { state: 'not_used', pendingUpdateCount: null },
    })
    expect(calls.map((c) => c.method)).toEqual(['getChatMemberCount'])
  })

  it('checks the secret before the body: no Telegram call without it', async () => {
    const { url, calls } = await start({ getChatMemberCount: 21 })
    expect((await post(url, '{not json')).status).toBe(403)
    expect((await post(url, JSON.stringify({ chatId: CHAT }), 'wrong')).status).toBe(403)
    expect(calls).toEqual([])
  })

  it('answers 413 for a body over the limit and does not call Telegram', async () => {
    const { url, calls } = await start({ getChatMemberCount: 21 })
    const big = JSON.stringify({ chatId: CHAT, pad: 'x'.repeat(MAX_BODY_BYTES) })
    expect((await post(url, big, 'dev-internal-secret')).status).toBe(413)
    expect(calls).toEqual([])
  })

  it('rejects a bad body or a private chat id with 422 and no Telegram call', async () => {
    const { url, calls } = await start({ getChatMemberCount: 21 })
    for (const body of [JSON.stringify({ chatId: '42' }), JSON.stringify({}), '{not json'])
      expect((await post(url, body, 'dev-internal-secret')).status).toBe(422)
    expect(calls).toEqual([])
  })
})
