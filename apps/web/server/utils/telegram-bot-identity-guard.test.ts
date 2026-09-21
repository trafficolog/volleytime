import { describe, expect, it } from 'vitest'

interface IdentityVerifier {
  verifyTelegramBotIdentity(options: {
    token: string
    expectedUsername: string
    fetchImpl: typeof fetch
  }): Promise<string>
}

const verifierUrl = new URL('../../../../scripts/verify-telegram-bot-identity.mjs', import.meta.url)
  .href

async function loadVerifier(): Promise<IdentityVerifier> {
  return (await import(verifierUrl)) as IdentityVerifier
}

function telegramGetMe(username: string): typeof fetch {
  return async () =>
    new Response(
      JSON.stringify({
        ok: true,
        result: {
          id: 1,
          is_bot: true,
          first_name: 'Volley Time',
          username,
          can_join_groups: true,
          can_read_all_group_messages: false,
          supports_inline_queries: false,
          can_connect_to_business: false,
          has_main_web_app: true,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
}

describe('Telegram bot identity deployment guard', () => {
  it('accepts the token-owned bot after normalizing @ and username case', async () => {
    const verifier = await loadVerifier()

    await expect(
      verifier.verifyTelegramBotIdentity({
        token: '123456:secret-token',
        expectedUsername: '@VolleyTimeBy_Bot',
        fetchImpl: telegramGetMe('volleytimeby_bot'),
      }),
    ).resolves.toBe('volleytimeby_bot')
  })

  it('rejects a configured username that belongs to another bot', async () => {
    const verifier = await loadVerifier()

    await expect(
      verifier.verifyTelegramBotIdentity({
        token: '123456:secret-token',
        expectedUsername: 'volleyballtime_bot',
        fetchImpl: telegramGetMe('volleytimeby_bot'),
      }),
    ).rejects.toThrow('configured username does not match token-owned bot')
  })

  it('redacts the token and tokenized URL from network failures', async () => {
    const verifier = await loadVerifier()
    const token = '123456:secret-token'
    const leakingFetch: typeof fetch = async () => {
      throw new Error(`request failed for https://api.telegram.org/bot${token}/getMe`)
    }

    let message = ''
    try {
      await verifier.verifyTelegramBotIdentity({
        token,
        expectedUsername: 'volleytimeby_bot',
        fetchImpl: leakingFetch,
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toBe('Telegram getMe request failed')
    expect(message).not.toContain(token)
    expect(message).not.toContain('/bot123456')
  })
})
