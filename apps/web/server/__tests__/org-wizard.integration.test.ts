import { closeDb, db, eq, events, eventSeries, organizations, users } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { buildWizardSeries, wizardStartDate } from '../../app/utils/org-wizard'

import { createTestApi } from './harness'

/** Task 21.1.7: мастер «Своя группа» по HTTP — группа на переходе 1→2, серия на 2→3, без расписания. */
describe('group creation wizard API flow (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let userId: number
  const previousFlag = process.env.EVENT_BALANCE_ENFORCED

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `wiz-${Math.random()}@t.by`, name: 'Wizard Owner' })
      .returning()
    userId = u!.id
  })

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  async function createGroup() {
    const res = await request('POST', '/api/organizations', {
      user: userId,
      body: { name: 'Волейбол по средам', city: 'Минск' },
    })
    expect(res.status, res.text).toBe(200)
    return (res.body as { organization: { id: number; defaultTimezone: string } }).organization
  }

  async function balanceOf(orgId: number) {
    const res = await request('GET', `/api/organizations/${orgId}/event-balance`, { user: userId })
    return (res.body as { eventBalance: { balance: number } }).eventBalance.balance
  }

  it('with a schedule: preview on the new group equals the created series result', async () => {
    const org = await createGroup()
    expect(await balanceOf(org.id)).toBe(5)

    // все дни недели, чтобы дат было больше баланса: часть публикуется, остальные — черновики
    const body = buildWizardSeries({
      name: 'Волейбол по средам',
      days: [1, 2, 3, 4, 5, 6, 7],
      time: '20:00',
      seats: '14',
      startDate: wizardStartDate(new Date(), org.defaultTimezone),
    })
    const preview = await request('POST', `/api/organizations/${org.id}/series/preview`, {
      user: userId,
      body,
    })
    expect(preview.status, preview.text).toBe(200)
    const p = preview.body as {
      total: number
      published: number
      drafts: number
      balanceAfter: number
    }
    expect(p.published).toBe(5)
    expect(p.drafts).toBe(p.total - 5)
    expect(p.balanceAfter).toBe(0)

    const created = await request('POST', `/api/organizations/${org.id}/series`, {
      user: userId,
      body: { ...body, idempotencyKey: 'wizard-int-key-0001' },
    })
    expect(created.status, created.text).toBe(200)
    expect(created.body).toMatchObject({
      total: p.total,
      published: p.published,
      drafts: p.drafts,
      balanceAfter: p.balanceAfter,
      replayed: false,
    })
    // повтор с тем же ключом не списывает баланс второй раз
    const retry = await request('POST', `/api/organizations/${org.id}/series`, {
      user: userId,
      body: { ...body, idempotencyKey: 'wizard-int-key-0001' },
    })
    expect(retry.body).toMatchObject({ replayed: true, balanceAfter: 0 })
    expect(await balanceOf(org.id)).toBe(0)

    const invite = await request('POST', `/api/organizations/${org.id}/invites`, {
      user: userId,
      body: { roleToAssign: 'player' },
    })
    expect(invite.status, invite.text).toBe(200)
    expect((invite.body as { deeplinkUrl: string }).deeplinkUrl).toContain('http')
  })

  it('one key per wizard run: retry replays, an edited schedule gets 409, one series and one charge', async () => {
    const org = await createGroup()
    const startDate = wizardStartDate(new Date(), org.defaultTimezone)
    const make = (days: number[]) =>
      buildWizardSeries({ name: 'Волейбол по средам', days, time: '20:00', seats: '14', startDate })
    const key = 'wizard-run-key-0002'
    const post = (body: ReturnType<typeof make>) =>
      request('POST', `/api/organizations/${org.id}/series`, {
        user: userId,
        body: { ...body, idempotencyKey: key },
      })

    // одна дата в неделю: событий меньше баланса, остаток остаётся выше нуля
    const first = await post(make([3]))
    expect(first.status, first.text).toBe(200)
    const created = first.body as { published: number; balanceAfter: number }
    expect(created.balanceAfter).toBeGreaterThan(0)
    expect(await balanceOf(org.id)).toBe(created.balanceAfter)

    const replay = await post(make([3]))
    expect(replay.body).toMatchObject({ replayed: true })
    expect(await balanceOf(org.id)).toBe(created.balanceAfter)

    const edited = await post(make([3, 5]))
    expect(edited.status).toBe(409)
    expect((edited.body as { data?: { code?: string } }).data?.code).toBe(
      'series.idempotency_conflict',
    )
    expect(await balanceOf(org.id)).toBe(created.balanceAfter)
    expect(
      await db.select().from(eventSeries).where(eq(eventSeries.organizationId, org.id)),
    ).toHaveLength(1)
  })

  it('without a schedule: the group has the demo balance and no events or series', async () => {
    const org = await createGroup()
    expect(await balanceOf(org.id)).toBe(5)
    expect(
      await db.select().from(eventSeries).where(eq(eventSeries.organizationId, org.id)),
    ).toHaveLength(0)
    expect(await db.select().from(events).where(eq(events.organizationId, org.id))).toHaveLength(0)
  })
})
