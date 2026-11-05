import { eventService, memberService, organizationService } from '@volley-time/core'
import { bookings, closeDb, db, events, ledgerEntries, organizations, users } from '@volley-time/db'
import {
  resolveReportPeriod,
  type ManagerReport,
  type ReportExportPreview,
} from '@volley-time/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

/** Отчёты кабинета (21.2.7): только управляющий своей группы, цифры сходятся с кассой. */
describe('cabinet reports (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let owner: number
  let player: number
  let outsider: number
  let foreignOwner: number
  let orgId: number
  let foreignOrgId: number
  const period = `from=${day(-1)}&to=${day(10)}`
  const base = (org = orgId) => `/api/organizations/${org}`

  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([
        { name: 'Owner' },
        { name: 'Player' },
        { name: 'Outsider' },
        { name: 'Foreign owner' },
        { name: 'Foreign player' },
      ])
      .returning()
    owner = people[0]!.id
    player = people[1]!.id
    outsider = people[2]!.id
    foreignOwner = people[3]!.id
    const foreignPlayer = people[4]!.id
    orgId = (await organizationService.create({ userId: owner }, { name: 'Reports' })).id
    await memberService.add({ userId: owner }, { organizationId: orgId, userId: player })
    foreignOrgId = (
      await organizationService.create({ userId: foreignOwner }, { name: 'Reports foreign' })
    ).id
    await memberService.add(
      { userId: foreignOwner },
      { organizationId: foreignOrgId, userId: foreignPlayer },
    )
    const mk = (title: string, price: number) => ({
      title,
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 93_600_000),
      capacity: 4,
      price,
    })
    const eventId = (await eventService.create({ userId: owner }, orgId, mk('Основа', 1500))).id
    const foreignEventId = (
      await eventService.create({ userId: foreignOwner }, foreignOrgId, mk('Чужое', 900))
    ).id
    await db.insert(bookings).values([
      {
        eventId,
        userId: player,
        organizationId: orgId,
        status: 'attended',
        method: 'cash',
        seats: 2,
      },
      {
        eventId: foreignEventId,
        userId: foreignPlayer,
        organizationId: foreignOrgId,
        status: 'attended',
        method: 'cash',
      },
    ])
    // события периода: включаем в диапазон и сегодняшние вчерашние строки журнала
    await db.update(events).set({ status: 'published' })
    for (const [org, user, amount] of [
      [orgId, owner, 5000],
      [foreignOrgId, foreignOwner, 77_000],
    ] as const)
      await db.insert(ledgerEntries).values({
        organizationId: org,
        type: 'income',
        category: 'donation',
        amount,
        currency: 'BYN',
        createdByUserId: user,
      })
    await request('POST', `${base()}/ledger/expense`, {
      user: owner,
      body: { category: 'coach', amount: 1200, description: 'Тренер' },
    })
    await request('POST', `${base()}/ledger/expense`, {
      user: owner,
      body: { category: 'salary', amount: 300, description: 'Старая зарплата' },
    })
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('gives the manager the money, occupancy and attendance of their group', async () => {
    const res = await request('GET', `${base()}/reports?${period}`, { user: owner })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const report = res.body as ManagerReport
    expect(report.timezone).toBe('Europe/Minsk')
    expect(report.money).toMatchObject({ income: 5000, expense: 1500, net: 3500 })
    expect(report.money.expenseByCategory).toEqual([
      { category: 'coach', amount: 1200, count: 1 },
      { category: 'salary', amount: 300, count: 1 },
    ])
    expect(report.occupancy).toMatchObject({ events: 1, seats: 2, capacity: 4, percent: 50 })
    expect(report.attendance).toMatchObject({ visits: 1, noShows: 0, cancellations: 0 })
    expect(report.attendance.top.map((p) => p.userId)).toEqual([player])
  })

  it('reconciles the money with the cash desk endpoint for the same period', async () => {
    const report = (await request('GET', `${base()}/reports?${period}`, { user: owner }))
      .body as ManagerReport
    const range = resolveReportPeriod(day(-1), day(10), report.timezone)!
    const ledger = (
      await request(
        'GET',
        `${base()}/ledger?from=${range.from.toISOString()}&to=${range.to.toISOString()}`,
        { user: owner },
      )
    ).body as { period: { income: number; expense: number } }
    expect(report.money.income).toBe(ledger.period.income)
    expect(report.money.expense).toBe(ledger.period.expense)
  })

  it('refuses players, outsiders, anonymous callers and another group', async () => {
    for (const path of [`reports?${period}`, `reports/export?type=finance&${period}`]) {
      for (const user of [player, outsider])
        expect((await request('GET', `${base()}/${path}`, { user })).status).toBe(403)
      expect((await request('GET', `${base()}/${path}`)).status).toBe(401)
      // управляющий одной группы не читает отчёты другой
      expect((await request('GET', `${base(foreignOrgId)}/${path}`, { user: owner })).status).toBe(
        403,
      )
    }
  })

  it('does not mix another group data into the report or the export', async () => {
    const foreign = (
      await request('GET', `${base(foreignOrgId)}/reports?${period}`, { user: foreignOwner })
    ).body as ManagerReport
    expect(foreign.money).toMatchObject({ income: 77_000, expense: 0 })
    expect(foreign.attendance.top.map((p) => p.userId)).not.toContain(player)
    const csv = await request(
      'GET',
      `${base(foreignOrgId)}/reports/export?type=finance&${period}`,
      {
        user: foreignOwner,
      },
    )
    expect(csv.text).not.toContain('Тренер')
    expect(csv.text).toContain('770,00')
  })

  it('rejects an invalid period with 422', async () => {
    for (const q of [
      '',
      'from=2026-05-31&to=2026-05-01',
      'from=2026-01-01&to=2027-06-01',
      'from=abc&to=2026-05-01',
    ])
      expect((await request('GET', `${base()}/reports?${q}`, { user: owner })).status).toBe(422)
  })

  it('serves the finance and attendance CSV and a JSON preview', async () => {
    const finance = await request('GET', `${base()}/reports/export?type=finance&${period}`, {
      user: owner,
    })
    expect(finance.status).toBe(200)
    expect(finance.headers.get('content-type')).toContain('text/csv')
    expect(finance.headers.get('content-disposition')).toMatch(
      /attachment; filename="report-finance-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv"/,
    )
    const lines = finance.text.replace('\uFEFF', '').trimEnd().split('\r\n')
    expect(lines[0]).toBe('Дата;Тип;Категория;Описание;Событие;Способ;Сумма;Валюта;Плательщик')
    expect(lines).toHaveLength(4)

    const attendance = await request(
      'GET',
      `${base()}/reports/export?type=attendance&columns=player,visits&${period}`,
      { user: owner },
    )
    expect(attendance.text.replace('\uFEFF', '').trimEnd().split('\r\n')).toEqual([
      'Игрок;Тренировок',
      'Player;1',
    ])

    const preview = (
      await request('GET', `${base()}/reports/export?type=finance&preview=1&${period}`, {
        user: owner,
      })
    ).body as ReportExportPreview
    expect(preview).toMatchObject({ type: 'finance', total: 3 })
    expect(preview.rows).toHaveLength(3)
    // размер файла включает BOM (3 байта), который декодер текста ответа отбрасывает
    expect(preview.bytes).toBe(Buffer.byteLength(finance.text.replace('\uFEFF', ''), 'utf8') + 3)
  })

  it('rejects an unknown export type or column with 422', async () => {
    for (const q of ['type=subs', 'type=finance&columns=player', 'type=attendance&columns=amount'])
      expect(
        (await request('GET', `${base()}/reports/export?${q}&${period}`, { user: owner })).status,
      ).toBe(422)
  })
})
