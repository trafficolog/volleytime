import { organizationService } from '@volley-time/core'
import {
  closeDb,
  db,
  eq,
  groupPageAddresses,
  groupPageModeration,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import type { PublicCatalogView, PublicGroupPageView } from '@volley-time/shared'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 24.2.1 (D-26): адрес страницы группы `/{город}/{группа}`, 301 со старых адресов (`/g/<slug>`,
 * прежний город или slug, `/volleyball/<город>`), sitemap, каталог и короткая ссылка — на новые
 * адреса; скрытая root страница — 404 по любому адресу; slug и город меняет только владелец.
 */
describe('group page city URLs (24.2.1)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let otherOwnerId: number
  let orgId: number
  let slug: string

  const setOrg = (patch: Partial<typeof organizations.$inferInsert>, id = orgId) =>
    db.update(organizations).set(patch).where(eq(organizations.id, id))
  const patch = (body: Record<string, unknown>, user = ownerId, id = orgId) =>
    request('PATCH', `/api/organizations/${id}/settings`, { user, body })
  const get = (url: string) => request('GET', url)
  const location = async (url: string) => {
    const res = await get(url)
    return { status: res.status, location: res.headers.get('location') }
  }
  const history = async () =>
    (await db.select().from(groupPageAddresses)).map((r) => `${r.citySlug}/${r.groupSlug}`).sort()

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    const tag = crypto.randomUUID()
    const rows = await db
      .insert(users)
      .values(['owner', 'organizer', 'other'].map((n) => ({ email: `gpa-${n}-${tag}@t.by` })))
      .returning()
    ;[ownerId, organizerId, otherOwnerId] = rows.map((r) => r.id) as [number, number, number]
    const org = await organizationService.create({ userId: ownerId }, { name: 'VT Minsk' })
    orgId = org.id
    slug = org.slug
    await db
      .insert(organizationMembers)
      .values({ userId: organizerId, organizationId: orgId, role: 'organizer', status: 'active' })
    await setOrg({ publicPageEnabled: true, seoIndex: true, city: 'Минск' })
  })
  afterEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })
  afterAll(closeDb)

  it('the page lives at /{city}/{group}; /g/<slug> answers 301 there, keeping the query', async () => {
    expect(slug).toBe('vt-minsk')
    const view = (await get(`/api/public/groups/${slug}`)).body as PublicGroupPageView
    expect(view.path).toBe('/minsk/vt-minsk')
    expect(await location('/g/vt-minsk')).toEqual({ status: 301, location: '/minsk/vt-minsk' })
    expect(await location('/g/vt-minsk/')).toEqual({ status: 301, location: '/minsk/vt-minsk' })
    expect(await location('/g/vt-minsk?utm_source=tg')).toEqual({
      status: 301,
      location: '/minsk/vt-minsk?utm_source=tg',
    })
    // HEAD — тот же ответ; POST и прочие методы не перенаправляются
    expect((await request('HEAD', '/g/vt-minsk')).status).toBe(301)
    expect((await request('POST', '/g/vt-minsk')).status).not.toBe(301)
    // действующий адрес не перенаправляется: его рендерит страница приложения
    expect((await get('/minsk/vt-minsk')).status).not.toBe(301)
    // неверный город справочника при верном slug — 301 на действующий адрес
    expect(await location('/brest/vt-minsk')).toEqual({ status: 301, location: '/minsk/vt-minsk' })
    // регистр города и группы не угадывается, неизвестный город и slug — без 301
    for (const url of ['/MINSK/vt-minsk', '/minsk/VT-MINSK', '/nowhere/vt-minsk', '/minsk/nope'])
      expect((await get(url)).status, url).not.toBe(301)
  })

  it('a group outside the city catalog keeps /g/<slug> as its address', async () => {
    await setOrg({ city: 'Вильнюс' })
    expect((await get('/g/vt-minsk')).status).not.toBe(301)
    const view = (await get(`/api/public/groups/${slug}`)).body as PublicGroupPageView
    expect(view.path).toBe('/g/vt-minsk')
    await setOrg({ city: null })
    expect((await get('/g/vt-minsk')).status).not.toBe(301)
  })

  it('ACCESS: a hidden, unpublished or suspended page is 404 by both the new and the old address', async () => {
    await db
      .insert(groupPageModeration)
      .values({ organizationId: orgId, state: 'hidden', reasonCode: 'spam' })
    // прежний адрес из истории тоже не раскрывает скрытую страницу
    await db
      .insert(groupPageAddresses)
      .values({ citySlug: 'brest', groupSlug: 'old-name', organizationId: orgId })
    for (const url of ['/g/vt-minsk', '/minsk/vt-minsk', '/brest/old-name', '/g/old-name'])
      expect((await get(url)).status, url).toBe(404)
    expect((await get(`/api/public/groups/${slug}`)).status).toBe(404)
    await db.delete(groupPageModeration)
    expect(await location('/brest/old-name')).toEqual({
      status: 301,
      location: '/minsk/vt-minsk',
    })
    await setOrg({ publicPageEnabled: false })
    for (const url of ['/g/vt-minsk', '/minsk/vt-minsk', '/brest/old-name'])
      expect((await get(url)).status, url).toBe(404)
    await setOrg({ publicPageEnabled: true, status: 'suspended' })
    for (const url of ['/g/vt-minsk', '/brest/old-name'])
      expect((await get(url)).status, url).toBe(404)
    // noindex root страницу не скрывает: 301 остаётся
    await setOrg({ status: 'active' })
    await db
      .insert(groupPageModeration)
      .values({ organizationId: orgId, state: 'noindex', reasonCode: 'spam' })
    expect(await location('/g/vt-minsk')).toEqual({ status: 301, location: '/minsk/vt-minsk' })
  })

  it('changing the city keeps the old address alive with 301; moving back drops the redirect', async () => {
    const res = await patch({ city: 'Пинск' })
    expect(res.status, res.text).toBe(200)
    expect(await location('/minsk/vt-minsk')).toEqual({ status: 301, location: '/pinsk/vt-minsk' })
    expect(await location('/g/vt-minsk')).toEqual({ status: 301, location: '/pinsk/vt-minsk' })
    expect((await get('/pinsk/vt-minsk')).status).not.toBe(301)
    // назад в Минск: прежний адрес снова действующий, Пинск — в истории
    expect((await patch({ city: 'минск' })).status).toBe(200)
    expect((await get('/minsk/vt-minsk')).status).not.toBe(301)
    expect(await location('/pinsk/vt-minsk')).toEqual({ status: 301, location: '/minsk/vt-minsk' })
    expect(await history()).toEqual(['pinsk/vt-minsk'])
    // переезд за пределы справочника: прежний адрес с городом ведёт на /g/<slug>
    expect((await patch({ city: 'Вильнюс' })).status).toBe(200)
    expect(await location('/minsk/vt-minsk')).toEqual({ status: 301, location: '/g/vt-minsk' })
    // смена района и других настроек адрес не трогает
    expect((await patch({ district: 'Центр' })).status).toBe(200)
    expect(await history()).toEqual(['minsk/vt-minsk', 'pinsk/vt-minsk'])
  })

  it('changing the slug keeps old links: old city address and old /g/<slug> answer 301', async () => {
    const res = await patch({ slug: 'Friday-Minsk' })
    expect(res.status, res.text).toBe(200)
    expect(res.body).toMatchObject({ settings: { slug: 'friday-minsk' } })
    expect(await location('/minsk/vt-minsk')).toEqual({
      status: 301,
      location: '/minsk/friday-minsk',
    })
    expect(await location('/g/vt-minsk')).toEqual({ status: 301, location: '/minsk/friday-minsk' })
    // slug и город разом: все прежние адреса ведут на последний, без цепочек
    expect((await patch({ slug: 'vt-pinsk', city: 'Пинск' })).status).toBe(200)
    for (const old of ['/minsk/vt-minsk', '/minsk/friday-minsk', '/g/friday-minsk', '/g/vt-minsk'])
      expect(await location(old), old).toEqual({ status: 301, location: '/pinsk/vt-pinsk' })
  })

  it('a released slug taken by another group leads to that group, not the old one', async () => {
    expect((await patch({ slug: 'vt-new' })).status).toBe(200)
    const other = await organizationService.create({ userId: otherOwnerId }, { name: 'Другая' })
    await setOrg({ publicPageEnabled: true, city: 'Брест' }, other.id)
    // другая группа занимает освободившийся slug в другом городе
    expect((await patch({ slug: 'vt-minsk' }, otherOwnerId, other.id)).status).toBe(200)
    expect(await location('/g/vt-minsk')).toEqual({ status: 301, location: '/brest/vt-minsk' })
    expect((await get('/brest/vt-minsk')).status).not.toBe(301)
    // прежний адрес первой группы в Минске по-прежнему ведёт на неё
    expect(await location('/minsk/vt-minsk')).toEqual({ status: 301, location: '/minsk/vt-new' })
    // в том же городе: другая группа переезжает в Минск, её действующий адрес важнее истории
    expect((await patch({ city: 'Минск' }, otherOwnerId, other.id)).status).toBe(200)
    expect((await get('/minsk/vt-minsk')).status).not.toBe(301)
    expect(await location('/brest/vt-minsk')).toEqual({ status: 301, location: '/minsk/vt-minsk' })
  })

  it('slug checks: taken (also within the city), bad format, double hyphen, same value', async () => {
    const other = await organizationService.create({ userId: otherOwnerId }, { name: 'Taken' })
    await setOrg({ city: 'Минск' }, other.id)
    const taken = await patch({ slug: other.slug })
    expect(taken.status).toBe(409)
    expect(taken.body).toMatchObject({ data: { code: 'organization.slug_taken' } })
    for (const bad of ['', '-x', 'x-', 'a--b', 'кириллица', 'a/b', 'a b', 'x'.repeat(65), 42])
      expect((await patch({ slug: bad })).status, String(bad)).toBe(422)
    // тот же slug: без изменений и без записи в историю
    expect((await patch({ slug: 'vt-minsk' })).status).toBe(200)
    expect((await patch({ slug: ' VT-MINSK ' })).status).toBe(200)
    expect(await history()).toEqual([])
  })

  it('CONCURRENCY: two groups racing for one slug, exactly one wins', async () => {
    const other = await organizationService.create({ userId: otherOwnerId }, { name: 'Race' })
    const results = await Promise.all([
      patch({ slug: 'race-slug' }),
      patch({ slug: 'race-slug' }, otherOwnerId, other.id),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
  })

  it('IDOR/ROLES: only the owner of this group changes its slug or city', async () => {
    const other = await organizationService.create({ userId: otherOwnerId }, { name: 'Чужая' })
    // организатор группы и владелец другой группы: 403; без сессии: 401
    expect((await patch({ slug: 'hijack' }, organizerId)).status).toBe(403)
    expect((await patch({ city: 'Брест' }, organizerId)).status).toBe(403)
    expect((await patch({ slug: 'hijack' }, otherOwnerId)).status).toBe(403)
    const anon = await request('PATCH', `/api/organizations/${orgId}/settings`, {
      body: { slug: 'x' },
    })
    expect(anon.status).toBe(401)
    // владелец другой группы не может забрать этот slug своей группе
    expect((await patch({ slug }, otherOwnerId, other.id)).status).toBe(409)
    expect(await location('/g/vt-minsk')).toEqual({ status: 301, location: '/minsk/vt-minsk' })
    expect(await history()).toEqual([])
  })

  it('sitemap lists only the new addresses: /{city}/{group} and /{city}', async () => {
    await patch({ city: 'Пинск' })
    const xml = (await get('/sitemap.xml')).text
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/pinsk\/vt-minsk<\/loc>/)
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/pinsk<\/loc>/)
    expect(xml).not.toContain('/g/')
    expect(xml).not.toContain('/volleyball/')
    expect(xml).not.toContain('/minsk')
  })

  it('catalog: /{city} by slug, old /volleyball/<city> answers 301; links go to new addresses', async () => {
    const res = await get('/api/public/catalog/minsk')
    expect(res.status, res.text).toBe(200)
    const view = res.body as PublicCatalogView
    expect(view).toMatchObject({ city: 'Минск', path: '/minsk' })
    expect(view.groups.map((g) => g.path)).toEqual(['/minsk/vt-minsk'])
    for (const name of ['Минск', 'минск'])
      expect(await location(`/volleyball/${encodeURIComponent(name)}`)).toEqual({
        status: 301,
        location: '/minsk',
      })
    // битая кодировка: без 301 и без ошибки
    expect((await get('/volleyball/%E0%A4')).status).not.toBe(301)
    // буква ё не важна: Могилев в настройках ведёт в каталог Могилёва
    await setOrg({ city: 'Могилев' })
    const mog = await get('/api/public/catalog/mogilev')
    expect(mog.status, mog.text).toBe(200)
    expect(mog.body).toMatchObject({ city: 'Могилёв', path: '/mogilev' })
    // город вне справочника остаётся на прежнем адресе каталога
    await setOrg({ city: 'Вильнюс' })
    const vilnius = `/volleyball/${encodeURIComponent('Вильнюс')}`
    expect((await get(vilnius)).status).not.toBe(301)
    const vil = await get(`/api/public/catalog/${encodeURIComponent('Вильнюс')}`)
    expect(vil.body).toMatchObject({ path: vilnius })
  })

  it('a short link leads to the new address; a city slug cannot become a short link', async () => {
    await setOrg({ shortLink: 'friday' })
    expect(await location('/friday')).toEqual({ status: 302, location: '/minsk/vt-minsk' })
    const set = await request('PUT', `/api/organizations/${orgId}/short-link`, {
      user: ownerId,
      body: { shortLink: 'pinsk' },
    })
    expect(set.status).toBe(422)
    expect(set.body).toMatchObject({ data: { code: 'short_link.reserved' } })
  })
})
