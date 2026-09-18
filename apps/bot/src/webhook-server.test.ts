import { Bot } from 'grammy'
import { afterAll, describe, expect, it } from 'vitest'

import type { BotContext } from './context'
import { startWebhookServer } from './webhook-server'

/** Task 9.9.3: маршрут вебхука доходит до бота и отбивает чужой секрет (не 404). */
describe('webhook server', () => {
  const bot = new Bot<BotContext>('123456:TEST_TOKEN', {
    botInfo: {
      id: 123456,
      is_bot: true,
      first_name: 'Test',
      username: 'test_bot',
      can_join_groups: false,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    } as never,
  })
  const server = startWebhookServer(bot, 8599)

  const post = (path: string, secret?: string) =>
    fetch(`http://127.0.0.1:8599${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-telegram-bot-api-secret-token': secret } : {}),
      },
      body: JSON.stringify({ update_id: 1 }),
    })

  it('rejects wrong secret token with 401, not 404', async () => {
    const res = await post('/tg/webhook/some-secret-path', 'wrong-token')
    expect(res.status).toBe(401)
  })

  it('accepts the configured path with any suffix', async () => {
    const res = await post('/tg/webhook/some-secret-path/', 'wrong-token')
    expect(res.status).toBe(401)
  })

  afterAll(() => {
    server.close()
  })
})
