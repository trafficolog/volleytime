import { organizationService } from '@volley-time/core'
import {
  and,
  closeDb,
  db,
  eq,
  groupPageComplaints,
  groupPageComplaintThrottle,
  notifications,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import type {
  PlatformGroupPageCities,
  PlatformGroupPageComplaints,
  PlatformGroupPageHistory,
  PlatformGroupPagesList,
  PublicGroupPageView,
} from '@volley-time/shared'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 24.1.3 (R-06): решения root по странице группы действуют на публичную страницу, её API,
 * короткую ссылку, каталог и sitemap; владелец не меняет индексацию, пока решение действует;
 * жалобы посетителей без входа с лимитом 3 в сутки на устройство; всё root-API — только root.
 */
describe('group page moderation (24.1.3)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let rootId: number
  let ownerId: number
  let organizerId: number
  let orgId: number
  let slug: string

  const setOrg = (patch: Partial<typeof organizations.$inferInsert>, id = orgId) =>
    db.update(organizations).set(patch).where(eq(organizations.id, id))
  const page = () => request('GET', `/api/public/groups/${slug}`)
  const act = (body: unknown, user = rootId) =>
    request('POST', `/api/platform/group-pages/${orgId}/moderation`, { user, body })
  const restore = (user = rootId) =>
    request('POST', `/api/platform/group-pages/${orgId}/restore`, { user })
  const complain = (body: unknown, ip = '203.0.113.7', user?: number) =>
    request('POST', `/api/public/groups/${slug}/complaints`, {
      body,
      user,
      headers: { 'x-forwarded-for': ip },
    })
  const sitemap = async () => (await request('GET', '/sitemap.xml')).text
  const catalog = () => request('GET', `/api/public/catalog/${encodeURIComponent('Минск')}`)
  const feedOf = (userId: number) =>
    db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, userId),
          eq(notifications.type, 'organizer_action_required'),
        ),
      )

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    vi.stubEnv('TRUSTED_PROXY', '1')
    const tag = crypto.randomUUID()
    const rows = await db
      .insert(users)
      .values([
        { email: `gpm-root-${tag}@t.by`, name: 'Анна Модератор', isRootAdmin: true },
        { email: `gpm-owner-${tag}@t.by`, name: 'Олег Владелец' },
        { email: `gpm-org-${tag}@t.by`, name: 'Ира Организатор' },
      ])
      .returning()
    ;[rootId, ownerId, organizerId] = rows.map((r) => r.id) as [number, number, number]
    const org = await organizationService.create({ userId: ownerId }, { name: 'Волей на Немиге' })
    orgId = org.id
    slug = org.slug
    await db
      .insert(organizationMembers)
      .values({ userId: organizerId, organizationId: orgId, role: 'organizer', status: 'active' })
    await setOrg({ publicPageEnabled: true, seoIndex: true, city: 'Минск', shortLink: 'nemiga' })
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(groupPageComplaintThrottle)
    await db.delete(organizations)
    await db.delete(users)
  })
  afterAll(closeDb)

  it('ACCESS: every root endpoint answers 401 without a session and 403 to a group owner', async () => {
    const calls: [string, string][] = [
      ['GET', '/api/platform/group-pages/cities'],
      ['GET', '/api/platform/group-pages'],
      ['GET', `/api/platform/group-pages/${orgId}/history`],
      ['POST', `/api/platform/group-pages/${orgId}/moderation`],
      ['POST', `/api/platform/group-pages/${orgId}/restore`],
      ['GET', '/api/platform/group-page-complaints'],
      ['POST', '/api/platform/group-page-complaints/1/reject'],
      ['POST', '/api/platform/group-page-complaints/1/resolve'],
    ]
    for (const [method, url] of calls) {
      const body = method === 'POST' ? {} : undefined
      expect((await request(method, url, { body })).status, url).toBe(401)
      const res = await request(method, url, { user: ownerId, body })
      expect(res.status, url).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
    }
  })

  it('hidden: page, API, short link, catalog and sitemap answer like an unpublished page', async () => {
    expect((await page()).status).toBe(200)
    expect(await sitemap()).toContain(`/g/${slug}`)
    expect((await catalog()).status).toBe(200)

    const res = await act({ state: 'hidden', reasonCode: 'inactive', note: 'Создайте событие' })
    expect(res.status, res.text).toBe(200)
    expect(res.body).toMatchObject({
      state: 'hidden',
      moderation: { reasonCode: 'inactive', decidedBy: { id: rootId, name: 'Анна Модератор' } },
    })

    const hidden = await page()
    expect(hidden.status).toBe(404)
    expect(hidden.headers.get('cache-control')).toBe('no-store')
    const unknown = await request('GET', '/api/public/groups/no-such-group')
    expect(hidden.text).toBe(unknown.text)
    expect((await request('GET', '/nemiga')).status).toBe(404)
    expect((await catalog()).status).toBe(404)
    expect(await sitemap()).not.toContain(`/g/${slug}`)
    const complaint = await complain({ reasonCode: 'price' })
    expect(complaint.status).toBe(404)
    expect(complaint.body).toMatchObject({ data: { code: 'group_page.not_found' } })

    expect((await restore()).status).toBe(200)
    expect((await page()).status).toBe(200)
    expect((await request('GET', '/nemiga')).status).toBe(302)
    expect(await sitemap()).toContain(`/g/${slug}`)
  })

  it('noindex: the page opens but is not indexable, and leaves the sitemap and catalog', async () => {
    expect(((await page()).body as PublicGroupPageView).indexable).toBe(true)
    expect((await act({ state: 'noindex', reasonCode: 'price' })).status).toBe(200)
    const res = await page()
    expect(res.status).toBe(200)
    expect(res.headers.get('x-robots-tag')).toContain('noindex')
    expect((res.body as PublicGroupPageView).indexable).toBe(false)
    expect(await sitemap()).not.toContain(`/g/${slug}`)
    expect((await catalog()).status).toBe(404)
    expect((await request('GET', '/nemiga')).status).toBe(302)
  })

  it('the owner sees the reason without the moderator; the seoIndex toggle is locked', async () => {
    await act({ state: 'noindex', reasonCode: 'price', note: 'Исправьте блок «Цены»' })
    for (const user of [ownerId, organizerId]) {
      const gp = await request('GET', `/api/organizations/${orgId}/group-page`, { user })
      expect(gp.status, gp.text).toBe(200)
      expect(gp.body).toMatchObject({
        page: {
          seoIndex: true,
          moderation: {
            state: 'noindex',
            reasonCode: 'price',
            reasonTitle: 'Цены не совпадают с записью',
            note: 'Исправьте блок «Цены»',
          },
        },
      })
      expect(gp.text).not.toContain('Анна Модератор')
      expect(gp.text).not.toContain(String(rootId))
    }
    const patch = (body: unknown) =>
      request('PATCH', `/api/organizations/${orgId}/settings`, { user: ownerId, body })
    const locked = await patch({ seoIndex: false })
    expect(locked.status).toBe(409)
    expect(locked.body).toMatchObject({ data: { code: 'group_page.moderation_locked' } })
    // то же значение — не изменение; прочие настройки и публикация не заблокированы
    expect((await patch({ seoIndex: true })).status).toBe(200)
    expect((await patch({ district: 'Центр' })).status).toBe(200)

    await restore()
    const free = await patch({ seoIndex: false })
    expect(free.status, free.text).toBe(200)
    const gp = await request('GET', `/api/organizations/${orgId}/group-page`, { user: ownerId })
    expect(gp.body).toMatchObject({ page: { moderation: null, seoIndex: false } })
  })

  it('a decision needs a reason; repeats and noindex over the owner noindex are conflicts', async () => {
    expect((await act({ state: 'hidden' })).status).toBe(422)
    expect((await act({ state: 'hidden', reasonCode: 'rude' })).status).toBe(422)
    expect((await act({ state: 'banned', reasonCode: 'price' })).status).toBe(422)
    expect(
      (await act({ state: 'hidden', reasonCode: 'price', note: 'x'.repeat(1001) })).status,
    ).toBe(422)
    const none = await restore()
    expect(none.status).toBe(409)
    expect(none.body).toMatchObject({ data: { code: 'group_page.not_moderated' } })

    await setOrg({ seoIndex: false })
    const own = await act({ state: 'noindex', reasonCode: 'spam' })
    expect(own.status).toBe(409)
    expect(own.body).toMatchObject({ data: { code: 'group_page.owner_noindex' } })
    expect((await act({ state: 'hidden', reasonCode: 'spam' })).status).toBe(200)
    const again = await act({ state: 'hidden', reasonCode: 'price' })
    expect(again.status).toBe(409)
    expect(again.body).toMatchObject({ data: { code: 'group_page.moderation_same_state' } })
    // смена hidden → noindex — новое решение
    expect((await act({ state: 'noindex', reasonCode: 'price' })).status).toBe(200)
    const missing = await request('POST', '/api/platform/group-pages/999999/moderation', {
      user: rootId,
      body: { state: 'hidden', reasonCode: 'price' },
    })
    expect(missing.status).toBe(404)
  })

  it('owner and organizers get the decision and the restore in the feed; the player does not', async () => {
    await act({ state: 'hidden', reasonCode: 'inactive', note: 'Нет событий 60 дней' })
    await vi.waitFor(async () => expect(await feedOf(organizerId)).toHaveLength(1), {
      timeout: 5000,
    })
    const [row] = await feedOf(ownerId)
    expect(row!.payload).toMatchObject({
      template: 'group_page_hidden',
      params: {
        kind: 'group_page_hidden',
        organizationId: orgId,
        organizationName: 'Волей на Немиге',
        reasonTitle: 'Группа не проводит игры',
        note: 'Нет событий 60 дней',
      },
    })
    expect(JSON.stringify(row!.payload)).not.toContain('Анна Модератор')
    await restore()
    await vi.waitFor(async () => expect(await feedOf(ownerId)).toHaveLength(2), { timeout: 5000 })
    expect((await feedOf(rootId)).length).toBe(0)
  })

  it('complaints: no login needed, 3 a day per device, the reporter stays hidden from the group', async () => {
    const ok = await complain({ reasonCode: 'price', details: 'На странице 10 BYN, списали 15' })
    expect(ok.status, ok.text).toBe(201)
    expect(ok.body).toEqual({ ok: true })
    expect((await complain({ reasonCode: 'media' }, '203.0.113.7', ownerId)).status).toBe(201)
    expect((await complain({ reasonCode: 'other' })).status).toBe(201)
    const limited = await complain({ reasonCode: 'other' })
    expect(limited.status).toBe(429)
    expect(limited.body).toMatchObject({ data: { code: 'group_page.complaint_limited' } })
    expect((await complain({ reasonCode: 'other' }, '198.51.100.2')).status).toBe(201)
    expect((await complain({ reasonCode: 'spam' }, '198.51.100.2')).status).toBe(422)
    expect(
      (await complain({ reasonCode: 'other', details: 'x'.repeat(501) }, '198.51.100.3')).status,
    ).toBe(422)

    const stored = await db.select().from(groupPageComplaints)
    expect(stored).toHaveLength(4)
    for (const c of stored) {
      expect(c.reporterHash).toMatch(/^[0-9a-f]{64}$/)
      expect(JSON.stringify(c)).not.toContain('203.0.113.7')
    }

    const list = await request('GET', '/api/platform/group-page-complaints', { user: rootId })
    expect(list.status, list.text).toBe(200)
    const body = list.body as PlatformGroupPageComplaints
    expect(body.items).toHaveLength(4)
    expect(body.stats).toMatchObject({ open: 4, limited30d: 1 })
    expect(body.items.find((c) => c.reasonCode === 'media')!.reporter).toMatchObject({
      kind: 'user',
      id: ownerId,
    })
    expect(body.items.find((c) => c.reasonCode === 'price')).toMatchObject({
      reporter: { kind: 'anonymous' },
      details: 'На странице 10 BYN, списали 15',
      pageState: 'index',
    })
    expect(JSON.stringify(body)).not.toContain('reporterHash')

    // группа о жалобах и их авторах не узнаёт
    const gp = await request('GET', `/api/organizations/${orgId}/group-page`, { user: ownerId })
    expect(gp.text).not.toContain('complaint')
    expect(gp.text).not.toContain('10 BYN, списали')
  })

  it('root rejects a complaint or acts on the page from it; history shows both', async () => {
    await complain({ reasonCode: 'price' })
    await complain({ reasonCode: 'inactive' })
    const items = (
      (await request('GET', '/api/platform/group-page-complaints', { user: rootId }))
        .body as PlatformGroupPageComplaints
    ).items
    const price = items.find((c) => c.reasonCode === 'price')!
    const inactive = items.find((c) => c.reasonCode === 'inactive')!

    const rejected = await request(
      'POST',
      `/api/platform/group-page-complaints/${price.id}/reject`,
      {
        user: rootId,
      },
    )
    expect(rejected.status, rejected.text).toBe(200)
    const twice = await request('POST', `/api/platform/group-page-complaints/${price.id}/reject`, {
      user: rootId,
    })
    expect(twice.status).toBe(409)
    expect(twice.body).toMatchObject({ data: { code: 'group_page.complaint_closed' } })
    expect((await page()).status).toBe(200)

    const resolved = await request(
      'POST',
      `/api/platform/group-page-complaints/${inactive.id}/resolve`,
      { user: rootId, body: { state: 'hidden', reasonCode: 'inactive' } },
    )
    expect(resolved.status, resolved.text).toBe(200)
    expect(resolved.body).toMatchObject({ page: { state: 'hidden' } })
    expect((await page()).status).toBe(404)

    const closed = (
      await request('GET', '/api/platform/group-page-complaints?status=closed', { user: rootId })
    ).body as PlatformGroupPageComplaints
    expect(closed.items.map((c) => [c.status, c.resolution]).sort()).toEqual([
      ['rejected', 'no_violation'],
      ['resolved', 'hidden'],
    ])
    expect(closed.stats).toMatchObject({ open: 0, closed30d: 2 })
    const fresh = (await request('GET', '/api/platform/group-page-complaints', { user: rootId }))
      .body as PlatformGroupPageComplaints
    expect(fresh.items).toHaveLength(0)

    const history = await request('GET', `/api/platform/group-pages/${orgId}/history`, {
      user: rootId,
    })
    expect(history.status, history.text).toBe(200)
    const h = history.body as PlatformGroupPageHistory
    expect(h.page).toMatchObject({ state: 'hidden', newComplaints: 0 })
    expect(h.entries.map((e) => e.kind).sort()).toEqual(['complaint', 'complaint', 'hidden'])
    expect(h.entries.find((e) => e.kind === 'hidden')!.actor).toMatchObject({ id: rootId })
    expect(h.entries.filter((e) => e.kind === 'complaint').every((e) => e.actor === null)).toBe(
      true,
    )
  })

  it('cities and pages: the reference list with counts, filters and search', async () => {
    const brest = await organizationService.create({ userId: ownerId }, { name: 'Брест Волей' })
    await setOrg({ publicPageEnabled: true, seoIndex: false, city: 'брест ' }, brest.id)
    const draft = await organizationService.create({ userId: ownerId }, { name: 'Черновик' })
    await setOrg({ publicPageEnabled: false, city: 'Минск' }, draft.id)
    const abroad = await organizationService.create({ userId: ownerId }, { name: 'Вильнюс Волей' })
    await setOrg({ publicPageEnabled: true, city: 'Вильнюс' }, abroad.id)
    await act({ state: 'hidden', reasonCode: 'spam' })

    const res = await request('GET', '/api/platform/group-pages/cities', { user: rootId })
    expect(res.status, res.text).toBe(200)
    const c = res.body as PlatformGroupPageCities
    const city = (name: string) => c.regions.flatMap((r) => r.cities).find((x) => x.name === name)!
    expect(c.regions[0]!.region).toBe('Минск')
    expect(city('Минск')).toMatchObject({ pages: 1, hidden: 1, issues: 1 })
    expect(city('Брест')).toMatchObject({ pages: 1, indexed: 0, issues: 0 })
    expect(city('Пинск')).toMatchObject({ pages: 0 })
    expect(c.other).toEqual([expect.objectContaining({ name: 'Вильнюс', pages: 1 })])
    expect(c.totals).toMatchObject({ pages: 3, hidden: 1, citiesWithPages: 3 })

    const list = async (q: string) =>
      (await request('GET', `/api/platform/group-pages${q}`, { user: rootId }))
        .body as PlatformGroupPagesList
    expect((await list('?city=Брест')).items).toEqual([
      expect.objectContaining({ organizationId: brest.id, state: 'own', moderation: null }),
    ])
    expect((await list('?filter=moderated')).items.map((p) => p.organizationId)).toEqual([orgId])
    expect((await list('?q=немиг')).items.map((p) => p.organizationId)).toEqual([orgId])
    expect((await list('')).items.map((p) => p.name)).not.toContain('Черновик')
  })
})
