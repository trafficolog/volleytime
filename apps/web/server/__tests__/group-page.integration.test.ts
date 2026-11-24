import { memberService, organizationService, venueService } from '@volley-time/core'
import {
  auditLog,
  closeDb,
  db,
  eq,
  events,
  organizationGroupPages,
  organizations,
  users,
} from '@volley-time/db'
import {
  defaultGroupPageContent,
  GROUP_PAGE_LIMITS,
  type GroupPageContent,
  type GroupPageView,
} from '@volley-time/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/** Task 24.1.1 (W-13, D-24): контракт страницы группы — HTTP, права, IDOR, лимиты, индексация. */
describe('group page API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let assistantId: number
  let playerId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  const url = (id = orgId) => `/api/organizations/${id}/group-page`
  const get = async (user = ownerId, id = orgId) => {
    const res = await request('GET', url(id), { user })
    expect(res.status, res.text).toBe(200)
    return (res.body as { page: GroupPageView }).page
  }
  const put = (body: unknown, user = ownerId, id = orgId) =>
    request('PUT', url(id), { user, body: body as Record<string, unknown> })
  const content = (): GroupPageContent => structuredClone(defaultGroupPageContent())
  const section = <K extends GroupPageContent['sections'][number]['kind']>(
    c: GroupPageContent,
    kind: K,
  ) =>
    c.sections.find((s) => s.kind === kind) as Extract<
      GroupPageContent['sections'][number],
      { kind: K }
    >

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `gp-${tag}-${Math.random()}@t.by` })
      .returning()
    return u!.id
  }

  async function event(
    organizationId: number,
    hoursFromNow: number,
    extra: Partial<typeof events.$inferInsert> = {},
  ) {
    const startsAt = new Date(Date.now() + hoursFromNow * 3_600_000)
    const [e] = await db
      .insert(events)
      .values({
        organizationId,
        createdByUserId: ownerId,
        title: `Игра ${hoursFromNow}`,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 3_600_000),
        capacity: 12,
        ...extra,
      })
      .returning()
    return e!
  }

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    assistantId = await newUser('coach')
    playerId = await newUser('player')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Волна' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Другая' })).id
    const add = (userId: number, role: 'organizer' | 'coach' | 'player') =>
      memberService.add({ userId: ownerId }, { organizationId: orgId, userId, role })
    await add(organizerId, 'organizer')
    await add(assistantId, 'coach')
    await add(playerId, 'player')
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('without a row returns the default page and resolved defaults, writes nothing', async () => {
    await db.update(organizations).set({ city: 'Минск' }).where(eq(organizations.id, orgId))
    const page = await get()
    expect(page.isDefault).toBe(true)
    expect(page.updatedAt).toBeNull()
    expect(page.content).toEqual(defaultGroupPageContent())
    expect(page.resolved.metaTitle).toBe('Волна — волейбол, Минск')
    expect(page.resolved.joinText.length).toBeGreaterThan(0)
    expect(page.seoIndex).toBe(false)
    expect(page.group).toMatchObject({
      id: orgId,
      name: 'Волна',
      city: 'Минск',
      logoUpdatedAt: null,
    })
    expect(await db.select().from(organizationGroupPages)).toHaveLength(0)
  })

  it('owner saves the page; order, texts, FAQ and venues round-trip; audit has field names only', async () => {
    const hall = await venueService.create(
      { userId: ownerId },
      {
        organizationId: orgId,
        name: 'Зал 1',
        address: 'ул. Мира, 1',
      },
    )
    const c = content()
    c.sections.reverse()
    section(c, 'about').text = 'Играем по средам'
    section(c, 'prices').enabled = false
    section(c, 'venues').venueIds = [hall.id]
    section(c, 'faq').items = [{ question: 'Мяч нужен?', answer: 'Нет' }]
    c.metaTitle = 'Волна: волейбол в Минске по средам'

    const res = await put(c)
    expect(res.status, res.text).toBe(200)
    const page = (res.body as { page: GroupPageView }).page
    expect(page.isDefault).toBe(false)
    expect(page.content).toEqual(c)
    expect(page.resolved.metaTitle).toBe(c.metaTitle)
    expect(page.venues).toEqual([{ id: hall.id, name: 'Зал 1', address: 'ул. Мира, 1' }])
    expect((await get(organizerId)).content).toEqual(c)

    // повтор того же содержимого — без новой записи в истории
    expect((await put(c)).status).toBe(200)
    const audit = await db
      .select({ action: auditLog.action, newValue: auditLog.newValue })
      .from(auditLog)
      .where(eq(auditLog.organizationId, orgId))
    const pageAudit = audit.filter((a) => a.action === 'organization.group_page_updated')
    expect(pageAudit).toHaveLength(1)
    expect(JSON.stringify(pageAudit[0]!.newValue)).not.toContain('Играем по средам')
  })

  it('meta warnings never block saving', async () => {
    const c = content()
    c.metaTitle = 'Ab'
    c.metaDescription = 'коротко'
    const res = await put(c)
    expect(res.status, res.text).toBe(200)
    expect((res.body as { page: GroupPageView }).page.warnings).toEqual([
      'meta.title_too_short',
      'meta.description_too_short',
      'meta.city_missing',
    ])
  })

  it('limits and shape violations give 422 and keep the stored page', async () => {
    const faq = content()
    section(faq, 'faq').items = Array.from({ length: GROUP_PAGE_LIMITS.faqItems + 1 }, () => ({
      question: 'Q',
      answer: 'A',
    }))
    const longAbout = content()
    section(longAbout, 'about').text = 'a'.repeat(GROUP_PAGE_LIMITS.about + 1)
    const missing = content()
    missing.sections.pop()
    for (const body of [faq, longAbout, missing, { sections: 'nope' }, {}]) {
      const res = await put(body)
      expect(res.status, res.text).toBe(422)
      expect(res.body).toMatchObject({ data: { code: 'validation_failed' } })
    }
    expect(await db.select().from(organizationGroupPages)).toHaveLength(0)
  })

  it('venues must be active venues of this group (no cross-group venue ids)', async () => {
    const foreign = await venueService.create(
      { userId: otherOwnerId },
      {
        organizationId: otherOrgId,
        name: 'Чужой',
      },
    )
    const archived = await venueService.create(
      { userId: ownerId },
      {
        organizationId: orgId,
        name: 'Старый',
      },
    )
    await venueService.archive({ userId: ownerId }, archived.id, orgId)
    for (const id of [foreign.id, archived.id, 999_999]) {
      const c = content()
      section(c, 'venues').venueIds = [id]
      const res = await put(c)
      expect(res.status, res.text).toBe(422)
      expect(res.body).toMatchObject({ data: { code: 'group_page.venue_invalid' } })
    }
    expect((await get()).venues).toEqual([])
  })

  it('schedule lists the next five published or closed events, not drafts, cancelled or past', async () => {
    await event(orgId, -2)
    await event(orgId, 1, { status: 'draft' })
    await event(orgId, 2, { status: 'cancelled' })
    await event(otherOrgId, 3)
    for (const h of [30, 10, 20, 50, 40, 60]) await event(orgId, h)
    await event(orgId, 5, { status: 'closed' })
    const page = await get()
    expect(page.upcomingEvents.map((e) => e.title)).toEqual([
      'Игра 5',
      'Игра 10',
      'Игра 20',
      'Игра 30',
      'Игра 40',
    ])
    expect(page.upcomingEvents[0]).toMatchObject({ status: 'closed', joinMode: 'open' })
  })

  it('only the owner saves; organizer reads; assistant, player and anonymous are denied', async () => {
    const denied = await put(content(), organizerId)
    expect(denied.status).toBe(403)
    expect(denied.body).toMatchObject({ data: { code: 'forbidden.owner_only' } })
    for (const user of [assistantId, playerId]) {
      expect((await request('GET', url(), { user })).status).toBe(403)
      expect((await put(content(), user)).status).toBe(403)
    }
    expect((await request('GET', url())).status).toBe(401)
    expect((await request('PUT', url(), { body: content() })).status).toBe(401)
    expect(await db.select().from(organizationGroupPages)).toHaveLength(0)
  })

  it('IDOR: an owner of another group can neither read nor write this page', async () => {
    expect((await request('GET', url(), { user: otherOwnerId })).status).toBe(403)
    const c = content()
    c.metaTitle = 'Захват'
    expect((await put(c, otherOwnerId)).status).toBe(403)
    // своя группа другого владельца не задевает чужую
    expect((await put(c, otherOwnerId, otherOrgId)).status).toBe(200)
    expect((await get()).isDefault).toBe(true)
    expect((await get(otherOwnerId, otherOrgId)).content.metaTitle).toBe('Захват')
  })

  it('switching indexing off (seoIndex in settings) does not change the booking mode', async () => {
    const invite = await event(orgId, 24, { joinMode: 'invite' })
    const on = await request('PATCH', `/api/organizations/${orgId}/settings`, {
      user: ownerId,
      body: { seoIndex: true },
    })
    expect(on.status, on.text).toBe(200)
    expect((await get()).seoIndex).toBe(true)
    const off = await request('PATCH', `/api/organizations/${orgId}/settings`, {
      user: ownerId,
      body: { seoIndex: false },
    })
    expect(off.status, off.text).toBe(200)
    const page = await get()
    expect(page.seoIndex).toBe(false)
    expect(page.group.defaultJoinMode).toBe('open')
    const [row] = await db.select().from(events).where(eq(events.id, invite.id))
    expect(row!.joinMode).toBe('invite')
    expect(row!.status).toBe('published')
  })
})
