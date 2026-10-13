import { organizationService } from '@volley-time/core'
import { closeDb, db, eq, organizations, users } from '@volley-time/db'
import * as h3 from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/** Task 19.3.1: гард root-эндпоинтов `/api/platform/…` (фаза 22). */
describe('requireRootAdmin (integration)', () => {
  let call: (user?: number) => Promise<{ status: number; body: unknown }>
  let rootId: number, ownerId: number

  beforeAll(async () => {
    // харнесс ставит auto-imports Nitro (requireAuth по x-test-user, handleServiceError, root-admin)
    await createTestApi()
    const g = globalThis as unknown as {
      requireRootAdmin: (e: h3.H3Event) => Promise<{ id: number }>
    }
    const app = h3.createApp()
    app.use(
      '/api/platform/probe',
      h3.defineEventHandler(async (event) => ({ user: await g.requireRootAdmin(event) })),
    )
    const web = h3.toWebHandler(app)
    call = async (user) => {
      const res = await web(
        new Request('http://test/api/platform/probe', {
          headers: user ? { 'x-test-user': String(user) } : {},
        }),
      )
      return { status: res.status, body: await res.json() }
    }
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    rootId = (
      await db
        .insert(users)
        .values({ email: `root-${Math.random()}@t.by`, isRootAdmin: true })
        .returning()
    )[0]!.id
    ownerId = (
      await db
        .insert(users)
        .values({ email: `owner-${Math.random()}@t.by` })
        .returning()
    )[0]!.id
    await organizationService.create({ userId: ownerId }, { name: 'Org' })
  })

  it('401 without a session', async () => {
    expect((await call()).status).toBe(401)
  })

  it('403 forbidden.root_only for an organization owner', async () => {
    const r = await call(ownerId)
    expect(r.status).toBe(403)
    expect(r.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
  })

  it('root passes', async () => {
    const r = await call(rootId)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ user: { id: rootId } })
  })

  it('revoked root is rejected on the next request', async () => {
    expect((await call(rootId)).status).toBe(200)
    await db.update(users).set({ isRootAdmin: false }).where(eq(users.id, rootId))
    expect((await call(rootId)).status).toBe(403)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
