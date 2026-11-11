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

  it('в кабинете цель «абонементы» ведёт на план абонементов группы (21.2.9)', () => {
    const v = notificationView(
      item(
        { type: 'payment_confirmed', eventId: null },
        { planName: '8 сессий', amount: 11000, currency: 'BYN', target: 'subscriptions' },
      ),
      '/app/orgs/7',
      '/app/orgs/7/plans',
    )
    expect(v.to).toBe('/app/orgs/7/plans')
  })

  it('заявка на оплату организатору ведёт на оплаты', () => {
    const v = notificationView(
      item({ type: 'organizer_action_required' }, { playerName: 'Иван', target: 'payments' }),
      '/m/orgs/7',
    )
    expect(v.to).toBe('/m/orgs/7/payments')
  })

  it('обещание взноса организатору (21.1.5) ведёт к сборам, а не к оплатам', () => {
    const v = notificationView(
      item(
        { type: 'organizer_action_required' },
        { playerName: 'Соня', collectionTitle: 'Новый комплект мячей', target: 'org' },
      ),
      '/m/orgs/7',
    )
    expect(v.title).toBe('Новое обещание взноса')
    expect(v.body).toBe('Соня · взнос в сбор «Новый комплект мячей»')
    expect(v.icon).toBe('gift')
    expect(v.to).toBe('/m/orgs/7/collections')
  })

  describe('виды ленты организатора (21.4.5)', () => {
    const now = new Date('2026-10-19T18:00:00Z')

    it('агрегат платежей: счётчик, события, возраст и кнопка «Проверить»', () => {
      const v = notificationView(
        item(
          { type: 'organizer_action_required', eventId: null },
          {
            kind: 'payments_pending',
            count: 4,
            eventTitles: ['Основа', 'Микст'],
            moreEvents: 0,
            oldestAt: '2026-10-19T12:00:00Z',
            target: 'payments',
          },
        ),
        '/m/orgs/7',
        undefined,
        { now },
      )
      expect(v.title).toBe('4 платежа ждут подтверждения')
      expect(v.body).toBe('По событиям «Основа» и «Микст». Самому старому 6 ч.')
      expect(v.action).toBe('Проверить')
      expect(v.actionPrimary).toBe(true)
      expect(v.to).toBe('/m/orgs/7/payments')
      expect(v.tone).toBe('amber')
    })

    it('агрегат: склонение и закрытая серия без кнопки', () => {
      const mk = (count: number) =>
        notificationView(
          item(
            { type: 'organizer_action_required', eventId: null },
            { kind: 'payments_pending', count, eventTitles: [], oldestAt: '2026-10-19T17:30:00Z' },
          ),
          '/m/orgs/7',
          undefined,
          { now },
        )
      expect(mk(1).title).toBe('1 платёж ждёт подтверждения')
      expect(mk(5).title).toBe('5 платежей ждут подтверждения')
      expect(mk(21).title).toBe('21 платёж ждёт подтверждения')
      expect(mk(1).body).toBe('Самому старому меньше часа.')
      const closed = mk(0)
      expect(closed.title).toBe('Платежи обработаны')
      expect(closed.action).toBeUndefined()
      expect(closed.tone).toBe('ink')
    })

    it('«Новая запись» — обычное уведомление без кнопки, ведёт на событие', () => {
      const v = notificationView(
        item(
          { type: 'organizer_action_required', eventId: 5 },
          { kind: 'booking_created', playerName: 'Денис', eventTitle: 'Открытая игра', seats: 2 },
        ),
        '/m/orgs/7',
      )
      expect(v.title).toBe('Новая запись')
      expect(v.body).toBe('Денис записан(а) на «Открытая игра» · мест: 2')
      expect(v.action).toBeUndefined()
      expect(v.tone).toBe('ink')
      expect(v.to).toBe('/m/orgs/7/events/5')
    })

    it('«Отмена записи»: места, деньги по D-14 и уход места из очереди', () => {
      const v = notificationView(
        item(
          { type: 'organizer_action_required', eventId: 5 },
          {
            kind: 'booking_cancelled',
            playerName: 'Катя',
            eventTitle: 'Основа',
            seats: 1,
            paidSeats: 1,
            paidAmount: 1500,
            currency: 'BYN',
            promotedFromWaitlist: true,
          },
        ),
        '/m/orgs/7',
      )
      expect(v.title).toBe('Отмена записи')
      expect(v.body).toContain('Катя отменил(а) запись на «Основа»')
      expect(v.body).toContain('Оплачено: 15,00 BYN — деньги не возвращены автоматически.')
      expect(v.body).toContain('Место ушло первому из листа ожидания.')
      expect(v.action).toBeUndefined()
      expect(v.to).toBe('/m/orgs/7/events/5')
    })

    it('«Отмена записи» организатором не приписывается игроку', () => {
      const v = notificationView(
        item(
          { type: 'organizer_action_required', eventId: 5 },
          { kind: 'booking_cancelled', playerName: 'Катя', eventTitle: 'Основа', byManager: true },
        ),
        '/m/orgs/7',
      )
      expect(v.body).toContain('Запись Катя на «Основа» отменена организатором.')
      expect(v.body).not.toContain('отменил(а)')
    })

    it('«Мало событий на балансе» ведёт к пополнению и не говорит «credits»', () => {
      const n = item(
        { type: 'organizer_action_required', eventId: null },
        { kind: 'event_balance_low', balance: 8, threshold: 10 },
      )
      const mini = notificationView(n, '/m/orgs/7')
      expect(mini.title).toBe('Мало событий на балансе')
      expect(mini.body).toBe('Осталось 8 событий. Пополните баланс.')
      expect(mini.action).toBe('Пополнить')
      expect(mini.actionPrimary).toBeFalsy()
      expect(mini.to).toBe('/m/orgs/7')
      expect(
        notificationView(n, '/app/orgs/7', undefined, { balanceTo: '/app/orgs/7/billing' }).to,
      ).toBe('/app/orgs/7/billing')
    })

    it('обещание взноса с collectionId ведёт на этот сбор, в кабинете — к списку', () => {
      const n = item(
        { type: 'organizer_action_required', eventId: null },
        {
          playerName: 'Соня',
          collectionTitle: 'Новый комплект мячей',
          collectionId: 12,
          target: 'collection',
        },
      )
      const mini = notificationView(n, '/m/orgs/7')
      expect(mini.to).toBe('/m/orgs/7/collections/12')
      expect(mini.action).toBe('Подтвердить')
      expect(notificationView(n, '/app/orgs/7', undefined, { collectionDetail: false }).to).toBe(
        '/app/orgs/7/collections',
      )
    })
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

  it('отозванный запрос приглашения помечен «Запрос отозван» и не выглядит актуальным', () => {
    const v = notificationView(
      item(
        { type: 'organizer_action_required', eventId: 5 },
        {
          playerName: 'Соня',
          eventTitle: 'Основа',
          inviteRequest: true,
          inviteRequestWithdrawn: true,
        },
      ),
      '/m/orgs/7',
    )
    expect(v.title).toBe('Запрос отозван')
    expect(v.body).toBe('Соня · Основа')
    expect(v.tone).toBe('ink')
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
