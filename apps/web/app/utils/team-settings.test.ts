import { describe, expect, it } from 'vitest'

import {
  TEAM_MATRIX,
  TEAM_MATRIX_ROLES,
  formatHistoryWhen,
  historyLine,
  leadsLines,
  eligibleCoachIds,
  planSeriesAssignment,
  seriesOptions,
  upcomingSeriesEvents,
  teamMenuItems,
  teamRows,
  type TeamMember,
} from './team-settings'

const TZ = 'Europe/Minsk'

function member(over: Partial<TeamMember> & { id: number; userId: number }): TeamMember {
  const { userId, ...rest } = over
  return {
    role: 'player',
    roles: ['player'],
    canAcceptPayment: false,
    status: 'active',
    user: { id: userId, name: `User ${userId}`, image: null },
    ...rest,
  }
}

describe('teamRows', () => {
  it('keeps active owner, organizer and coach only, in the given order', () => {
    const rows = teamRows([
      member({ id: 1, userId: 11, role: 'owner', roles: ['owner', 'player'] }),
      member({ id: 2, userId: 12, role: 'organizer', roles: ['organizer', 'player'] }),
      member({
        id: 3,
        userId: 13,
        role: 'coach',
        roles: ['coach', 'player'],
        canAcceptPayment: true,
      }),
      member({ id: 4, userId: 14, role: 'player' }),
      member({ id: 5, userId: 15, role: 'coach', roles: ['coach', 'player'], status: 'blocked' }),
    ])
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3])
    expect(rows[2]).toMatchObject({ role: 'coach', canAcceptPayment: true, name: 'User 13' })
    expect(rows[0]!.roles).toEqual(['owner', 'player'])
  })

  it('shows the payment flag only for coaches', () => {
    const [row] = teamRows([
      member({
        id: 2,
        userId: 12,
        role: 'organizer',
        roles: ['organizer', 'player'],
        canAcceptPayment: true,
      }),
    ])
    expect(row!.canAcceptPayment).toBe(false)
  })

  it('falls back to a neutral name', () => {
    const [row] = teamRows([
      member({
        id: 2,
        userId: 12,
        role: 'coach',
        roles: ['coach', 'player'],
        user: { id: 12, name: null, image: null },
      }),
    ])
    expect(row!.name).toBe('Без имени')
  })
})

describe('leadsLines', () => {
  const lead = (id: number, title: string, startsAt: string, seriesId: number | null) => ({
    id,
    title,
    startsAt,
    seriesId,
  })

  it('says "все события" for the owner and a dash when nothing is led', () => {
    expect(leadsLines('owner', [], TZ)).toEqual(['все события'])
    expect(leadsLines('organizer', [], TZ)).toEqual(['—'])
    expect(leadsLines('coach', [], TZ)).toEqual(['—'])
  })

  it('groups series events by series with weekdays in the group time zone', () => {
    // 2026-12-02 ср, 2026-12-04 пт, 2026-12-09 ср (полдень по Минску)
    expect(
      leadsLines(
        'coach',
        [
          lead(1, 'Основа', '2026-12-02T09:00:00.000Z', 5),
          lead(2, 'Основа', '2026-12-04T09:00:00.000Z', 5),
          lead(3, 'Основа', '2026-12-09T09:00:00.000Z', 5),
        ],
        TZ,
      ),
    ).toEqual(['Основа · Ср, Пт'])
  })

  it('uses the group time zone for the weekday near midnight', () => {
    // 2026-12-02 22:00 UTC — это уже четверг 03.12 в Минске
    expect(leadsLines('coach', [lead(1, 'Поздняя', '2026-12-02T22:00:00.000Z', 7)], TZ)).toEqual([
      'Поздняя · Чт',
    ])
  })

  it('lists single events with their date and keeps different series apart', () => {
    expect(
      leadsLines(
        'coach',
        [
          lead(1, 'Микст', '2026-12-06T09:00:00.000Z', 6),
          lead(2, 'Турнир', '2026-12-12T09:00:00.000Z', null),
        ],
        TZ,
      ),
    ).toEqual(['Микст · Вс', 'Турнир · 12 декабря'])
  })
})

describe('teamMenuItems', () => {
  it('offers only the ownership transfer for the owner row', () => {
    expect(teamMenuItems('owner').map((i) => i.key)).toEqual(['transfer'])
  })

  it('switches between coach and organizer and always offers series and removal', () => {
    expect(teamMenuItems('coach').map((i) => i.key)).toEqual([
      'makeOrganizer',
      'assignSeries',
      'remove',
    ])
    expect(teamMenuItems('organizer').map((i) => i.key)).toEqual([
      'makeCoach',
      'assignSeries',
      'remove',
    ])
    const remove = teamMenuItems('coach').find((i) => i.key === 'remove')!
    expect(remove).toMatchObject({ tone: 'danger', separator: true, label: 'Убрать из команды' })
  })
})

describe('TEAM_MATRIX', () => {
  it('has the three role columns and the organizer sees the balance read-only', () => {
    expect(TEAM_MATRIX_ROLES).toEqual(['Владелец', 'Организатор', 'Тренер'])
    for (const row of TEAM_MATRIX) expect(row.cells).toHaveLength(3)
    const balance = TEAM_MATRIX.find((r) => r.title.startsWith('Баланс событий'))!
    expect(balance.cells).toEqual(['yes', 'view', 'no'])
    const payments = TEAM_MATRIX.find((r) => r.title.startsWith('Приём'))!
    expect(payments.cells).toEqual(['yes', 'yes', 'conditional'])
    const settings = TEAM_MATRIX.find((r) => r.title.startsWith('Настройки'))!
    expect(settings.cells).toEqual(['yes', 'no', 'no'])
  })
})

describe('historyLine', () => {
  const names = {
    byMemberId: new Map([
      [3, 'Ольга Романова'],
      [4, 'Дмитрий Ковалёв'],
    ]),
    byUserId: new Map([[1, 'Иван Петренко']]),
  }
  const entry = (over: Record<string, unknown>) => ({
    id: 1,
    userId: 1 as number | null,
    entityId: 3,
    createdAt: '2026-11-24T09:10:00.000Z',
    oldValue: { role: 'coach', canAcceptPayment: false } as unknown,
    newValue: { role: 'coach', canAcceptPayment: true } as unknown,
    ...over,
  })

  it('describes the payment flag change with the author', () => {
    expect(historyLine(entry({}), names)).toBe(
      'Иван Петренко: Ольга Романова — приём оплаты разрешён',
    )
    expect(
      historyLine(
        entry({
          oldValue: { role: 'coach', canAcceptPayment: true },
          newValue: { role: 'coach', canAcceptPayment: false },
        }),
        names,
      ),
    ).toBe('Иван Петренко: Ольга Романова — приём оплаты отключён')
  })

  it('describes role changes, removal from the team and the missing author', () => {
    expect(
      historyLine(
        entry({
          entityId: 4,
          oldValue: { role: 'player' },
          newValue: { role: 'coach', canAcceptPayment: false },
        }),
        names,
      ),
    ).toBe('Иван Петренко: Дмитрий Ковалёв — роль «Тренер» (была «Игрок»)')
    expect(
      historyLine(
        entry({
          oldValue: { role: 'coach', canAcceptPayment: false },
          newValue: { role: 'player', canAcceptPayment: false },
        }),
        names,
      ),
    ).toBe('Иван Петренко: Ольга Романова — убран из команды, остаётся игроком')
    expect(
      historyLine(
        entry({ userId: null, oldValue: { role: 'organizer' }, newValue: { role: 'owner' } }),
        names,
      ),
    ).toBe('Ольга Романова — роль «Владелец» (была «Организатор»)')
  })

  it('uses a neutral name for unknown people', () => {
    expect(historyLine(entry({ userId: 99, entityId: 99 }), names)).toBe(
      'Участник: Участник — приём оплаты разрешён',
    )
  })
})

describe('formatHistoryWhen', () => {
  const now = new Date('2026-11-24T12:00:00.000Z')
  it('writes "Сегодня" for the same day in the group time zone and a date otherwise', () => {
    expect(formatHistoryWhen('2026-11-24T09:10:00.000Z', now, TZ)).toBe('Сегодня 12:10')
    expect(formatHistoryWhen('2026-05-24T15:02:00.000Z', now, TZ)).toBe('24 мая 18:02')
  })
})

describe('seriesOptions', () => {
  const ev = (over: Record<string, unknown>) => ({
    id: 1,
    title: 'Основа',
    startsAt: '2026-12-02T09:00:00.000Z',
    status: 'published',
    seriesId: 5 as number | null,
    seriesDate: '2026-12-02' as string | null,
    ...over,
  })

  it('collects upcoming series with weekdays and the first upcoming date', () => {
    expect(
      seriesOptions(
        [
          ev({ id: 1 }),
          ev({ id: 2, startsAt: '2026-12-04T09:00:00.000Z', seriesDate: '2026-12-04' }),
          ev({
            id: 3,
            title: 'Микст',
            seriesId: 6,
            startsAt: '2026-12-06T09:00:00.000Z',
            seriesDate: '2026-12-06',
          }),
          ev({ id: 4, title: 'Разовая', seriesId: null, seriesDate: null }),
          ev({
            id: 5,
            title: 'Отменена',
            seriesId: 8,
            status: 'cancelled',
            seriesDate: '2026-12-03',
          }),
        ],
        TZ,
      ),
    ).toEqual([
      { seriesId: 5, title: 'Основа', label: 'Основа · Ср, Пт', from: '2026-12-02' },
      { seriesId: 6, title: 'Микст', label: 'Микст · Вс', from: '2026-12-06' },
    ])
  })
})

describe('eligibleCoachIds', () => {
  it('takes active members with a coach-or-higher role only', () => {
    const m = (id: number, role: string, status = 'active') => ({ role, status, user: { id } })
    expect(
      eligibleCoachIds([
        m(1, 'owner'),
        m(2, 'organizer'),
        m(3, 'coach'),
        m(4, 'assistant'),
        m(5, 'player'),
        m(6, 'coach', 'left'),
        m(7, 'organizer', 'blocked'),
      ]),
    ).toEqual(new Set([1, 2, 3, 4]))
  })
})

describe('upcomingSeriesEvents', () => {
  const now = new Date('2026-12-05T12:00:00Z')
  const ev = (
    id: number,
    seriesDate: string,
    startsAt: string,
    status = 'published',
    seriesId = 5,
  ) => ({
    id,
    title: 'Основа',
    startsAt,
    status,
    seriesId,
    seriesDate,
  })

  it('keeps only dates that have not started yet, of this series, from the given date', () => {
    const rows = [
      ev(1, '2026-12-02', '2026-12-02T16:00:00Z'),
      ev(2, '2026-12-05', '2026-12-05T10:00:00Z'),
      ev(3, '2026-12-09', '2026-12-09T16:00:00Z'),
      ev(4, '2026-12-16', '2026-12-16T16:00:00Z', 'cancelled'),
      ev(5, '2026-12-23', '2026-12-23T16:00:00Z', 'finished'),
      ev(6, '2026-12-30', '2026-12-30T16:00:00Z', 'published', 6),
      ev(7, '2027-01-06', '2027-01-06T16:00:00Z'),
    ]
    expect(upcomingSeriesEvents(rows, 5, '2026-12-02', now).map((e) => e.id)).toEqual([3, 7])
    expect(upcomingSeriesEvents(rows, 5, '2027-01-01', now).map((e) => e.id)).toEqual([7])
  })
})

describe('planSeriesAssignment', () => {
  const all = new Set([1, 7, 9, 500])

  it('adds the coach to the template and keeps the own coaches of every date', () => {
    const plan = planSeriesAssignment(
      [1],
      [
        { seriesDate: '2026-12-02', coachUserIds: [1] },
        { seriesDate: '2026-12-09', coachUserIds: [1, 7] },
        { seriesDate: '2026-12-16', coachUserIds: [] },
      ],
      9,
      all,
    )
    expect(plan.template).toEqual([1, 9])
    expect(plan.dates).toEqual([
      { date: '2026-12-02', coachUserIds: [1, 9] },
      { date: '2026-12-09', coachUserIds: [1, 7, 9] },
      { date: '2026-12-16', coachUserIds: [9] },
    ])
  })

  it('drops coaches that are no longer eligible, in the template and in every date, and keeps the rest', () => {
    const plan = planSeriesAssignment(
      [1, 404],
      [
        { seriesDate: '2026-12-02', coachUserIds: [404, 7] },
        { seriesDate: '2026-12-09', coachUserIds: [404] },
        { seriesDate: '2026-12-16', coachUserIds: [1, 7] },
      ],
      9,
      all,
    )
    expect(plan.template).toEqual([1, 9])
    expect(plan.dates).toEqual([
      { date: '2026-12-02', coachUserIds: [7, 9] },
      { date: '2026-12-09', coachUserIds: [9] },
      { date: '2026-12-16', coachUserIds: [1, 7, 9] },
    ])
  })

  it('cleans a stale coach out of a list that already has the target coach', () => {
    const plan = planSeriesAssignment(
      [9, 404],
      [{ seriesDate: '2026-12-02', coachUserIds: [9, 404] }],
      9,
      all,
    )
    expect(plan.template).toEqual([9])
    expect(plan.dates).toEqual([{ date: '2026-12-02', coachUserIds: [9] }])
  })

  it('skips dates that already have the coach and nothing stale', () => {
    const plan = planSeriesAssignment(
      [1, 500],
      [{ seriesDate: '2026-12-02', coachUserIds: [9] }, { seriesDate: '2026-12-09' }],
      9,
      all,
    )
    expect(plan.template).toEqual([1, 500, 9])
    expect(plan.dates).toEqual([{ date: '2026-12-09', coachUserIds: [9] }])
  })

  it('plans nothing when the coach is everywhere already', () => {
    expect(
      planSeriesAssignment([9], [{ seriesDate: '2026-12-02', coachUserIds: [9] }], 9, all),
    ).toEqual({ template: null, dates: [] })
  })
})
