import { memberService, organizationService } from '@volley-time/core'
import {
  and,
  auditLog,
  closeDb,
  db,
  eq,
  organizationNotificationSettings,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Row = { type: string; enabled: boolean; mandatory: boolean }

/** Task 21.2.14: переключатели уведомлений группы (HTTP, права, IDOR, обязательные типы). */
describe('group notification settings API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let assistantId: number
  let playerId: number
  let outsiderId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  const url = (id = orgId) => `/api/organizations/${id}/notification-settings`
  const get = async (user = ownerId, id = orgId) => {
    const res = await request('GET', url(id), { user })
    expect(res.status, res.text).toBe(200)
    return (res.body as { notifications: Row[] }).notifications
  }
  const patch = (body: Record<string, unknown>, user = ownerId, id = orgId) =>
    request('PATCH', url(id), { user, body })

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `ns-${tag}-${Math.random()}@t.by` })
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
    assistantId = await newUser('assistant')
    playerId = await newUser('player')
    outsiderId = await newUser('outsider')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Notif HTTP' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
    const add = (userId: number, role: 'organizer' | 'assistant' | 'player') =>
      memberService.add({ userId: ownerId }, { organizationId: orgId, userId, role })
    await add(organizerId, 'organizer')
    await add(assistantId, 'assistant')
    await add(playerId, 'player')
    await memberService.add(
      { userId: otherOwnerId },
      { organizationId: otherOrgId, userId: outsiderId },
    )
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('defaults: reminders on and switchable, waitlist offer and payment confirmation mandatory', async () => {
    const rows = await get()
    expect(rows).toEqual([
      { type: 'reminder_24h', enabled: true, mandatory: false },
      { type: 'reminder_2h', enabled: true, mandatory: false },
      { type: 'waitlist_offer', enabled: true, mandatory: true },
      { type: 'payment_confirmed', enabled: true, mandatory: true },
    ])
    expect(await db.select().from(organizationNotificationSettings)).toHaveLength(0)
  })

  it('owner and organizer switch a reminder off and on, with an audit trail', async () => {
    const off = await patch({ reminder_24h: false }, organizerId)
    expect(off.status, off.text).toBe(200)
    expect((off.body as { notifications: Row[] }).notifications[0]).toMatchObject({
      type: 'reminder_24h',
      enabled: false,
    })
    expect((await get(organizerId)).find((r) => r.type === 'reminder_2h')?.enabled).toBe(true)

    expect((await patch({ reminder_24h: true })).status).toBe(200)
    expect((await get())[0]!.enabled).toBe(true)

    // повтор того же значения не пишет в историю
    await patch({ reminder_24h: true })
    const audit = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.organizationId, orgId))
    expect(audit.filter((a) => a.action === 'organization.notifications_updated')).toHaveLength(2)
  })

  it('mandatory types cannot be switched off or touched through the API', async () => {
    for (const type of [
      'waitlist_offer',
      'payment_confirmed',
      'payment_rejected',
      'event_cancelled',
    ]) {
      for (const enabled of [false, true]) {
        const res = await patch({ [type]: enabled })
        expect(res.status, res.text).toBe(422)
        expect(res.body).toMatchObject({ data: { code: 'notification_settings.mandatory' } })
      }
    }
    // обязательный и допустимый ключ вместе: ничего не применяется
    expect((await patch({ reminder_2h: false, waitlist_offer: false })).status).toBe(422)
    expect((await get()).every((r) => r.enabled)).toBe(true)
    expect(await db.select().from(organizationNotificationSettings)).toHaveLength(0)
  })

  it('rejects unknown keys, non-boolean values and an empty body', async () => {
    expect((await patch({ weekly_report: false })).status).toBe(422)
    expect((await patch({ reminder_24h: 'no' })).status).toBe(422)
    const empty = await patch({})
    expect(empty.status).toBe(422)
    expect(empty.body).toMatchObject({ data: { code: 'notification_settings.empty' } })
  })

  it('assistant, player and anonymous cannot read or change the switches', async () => {
    for (const user of [assistantId, playerId]) {
      for (const res of await Promise.all([
        request('GET', url(), { user }),
        request('PATCH', url(), { user, body: { reminder_24h: false } }),
      ])) {
        expect(res.status, res.text).toBe(403)
        expect(res.body).toMatchObject({ data: { code: 'forbidden.manage_content' } })
      }
    }
    expect((await request('GET', url())).status).toBe(401)
    expect((await request('PATCH', url(), { body: { reminder_24h: false } })).status).toBe(401)
    expect((await get()).every((r) => r.enabled)).toBe(true)
  })

  it('IDOR: a foreign group changes nothing, and each group keeps its own switches', async () => {
    for (const user of [outsiderId, otherOwnerId]) {
      for (const res of await Promise.all([
        request('GET', url(), { user }),
        request('PATCH', url(), { user, body: { reminder_24h: false } }),
      ])) {
        expect(res.status, res.text).toBe(403)
      }
    }
    expect((await get()).every((r) => r.enabled)).toBe(true)

    // свой владелец меняет только свою группу
    expect((await patch({ reminder_2h: false }, otherOwnerId, otherOrgId)).status).toBe(200)
    expect(
      (await get(otherOwnerId, otherOrgId)).find((r) => r.type === 'reminder_2h')?.enabled,
    ).toBe(false)
    expect((await get()).find((r) => r.type === 'reminder_2h')?.enabled).toBe(true)
    const rows = await db
      .select()
      .from(organizationNotificationSettings)
      .where(and(eq(organizationNotificationSettings.organizationId, orgId)))
    expect(rows).toHaveLength(0)
  })
})
