import { closeDb, db, eq, users } from '@volley-time/db'
import * as h3 from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
vi.mock('@volley-time/auth', () => ({ auth: { api: { getSession } } }))

/**
 * Task 22.1.4: `requireAuth` — единая точка входа в API и middleware — отсекает заблокированного
 * пользователя на каждом запросе, даже если сессия ещё существует: блокировка действует сразу.
 */
describe('requireAuth with a platform block (integration)', { timeout: 30_000 }, () => {
  let requireAuth: (event: h3.H3Event) => Promise<{ id: number }>
  const event = {} as h3.H3Event
  let userId: number

  beforeAll(async () => {
    Object.assign(globalThis, { createError: h3.createError })
    ;({ requireAuth } = await import('../utils/auth'))
  })
  beforeEach(async () => {
    await db.delete(users)
    userId = (await db.insert(users).values({ name: 'U', email: 'u@vt.test' }).returning())[0]!.id
    getSession.mockResolvedValue({ user: { id: String(userId) } })
  })
  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })

  it('returns the id of an active user', async () => {
    await expect(requireAuth(event)).resolves.toEqual({ id: userId })
  })

  it('403 user.blocked for a blocked user with a live session, and works again after unblock', async () => {
    await db.update(users).set({ isActive: false }).where(eq(users.id, userId))
    await expect(requireAuth(event)).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'user.blocked' },
    })
    await db.update(users).set({ isActive: true }).where(eq(users.id, userId))
    await expect(requireAuth(event)).resolves.toEqual({ id: userId })
  })

  it('401 without a session and for a session of a deleted user', async () => {
    getSession.mockResolvedValue(null)
    await expect(requireAuth(event)).rejects.toMatchObject({ statusCode: 401 })
    getSession.mockResolvedValue({ user: { id: '999999' } })
    await expect(requireAuth(event)).rejects.toMatchObject({ statusCode: 401 })
  })
})
