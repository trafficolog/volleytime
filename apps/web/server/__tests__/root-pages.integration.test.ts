import { closeDb, db, organizations, users } from '@volley-time/db'
import * as h3 from 'h3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/** Task 22.1.1: страницы `/root/**` отдают 403 вошедшему не-root ещё до загрузки приложения. */
describe('server middleware for /root pages (integration)', () => {
  let call: (path: string, user?: number) => Promise<number>
  let rootId: number
  let plainId: number

  beforeAll(async () => {
    await createTestApi()
    const mod = await import('../middleware/root-pages')
    const app = h3.createApp()
    app.use(mod.default)
    app.use(h3.defineEventHandler(() => 'page'))
    const web = h3.toWebHandler(app)
    call = async (path, user) =>
      (
        await web(
          new Request(`http://test${path}`, {
            headers: user ? { 'x-test-user': String(user) } : {},
          }),
        )
      ).status
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([{ name: 'Root', isRootAdmin: true }, { name: 'Plain' }])
      .returning()
    rootId = people[0]!.id
    plainId = people[1]!.id
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it.each(['/root', '/root/', '/root/organizations', '/root?x=1'])(
    '403 for a signed-in user without the root flag on %s',
    async (path) => {
      expect(await call(path, plainId)).toBe(403)
    },
  )

  it('lets root and signed-out visitors reach the app (it redirects to sign-in itself)', async () => {
    expect(await call('/root', rootId)).toBe(200)
    expect(await call('/root')).toBe(200)
  })

  it('does not touch other pages', async () => {
    expect(await call('/app', plainId)).toBe(200)
    expect(await call('/rooted', plainId)).toBe(200)
    expect(await call('/', plainId)).toBe(200)
  })
})
