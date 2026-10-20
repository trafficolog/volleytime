import { describe, expect, it } from 'vitest'

import {
  groupNotificationsByDay,
  notificationView,
  type FeedNotification,
} from './notification-feed'

const base = 'Europe/Minsk'
const item = (
  over: Partial<FeedNotification> & Pick<FeedNotification, 'type'>,
  params: Record<string, unknown> = {},
): FeedNotification => ({
  id: 1,
  organizationId: 7,
  eventId: 11,
  readAt: null,
  createdAt: '2026-10-19T12:00:00Z',
  payload: { template: over.type, params },
  ...over,
})

describe('notificationView', () => {
  it('reminder_2h: заголовок с названием, текст с датой, ссылка на событие', () => {
    const v = notificationView(
      item({ type: 'reminder_2h' }, { eventTitle: 'Основа', eventDate: '19 октября, 20:00' }),
      '/m/orgs/7',
    )
    expect(v.title).toBe('Через 2 часа · Основа')
    expect(v.body).toBe('19 октября, 20:00')
    expect(v.to).toBe('/m/orgs/7/events/11')
    expect(v.icon).toBe('clock')
  })

  it('waitlist_offer: предложение места, срок 30 минут', () => {
    const v = notificationView(
      item({ type: 'waitlist_offer' }, { eventTitle: 'Микст' }),
      '/m/orgs/7',
    )
    expect(v.title).toBe('Освободилось место')
    expect(v.body).toContain('Микст')
    expect(v.body).toContain('30 мин')
  })

  it('payment_confirmed по абонементу ведёт на абонементы', () => {
    const v = notificationView(
      item(
        { type: 'payment_confirmed', eventId: null },
        { planName: '8 сессий', amount: 11000, currency: 'BYN', target: 'subscriptions' },
      ),
      '/m/orgs/7',
    )
    expect(v.title).toBe('Оплата подтверждена')
    expect(v.body).toContain('8 сессий')
    expect(v.to).toBe('/m/orgs/7/subscriptions')
  })

  it('заявка на оплату организатору ведёт на оплаты', () => {
    const v = notificationView(
      item({ type: 'organizer_action_required' }, { playerName: 'Иван', target: 'payments' }),
      '/m/orgs/7',
    )
    expect(v.to).toBe('/m/orgs/7/payments')
  })

  it('запрос приглашения организатору (20.4.7) — не «заявка на оплату», ведёт на событие', () => {
    const v = notificationView(
      item(
        { type: 'organizer_action_required', eventId: 5 },
        { playerName: 'Соня', eventTitle: 'Основа', inviteRequest: true },
      ),
      '/m/orgs/7',
    )
    expect(v.title).toBe('Запрос приглашения')
    expect(v.body).toBe('Соня · Основа')
    expect(v.to).toBe('/m/orgs/7/events/5')
  })

  it('без названия события — безопасный текст, без undefined', () => {
    const v = notificationView(item({ type: 'booking_opened' }), '/m/orgs/7')
    expect(v.body).not.toContain('undefined')
    expect(v.body).toBe('событие')
  })

  it('мусорная нагрузка не ломает отображение', () => {
    const v = notificationView(
      {
        ...item({ type: 'event_cancelled' }),
        payload: 'oops' as unknown as FeedNotification['payload'],
      },
      '/m/orgs/7',
    )
    expect(v.title).toBe('Событие отменено')
  })

  it('типы без источников (lineup_ready, mvp_vote) получают нейтральный вид', () => {
    expect(notificationView(item({ type: 'lineup_ready' }), '/m/orgs/7').title).toBe(
      'Составы готовы',
    )
    expect(notificationView(item({ type: 'mvp_vote' }), '/m/orgs/7').title).toBe(
      'Голосование за MVP',
    )
  })
})

describe('groupNotificationsByDay', () => {
  const now = new Date('2026-10-19T12:00:00Z')
  const at = (id: number, iso: string) => item({ type: 'booking_opened', id, createdAt: iso })

  it('Сегодня / Вчера / Ранее по дню часового пояса группы, порядок сохраняется', () => {
    const groups = groupNotificationsByDay(
      [
        at(5, '2026-10-19T08:00:00Z'),
        at(4, '2026-10-18T20:59:00Z'),
        at(3, '2026-10-18T10:00:00Z'),
        at(2, '2026-10-10T10:00:00Z'),
      ],
      base,
      now,
    )
    expect(groups.map((g) => g.day)).toEqual(['Сегодня', 'Вчера', 'Ранее'])
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([[5], [4, 3], [2]])
  })

  it('граница суток считается в часовом поясе группы, а не UTC', () => {
    // 21:30Z 18 октября = 00:30 19 октября в Минске → «Сегодня»
    const groups = groupNotificationsByDay([at(1, '2026-10-18T21:30:00Z')], base, now)
    expect(groups[0]!.day).toBe('Сегодня')
  })

  it('пустая лента — пустой список групп', () => {
    expect(groupNotificationsByDay([], base, now)).toEqual([])
  })
})
