import {
  eventService,
  groupPageService,
  organizationService,
  venueService,
} from '@volley-time/core'
import {
  closeDb,
  db,
  eq,
  organizationGroupPages,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { defaultGroupPageContent, type PublicGroupPageView } from '@volley-time/shared'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

/** Task 24.1.2 (W-14): публичная страница группы, каталог города, sitemap и короткая ссылка. */
describe('public group page (24.1.2)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let playerId: number
  let orgId: number
  let slug: string
  const ctx = () => ({ userId: ownerId })

  const setOrg = (patch: Partial<typeof organizations.$inferInsert>, id = orgId) =>
    db.update(organizations).set(patch).where(eq(organizations.id, id))
  const page = () => request('GET', `/api/public/groups/${slug}`)
  const view = async () => {
    const res = await page()
    expect(res.status, res.text).toBe(200)
    return res.body as PublicGroupPageView
  }
  const event = (o: Record<string, unknown> = {}) =>
    eventService.create(ctx(), orgId, {
      title: 'Открытая игра',
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 93_600_000),
      capacity: 12,
      price: 1500,
      ...o,
    })
  const withSection = (kind: string, patch: Record<string, unknown>) => {
    const c = defaultGroupPageContent()
    Object.assign(
      c.sections.find((s) => s.kind === kind)!,
      patch,
    )
    return c
  }

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    vi.stubEnv('EVENT_INVITE_MODE_ENABLED', 'true')
    const tag = crypto.randomUUID()
    const rows = await db
      .insert(users)
      .values(
        ['owner', 'player'].map((n) => ({
          email: `gpub-${n}-${tag}@t.by`,
          name: n === 'player' ? 'Мария Секретова' : 'Олег Владелец',
          telegramUsername: `${n}_${tag.slice(0, 6)}`,
        })),
      )
      .returning()
    ;[ownerId, playerId] = rows.map((r) => r.id) as [number, number]
    const org = await organizationService.create(ctx(), { name: 'Пятничный волейбол' })
    orgId = org.id
    slug = org.slug
    await db.insert(organizationMembers).values({
      userId: playerId,
      organizationId: orgId,
      role: 'player',
      status: 'active',
      level: 'v2',
    })
    await setOrg({ publicPageEnabled: true, city: 'Минск', district: 'Центр', levels: ['v2'] })
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations)
    await db.delete(users)
  })
  afterAll(closeDb)

  it('a group that did not publish its page answers 404, like an unknown slug', async () => {
    await setOrg({ publicPageEnabled: false })
    for (const s of [slug, 'no-such-group', 'BAD%20slug']) {
      const res = await request('GET', `/api/public/groups/${s}`)
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
  })

  it('serves the published page without a session, with cache and robots headers', async () => {
    const res = await page()
    expect(res.status, res.text).toBe(200)
    expect(res.headers.get('cache-control')).toMatch(/^public, max-age=15/)
    expect(res.headers.get('x-robots-tag')).toContain('noindex')
    const v = res.body as PublicGroupPageView
    expect(v).toMatchObject({
      slug,
      indexable: false,
      meta: { title: 'Пятничный волейбол — волейбол, Минск' },
      group: { name: 'Пятничный волейбол', city: 'Минск', district: 'Центр' },
    })
    expect(v.group.levels).toHaveLength(1)
    expect(v.sections.map((s) => s.kind)).toEqual(['cover', 'about', 'schedule', 'formats', 'join'])
  })

  it('suspended, archived and deleted groups are hidden', async () => {
    for (const patch of [
      { status: 'suspended' as const },
      { status: 'archived' as const },
      { deletedAt: new Date(), restoreUntil: new Date(Date.now() + 86_400_000) },
    ]) {
      await setOrg({ status: 'active', deletedAt: null, restoreUntil: null, ...patch })
      expect((await page()).status).toBe(404)
    }
  })

  it('ACCESS: invite-only, draft, cancelled and past events are not on the page (owner 2026-11-23)', async () => {
    const open = await event({ title: 'Открытая' })
    await event({ title: 'По приглашению', joinMode: 'invite' })
    await event({ title: 'Черновик', status: 'draft' })
    const cancelled = await event({ title: 'Отменённая' })
    await eventService.cancel(ctx(), cancelled.id)
    const v = await view()
    const schedule = v.sections.find((s) => s.kind === 'schedule')
    expect(schedule).toMatchObject({ events: [{ title: 'Открытая', status: 'published' }] })
    expect(schedule && 'events' in schedule && schedule.events[0]!.publicSlug).toBe(open.publicSlug)
    expect(JSON.stringify(v)).not.toContain('По приглашению')
  })

  it('PRIVACY: no members, roster, payments, event prices, emails or internal event ids', async () => {
    await event()
    await groupPageService.update(ctx(), orgId, withSection('prices', { text: 'Разовое — 15 BYN' }))
    const res = await page()
    const text = res.text
    for (const secret of ['Мария', 'Секретова', 'Олег', '@t.by', 'player_', 'owner_']) {
      expect(text).not.toContain(secret)
    }
    for (const key of [
      '"price"',
      '"roster"',
      '"capacity"',
      '"taken"',
      '"venueId"',
      '"ownerUserId"',
      '"members"',
      '"memberCount"',
      '"telegramChat',
    ]) {
      expect(text).not.toContain(key)
    }
    expect((res.body as PublicGroupPageView).sections).toContainEqual({
      kind: 'prices',
      text: 'Разовое — 15 BYN',
    })
  })

  it('an archived venue is not shown; the venues section without venues is not rendered', async () => {
    const a = await venueService.create(ctx(), {
      organizationId: orgId,
      name: 'Зал А',
      address: 'ул. Мира, 1',
    })
    const b = await venueService.create(ctx(), { organizationId: orgId, name: 'Зал Б' })
    await groupPageService.update(ctx(), orgId, withSection('venues', { venueIds: [b.id, a.id] }))
    let venues = (await view()).sections.find((s) => s.kind === 'venues')
    expect(venues).toEqual({
      kind: 'venues',
      venues: [
        { name: 'Зал Б', address: null },
        { name: 'Зал А', address: 'ул. Мира, 1' },
      ],
    })
    await venueService.archive(ctx(), a.id, orgId)
    venues = (await view()).sections.find((s) => s.kind === 'venues')
    expect(venues).toEqual({ kind: 'venues', venues: [{ name: 'Зал Б', address: null }] })
    await venueService.archive(ctx(), b.id, orgId)
    expect((await view()).sections.some((s) => s.kind === 'venues')).toBe(false)
  })

  it('stored data that fails the schema does not break the page: sections fall back to defaults', async () => {
    await groupPageService.update(
      ctx(),
      orgId,
      withSection('about', { text: 'Играем по пятницам' }),
    )
    const [row] = await db.select().from(organizationGroupPages)
    const broken = (row!.sections as Record<string, unknown>[]).map((s) =>
      s.kind === 'faq' ? { kind: 'faq', enabled: true, items: 'oops' } : s,
    )
    await db
      .update(organizationGroupPages)
      .set({ sections: [...broken, { kind: 'mystery' }] })
      .where(eq(organizationGroupPages.organizationId, orgId))
    const v = await view()
    expect(v.sections.find((s) => s.kind === 'about')).toMatchObject({ text: 'Играем по пятницам' })
    expect(v.sections.some((s) => s.kind === 'faq')).toBe(false)
    expect(v.meta.title).toBe('Пятничный волейбол — волейбол, Минск')
  })

  it('sitemap lists only published indexable groups and their city catalogs', async () => {
    const other = await organizationService.create(ctx(), { name: 'Скрытая группа' })
    await setOrg({ publicPageEnabled: true, seoIndex: false, city: 'Брест' }, other.id)
    const draft = await organizationService.create(ctx(), { name: 'Неопубликованная' })
    await setOrg({ publicPageEnabled: false, seoIndex: true, city: 'Гродно' }, draft.id)

    let xml = (await request('GET', '/sitemap.xml')).text
    expect(xml).not.toContain(`/minsk/${slug}`)
    await setOrg({ seoIndex: true })
    const res = await request('GET', '/sitemap.xml')
    expect(res.headers.get('content-type')).toContain('application/xml')
    xml = res.text
    expect(xml).toMatch(new RegExp(`<loc>https?://[^<]+/minsk/${slug}</loc>`))
    expect(xml).toContain(`/minsk</loc>`)
    expect(xml).not.toContain(other.slug)
    expect(xml).not.toContain(draft.slug)
    expect(xml).not.toContain('/brest<')
    expect(xml).not.toContain('/grodno<')
    expect((await request('GET', '/robots.txt')).text).toMatch(
      /Sitemap: https?:\/\/\S+\/sitemap\.xml/,
    )
  })

  it('catalog lists only indexable groups of the city, ignoring case and spaces', async () => {
    const hidden = await organizationService.create(ctx(), { name: 'Без индексации' })
    await setOrg({ publicPageEnabled: true, seoIndex: false, city: 'Минск' }, hidden.id)
    const city = (c: string) => request('GET', `/api/public/catalog/${encodeURIComponent(c)}`)
    expect((await city('Минск')).status).toBe(404)
    await setOrg({ seoIndex: true, city: '  Минск ' })
    const res = await city('минск')
    expect(res.status, res.text).toBe(200)
    expect(res.body).toMatchObject({
      city: 'Минск',
      groups: [{ slug, name: 'Пятничный волейбол' }],
    })
    expect(JSON.stringify(res.body)).not.toContain('Без индексации')
    expect((await city('Пинск')).status).toBe(404)
  })

  it('a short link redirects to the published page; an unpublished group does not', async () => {
    await setOrg({ shortLink: 'friday-minsk' })
    const res = await request('GET', '/friday-minsk')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(`/minsk/${slug}`)
    await setOrg({ publicPageEnabled: false })
    expect((await request('GET', '/friday-minsk')).status).toBe(404)
  })

  it('the owner publishes the page through PATCH settings; an organizer cannot', async () => {
    await setOrg({ publicPageEnabled: false })
    const organizer = (
      await db
        .insert(users)
        .values({ email: `gpub-org-${crypto.randomUUID()}@t.by` })
        .returning()
    )[0]!.id
    await db
      .insert(organizationMembers)
      .values({ userId: organizer, organizationId: orgId, role: 'organizer', status: 'active' })
    const patch = (user: number, value: boolean) =>
      request('PATCH', `/api/organizations/${orgId}/settings`, {
        user,
        body: { publicPageEnabled: value },
      })
    expect((await patch(organizer, true)).status).toBe(403)
    expect((await page()).status).toBe(404)
    const ok = await patch(ownerId, true)
    expect(ok.status, ok.text).toBe(200)
    expect(ok.body).toMatchObject({ settings: { publicPageEnabled: true } })
    expect((await page()).status).toBe(200)
    const gp = await request('GET', `/api/organizations/${orgId}/group-page`, { user: ownerId })
    expect(gp.body).toMatchObject({ page: { publicPageEnabled: true } })
  })

  it('CONCURRENCY: reads during parallel saves always return a whole page', async () => {
    const saves = Array.from({ length: 6 }, (_, i) =>
      groupPageService.update(ctx(), orgId, withSection('prices', { text: `Цена ${i}` })),
    )
    const reads = Array.from({ length: 6 }, () => page())
    const results = await Promise.all([...saves, ...reads])
    for (const res of results.slice(6) as Awaited<ReturnType<typeof page>>[]) {
      expect(res.status).toBe(200)
      const v = res.body as PublicGroupPageView
      expect(v.sections.filter((s) => s.kind === 'cover')).toHaveLength(1)
    }
    const prices = (await view()).sections.find((s) => s.kind === 'prices')
    expect(prices).toMatchObject({ text: expect.stringMatching(/^Цена \d$/) })
  })
})
