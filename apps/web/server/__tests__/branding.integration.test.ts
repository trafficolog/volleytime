import { memberService, organizationService } from '@volley-time/core'
import { auditLog, closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

const PNG = Buffer.concat([
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  Buffer.alloc(17, 7),
])
const JPEG = Buffer.concat([Buffer.from('ffd8ffe000104a464946', 'hex'), Buffer.alloc(40, 9)])

function form(data: Buffer | string, type: string, name = 'logo.png', field = 'file'): FormData {
  const f = new FormData()
  f.set(field, new Blob([data], { type }), name)
  return f
}

/** Task 21.2.16: логотип и короткая ссылка группы по HTTP (права, заголовки, лимиты, IDOR). */
describe('organization logo and short link API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let playerId: number
  let outsiderId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  const logo = (id = orgId) => `/api/organizations/${id}/logo`
  const link = (id = orgId) => `/api/organizations/${id}/short-link`

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `brand-${tag}-${Math.random()}@t.by` })
      .returning()
    return u!.id
  }

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    playerId = await newUser('player')
    outsiderId = await newUser('outsider')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Brand HTTP' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: organizerId, role: 'organizer' },
    )
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: playerId })
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('logo upload', () => {
    it('owner and organizer upload PNG and JPEG; the group exposes the version', async () => {
      const png = await request('POST', logo(), { user: ownerId, body: form(PNG, 'image/png') })
      expect(png.status, png.text).toBe(200)
      expect(png.body).toMatchObject({ mimeType: 'image/png', sizeBytes: PNG.length })
      const jpg = await request('POST', logo(), {
        user: organizerId,
        body: form(JPEG, 'image/jpeg', 'logo.jpg'),
      })
      expect(jpg.status, jpg.text).toBe(200)
      const org = await request('GET', `/api/organizations/${orgId}`, { user: playerId })
      expect((org.body as { organization: { logoUpdatedAt: string } }).organization).toMatchObject({
        logoUpdatedAt: (jpg.body as { logoUpdatedAt: string }).logoUpdatedAt,
      })
    })

    it('a player and a non-member cannot upload or delete', async () => {
      for (const user of [playerId, outsiderId]) {
        const up = await request('POST', logo(), { user, body: form(PNG, 'image/png') })
        expect([403]).toContain(up.status)
        const del = await request('DELETE', logo(), { user })
        expect([403]).toContain(del.status)
      }
      expect((await request('GET', logo(), { user: ownerId })).status).toBe(404)
    })

    it('rejects SVG, spoofed types, scripts, wrong field and non-multipart bodies', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
      const cases: [string, unknown, number][] = [
        ['svg', form(svg, 'image/svg+xml', 'logo.svg'), 422],
        ['svg as png', form(svg, 'image/png'), 422],
        ['html as png', form('<html></html>', 'image/png'), 422],
        ['png declared jpeg', form(PNG, 'image/jpeg'), 422],
        ['jpeg declared png', form(JPEG, 'image/png'), 422],
        ['gif', form('GIF89a' + 'x'.repeat(40), 'image/gif', 'a.gif'), 422],
        ['empty file', form(Buffer.alloc(0), 'image/png'), 422],
        ['wrong field', form(PNG, 'image/png', 'logo.png', 'avatar'), 422],
      ]
      for (const [label, body, status] of cases) {
        const res = await request('POST', logo(), { user: ownerId, body })
        expect(res.status, `${label} → ${res.text}`).toBe(status)
      }
      const json = await request('POST', logo(), {
        user: ownerId,
        body: { file: 'x' },
        headers: { 'content-length': '12' },
      })
      expect(json.status).toBe(422)
      expect((await request('GET', logo(), { user: ownerId })).status).toBe(404)
    })

    it('enforces the size limit: 512 KB passes, a bit more is rejected with 413', async () => {
      const ok = Buffer.concat([PNG, Buffer.alloc(524_288 - PNG.length)])
      const accepted = await request('POST', logo(), { user: ownerId, body: form(ok, 'image/png') })
      expect(accepted.status, accepted.text).toBe(200)
      // чуть больше лимита, но в пределах запаса multipart: отклоняет сервис по размеру файла
      const slightly = Buffer.concat([ok, Buffer.alloc(1)])
      const small = await request('POST', logo(), {
        user: ownerId,
        body: form(slightly, 'image/png'),
      })
      expect(small.status).toBe(413)
      // заметно больше: отклоняется по Content-Length до чтения тела
      const huge = Buffer.concat([PNG, Buffer.alloc(600_000)])
      const big = await request('POST', logo(), { user: ownerId, body: form(huge, 'image/png') })
      expect(big.status).toBe(413)
      expect((big.body as { data: { code: string } }).data.code).toBe('logo.too_large')
    })

    it('requires Content-Length', async () => {
      const res = await request('POST', logo(), {
        user: ownerId,
        body: form(PNG, 'image/png'),
        headers: { 'content-length': '' },
      })
      expect(res.status).toBe(411)
    })
  })

  describe('logo download', () => {
    beforeEach(async () => {
      await request('POST', logo(), { user: ownerId, body: form(PNG, 'image/png') })
    })

    it('serves the bytes with a sniff-proof, sandboxed, versioned response', async () => {
      const res = await request('GET', logo(), { user: playerId })
      expect(res.status).toBe(200)
      expect(Buffer.compare(res.bytes, PNG)).toBe(0)
      expect(res.headers.get('content-type')).toBe('image/png')
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox")
      expect(res.headers.get('cache-control')).toBe('private, no-cache')
      expect(res.headers.get('etag')).toMatch(/^"\d+"$/)
    })

    it('answers 304 for a matching If-None-Match and a new body after a replace', async () => {
      const first = await request('GET', logo(), { user: playerId })
      const etag = first.headers.get('etag')!
      const cached = await request('GET', logo(), {
        user: playerId,
        headers: { 'if-none-match': etag },
      })
      expect(cached.status).toBe(304)
      expect(cached.bytes.length).toBe(0)
      await new Promise((r) => setTimeout(r, 5))
      await request('POST', logo(), { user: ownerId, body: form(JPEG, 'image/jpeg', 'l.jpg') })
      const fresh = await request('GET', logo(), {
        user: playerId,
        headers: { 'if-none-match': etag },
      })
      expect(fresh.status).toBe(200)
      expect(fresh.headers.get('content-type')).toBe('image/jpeg')
      expect(fresh.headers.get('etag')).not.toBe(etag)
    })

    it('hides the logo from other groups and anonymous callers', async () => {
      expect((await request('GET', logo())).status).toBe(401)
      const foreign = await request('GET', logo(), { user: outsiderId })
      expect(foreign.status).toBe(403)
      const otherOwner = await request('GET', logo(), { user: otherOwnerId })
      expect(otherOwner.status).toBe(403)
      // у другой группы своего логотипа нет, и она не получает чужой
      expect((await request('GET', logo(otherOrgId), { user: otherOwnerId })).status).toBe(404)
    })

    it('deletes the logo and falls back to the monogram state', async () => {
      const del = await request('DELETE', logo(), { user: organizerId })
      expect(del.status).toBe(200)
      expect((await request('GET', logo(), { user: playerId })).status).toBe(404)
      const org = await request('GET', `/api/organizations/${orgId}`, { user: playerId })
      expect(
        (org.body as { organization: { logoUpdatedAt: string | null } }).organization.logoUpdatedAt,
      ).toBeNull()
      expect((await request('DELETE', logo(), { user: ownerId })).status).toBe(404)
    })

    it('audit records the upload and the removal with the author', async () => {
      await request('DELETE', logo(), { user: organizerId })
      const rows = await db.select().from(auditLog).where(eq(auditLog.organizationId, orgId))
      const actions = rows.map((r) => [r.action, r.userId])
      expect(actions).toContainEqual(['organization.logo_updated', ownerId])
      expect(actions).toContainEqual(['organization.logo_removed', organizerId])
    })
  })

  describe('short link', () => {
    it('owner and organizer set the link; every member sees it on the group', async () => {
      const set = await request('PUT', link(), { user: organizerId, body: { shortLink: 'Brand-1' } })
      expect(set.status, set.text).toBe(200)
      expect(set.body).toEqual({ shortLink: 'brand-1' })
      const org = await request('GET', `/api/organizations/${orgId}`, { user: playerId })
      expect((org.body as { organization: { shortLink: string } }).organization.shortLink).toBe(
        'brand-1',
      )
      const clear = await request('PUT', link(), { user: ownerId, body: { shortLink: null } })
      expect(clear.body).toEqual({ shortLink: null })
    })

    it('a player and a non-member cannot set it', async () => {
      for (const user of [playerId, outsiderId]) {
        const res = await request('PUT', link(), { user, body: { shortLink: 'nope-nope' } })
        expect(res.status).toBe(403)
      }
      const org = await request('GET', `/api/organizations/${orgId}`, { user: ownerId })
      expect((org.body as { organization: { shortLink: unknown } }).organization.shortLink).toBeNull()
    })

    it('answers 422 for format and reserved words, 409 for a taken address', async () => {
      const bad = await request('PUT', link(), { user: ownerId, body: { shortLink: 'a--b' } })
      expect(bad.status).toBe(422)
      const missing = await request('PUT', link(), { user: ownerId, body: {} })
      expect(missing.status).toBe(422)
      for (const word of ['admin', 'api', 'app', 'login']) {
        const res = await request('PUT', link(), { user: ownerId, body: { shortLink: word } })
        expect(res.status, word).toBe(422)
        expect((res.body as { data: { code: string } }).data.code).toBe('short_link.reserved')
      }
      await request('PUT', link(), { user: ownerId, body: { shortLink: 'unique-one' } })
      const taken = await request('PUT', link(otherOrgId), {
        user: otherOwnerId,
        body: { shortLink: 'UNIQUE-one' },
      })
      expect(taken.status).toBe(409)
      expect((taken.body as { data: { code: string } }).data.code).toBe('short_link.taken')
    })

    it("an owner of another group cannot change this group's link", async () => {
      const res = await request('PUT', link(), {
        user: otherOwnerId,
        body: { shortLink: 'hijack-link' },
      })
      expect(res.status).toBe(403)
      const [row] = await db.select().from(organizations).where(eq(organizations.id, orgId))
      expect(row!.shortLink).toBeNull()
    })
  })
})
