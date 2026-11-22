import { closeDb, db, eq, organizationGroupPages, organizations, users } from '@volley-time/db'
import { defaultGroupPageContent } from '@volley-time/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import { groupPageService } from './service'

/** Task 24.1.1 (W-13, D-24): сервис страницы группы на реальном PostgreSQL. */
describe('group page service (24.1.1, PostgreSQL)', () => {
  let ownerId: number
  let orgId: number
  const ctx = () => ({ userId: ownerId })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `gps-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create(ctx(), { name: 'Сервис' })).id
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('first save creates the row with the author, the next save updates it in place', async () => {
    const c = defaultGroupPageContent()
    const first = await groupPageService.update(ctx(), orgId, { ...c, metaTitle: 'Первый' })
    expect(first.isDefault).toBe(false)
    const second = await groupPageService.update(ctx(), orgId, { ...c, metaTitle: 'Второй' })
    expect(second.content.metaTitle).toBe('Второй')
    const rows = await db.select().from(organizationGroupPages)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ organizationId: orgId, updatedByUserId: ownerId })
  })

  it('an archived group cannot save its page', async () => {
    await db.update(organizations).set({ status: 'archived' }).where(eq(organizations.id, orgId))
    await expect(
      groupPageService.update(ctx(), orgId, defaultGroupPageContent()),
    ).rejects.toMatchObject({ code: 'organization.archived' })
  })

  it('a missing group is not found', async () => {
    await expect(groupPageService.get(ctx(), 999_999)).rejects.toMatchObject({
      code: 'organization.not_found',
    })
  })

  it('join text falls back to the group join mode, an own text wins', async () => {
    const page = await groupPageService.get(ctx(), orgId)
    const own = defaultGroupPageContent()
    const join = own.sections.find((s) => s.kind === 'join') as { text: string | null }
    join.text = 'Пишите в чат группы'
    const saved = await groupPageService.update(ctx(), orgId, own)
    expect(saved.resolved.joinText).toBe('Пишите в чат группы')
    expect(page.resolved.joinText).not.toBe('Пишите в чат группы')
  })
})
