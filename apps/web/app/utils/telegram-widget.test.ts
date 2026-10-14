import { describe, expect, it, vi } from 'vitest'

import {
  TELEGRAM_WIDGET_ENDPOINT,
  TELEGRAM_WIDGET_SCRIPT,
  signInWithTelegramWidget,
} from './telegram-widget'

const payload = {
  id: 7302,
  first_name: 'Игрок',
  username: 'p7302',
  auth_date: 1_780_000_000,
  hash: 'a'.repeat(64),
}

describe('signInWithTelegramWidget (JS callback path, D-05)', () => {
  it('hands the whole signed payload to the POST body, never the URL', async () => {
    const post = vi.fn().mockResolvedValue({ userId: 1 })
    expect(await signInWithTelegramWidget(payload, post)).toEqual({ kind: 'ok' })
    expect(post).toHaveBeenCalledExactlyOnceWith(payload)
    expect(TELEGRAM_WIDGET_ENDPOINT).toBe('/api/auth/sign-in/telegram-widget')
    expect(TELEGRAM_WIDGET_ENDPOINT).not.toContain('?')
  })

  it('reports an error when the server rejects the payload', async () => {
    const post = vi.fn().mockRejectedValue(new Error('401'))
    expect(await signInWithTelegramWidget(payload, post)).toEqual({ kind: 'error' })
  })

  it.each([[null], [undefined], ['text'], [42], [[]]])(
    'does not call the server for a non-object payload %j',
    async (bad) => {
      const post = vi.fn()
      expect(await signInWithTelegramWidget(bad, post)).toEqual({ kind: 'error' })
      expect(post).not.toHaveBeenCalled()
    },
  )

  it('loads the official widget script over https from telegram.org', () => {
    expect(TELEGRAM_WIDGET_SCRIPT).toMatch(/^https:\/\/telegram\.org\/js\/telegram-widget\.js/)
  })
})
