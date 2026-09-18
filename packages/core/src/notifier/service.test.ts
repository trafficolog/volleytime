import { closeDb, db, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { notifierService, setNotifierTransport } from './service'
import type { NotifyPayload } from './types'

let sent: NotifyPayload[] = []

describe('notifierService (integration)', () => {
  beforeEach(async () => {
    await db.delete(users)
    sent = []
    setNotifierTransport({
      async send(p) {
        sent.push(p)
      },
    })
  })

  it('sends to user with telegram id', async () => {
    const [u] = await db
      .insert(users)
      .values({ email: `n-${Math.random()}@t.by`, telegramUserId: 555n })
      .returning()
    const ok = await notifierService.send(u!.id, 'booking_confirmed', { eventTitle: 'Тренировка' })
    expect(ok).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.telegramId).toBe('555')
    expect(sent[0]?.text).toContain('Тренировка')
  })

  it('skips user without telegram id (no throw)', async () => {
    const [u] = await db
      .insert(users)
      .values({ email: `n2-${Math.random()}@t.by` })
      .returning()
    const ok = await notifierService.send(u!.id, 'booking_confirmed', {})
    expect(ok).toBe(false)
    expect(sent).toHaveLength(0)
  })

  it('does not throw when transport fails (fire-and-forget)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setNotifierTransport({
      async send() {
        throw new Error('bot down')
      },
    })
    const [u] = await db
      .insert(users)
      .values({ email: `n3-${Math.random()}@t.by`, telegramUserId: 777n })
      .returning()
    const ok = await notifierService.send(u!.id, 'booking_confirmed', {})
    expect(ok).toBe(false) // не упало
    errSpy.mockRestore()
  })

  it('sendMany delivers to multiple users', async () => {
    const [a] = await db
      .insert(users)
      .values({ email: `a-${Math.random()}@t.by`, telegramUserId: 111n })
      .returning()
    const [b] = await db
      .insert(users)
      .values({ email: `b-${Math.random()}@t.by`, telegramUserId: 222n })
      .returning()
    const count = await notifierService.sendMany([
      { userId: a!.id, type: 'event_cancelled', params: { eventTitle: 'X' } },
      { userId: b!.id, type: 'event_cancelled', params: { eventTitle: 'X' } },
    ])
    expect(count).toBe(2)
    expect(sent).toHaveLength(2)
  })

  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })
})
