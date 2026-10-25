export type NotificationType =
  | 'booking_confirmed'
  | 'booking_pending_payment'
  | 'booking_waitlisted'
  | 'waitlist_promoted'
  | 'split_booking_reserved'
  | 'split_price_settled'
  | 'split_settled_organizer'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'payment_pending_organizer'
  | 'event_cancelled'
  | 'reminder_24h'
  | 'reminder_2h'
  // фоновые задачи события (20.3.1)
  | 'booking_opened'
  | 'waitlist_offer'
  | 'waitlist_offer_expired'
  // запросы приглашения на событие «по приглашению» (20.4.7)
  | 'invite_request_organizer'
  | 'invite_request_decided'

export interface KeyboardButton {
  text: string
  url?: string
  webAppUrl?: string
  /** Inline-кнопка с действием (`cx:<id события>` — отмена записи, `oa:<id>` — принять место, 20.3.3). */
  callbackData?: string
}

export interface RenderedMessage {
  text: string
  keyboard?: KeyboardButton[][]
}

/** HTML-экранирование для Telegram parse_mode=HTML. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Сумма в формате ru-RU: «15,00 BYN» (8.8.5). */
export function formatMoney(minor: number, currency = 'BYN'): string {
  if (minor === 0) return 'Бесплатно'
  const n = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100)
  return `${n} ${currency}`
}

export interface TemplateParams {
  eventTitle?: string
  /** ISO-дата события; форматируется в TZ организации при отправке (8.8.5). */
  eventDate?: string
  /** Контекст для форматирования даты и кнопки (заполняется notifierService). */
  organizationId?: number
  eventId?: number
  planName?: string
  /** Куда ведёт кнопка: экран события, платежей организатора, абонементов. */
  target?: 'event' | 'payments' | 'subscriptions' | 'org'
  amount?: number
  targetAmount?: number
  participantCount?: number
  currency?: string
  playerName?: string
  method?: string
  needsPayment?: boolean
  refunded?: boolean
  miniAppUrl?: string
  /** Места операции (20.1.2): записано, продвинуто из очереди, оплачено. */
  seats?: number
  /** Места записи в очереди сверх основы («часть в основу, часть в очередь»). */
  waitlistSeats?: number
  /** Оплаченные места, оставшиеся у записи после отклонения неоплаченных (20.1.2). */
  keptSeats?: number
  /** Ответ организатора на запрос приглашения: `true` — приглашение выдано (20.4.7). */
  inviteApproved?: boolean
  /** Запрос приглашения организатору: в ленте показывается не как заявка на оплату (20.4.7). */
  inviteRequest?: boolean
}

/** « · мест: N» для операций над несколькими местами; одно место — текст R0.7 без изменений. */
const seatsNote = (p: TemplateParams): string =>
  (p.seats && p.seats > 1 ? `\n🎟 Мест: ${p.seats}` : '') +
  (p.waitlistSeats ? `\n📋 Ещё в очереди: ${p.waitlistSeats}` : '')

/** Рендер уведомления: текст + опциональная клавиатура. */
export function renderMessage(type: NotificationType, p: TemplateParams): RenderedMessage {
  const openBtn = (): KeyboardButton[][] | undefined =>
    p.miniAppUrl
      ? [
          [
            {
              text: p.target === 'payments' ? 'Открыть оплаты' : 'Открыть',
              webAppUrl: p.miniAppUrl,
            },
          ],
        ]
      : undefined

  // кнопка действия под ссылкой «Открыть»; id события — не секрет, права проверяет web по Telegram id
  const withAction = (text: string, prefix: 'cx' | 'oa'): KeyboardButton[][] | undefined => {
    const rows = openBtn() ?? []
    if (!p.eventId) return rows.length ? rows : undefined
    return [...rows, [{ text, callbackData: `${prefix}:${p.eventId}` }]]
  }

  const title = p.eventTitle ? esc(p.eventTitle) : 'событие'
  const when = p.eventDate ? `\n📅 ${esc(p.eventDate)}` : ''

  switch (type) {
    case 'booking_confirmed':
      return {
        text: `✅ Вы записаны на <b>${title}</b>${when}${seatsNote(p)}`,
        keyboard: openBtn(),
      }
    // бронь держится до подтверждения оплаты — отдельный текст, чтобы место не считали закреплённым (8.9.1)
    case 'booking_pending_payment':
      return {
        text:
          `📝 Место на <b>${title}</b>${when} забронировано.${seatsNote(p)}\n\n` +
          `💳 Оплатите ${formatMoney(p.amount ?? 0, p.currency)}` +
          (p.method === 'transfer' ? ' переводом' : ' наличными') +
          ` организатору — держим место до подтверждения оплаты.`,
        keyboard: openBtn(),
      }
    case 'booking_waitlisted':
      return {
        text: `📋 Вы в листе ожидания на <b>${title}</b>${when}${seatsNote(p)}\n\nЕсли место освободится, мы сообщим.`,
        keyboard: openBtn(),
      }
    case 'split_booking_reserved':
      return {
        text: `📝 Место на <b>${title}</b>${when} забронировано.\n\nТочная сумма после закрытия записи.`,
        keyboard: openBtn(),
      }
    case 'split_price_settled':
      return {
        text:
          `💳 Запись на <b>${title}</b>${when} закрыта.\n\n` +
          `Ваша доля: ${formatMoney(p.amount ?? 0, p.currency)}.\n` +
          `Оплатите ${formatMoney(p.amount ?? 0, p.currency)}` +
          (p.method === 'transfer' ? ' переводом' : ' наличными') +
          ' организатору.',
        keyboard: openBtn(),
      }
    case 'split_settled_organizer':
      return {
        text:
          `📊 Расчёт для <b>${title}</b>${when} завершён.\n\n` +
          `Распределено: ${formatMoney(p.targetAmount ?? 0, p.currency)}\n` +
          `Участников: ${p.participantCount ?? 0}\nДоли рассчитаны. Ожидается оплата.`,
        keyboard: openBtn(),
      }
    case 'waitlist_promoted':
      return {
        text:
          `🎉 Освободилось место — вы в составе на <b>${title}</b>${when}${seatsNote(p)}` +
          (p.needsPayment ? '\n\n💳 Не забудьте оплатить участие.' : ''),
        keyboard: openBtn(),
      }
    case 'payment_confirmed':
      return {
        text:
          `✅ Оплата ${formatMoney(p.amount ?? 0, p.currency)} подтверждена.\n` +
          (p.planName
            ? `Абонемент «${esc(p.planName)}» активирован.`
            : `<b>${title}</b>${when}${seatsNote(p)}`),
        keyboard: openBtn(),
      }
    case 'payment_rejected':
      return {
        text: p.planName
          ? `❌ Оплата абонемента «${esc(p.planName)}» отклонена.\n\nСвяжитесь с организатором.`
          : p.keptSeats
            ? `❌ Оплата за <b>${title}</b>${when} отклонена. Неоплаченные места сняты, оплаченных мест: ${p.keptSeats}.\n\nСвяжитесь с организатором.`
            : `❌ Оплата за <b>${title}</b>${when} отклонена. Запись отменена.\n\nСвяжитесь с организатором.`,
        keyboard: openBtn(),
      }
    case 'payment_pending_organizer':
      return {
        text:
          `💰 Новая заявка на оплату\n` +
          (p.planName ? `Абонемент «${esc(p.planName)}»\n` : `<b>${title}</b>${when}\n`) +
          `Игрок: ${esc(p.playerName ?? '—')}\n` +
          (p.seats && p.seats > 1 ? `Мест: ${p.seats}\n` : '') +
          `Сумма: ${formatMoney(p.amount ?? 0, p.currency)}` +
          (p.method ? ` (${p.method === 'transfer' ? 'перевод' : 'наличные'})` : ''),
        keyboard: openBtn(),
      }
    case 'event_cancelled':
      return {
        text:
          `⚠️ Событие отменено: <b>${title}</b>${when}` +
          (p.refunded ? '\n\n💸 Оплата возвращена / занятие восстановлено.' : ''),
        keyboard: openBtn(),
      }
    case 'reminder_24h':
      return {
        text: `🏐 Напоминание: завтра <b>${title}</b>${when}`,
        keyboard: withAction('Не смогу прийти', 'cx'),
      }
    case 'reminder_2h':
      return {
        text: `⏰ Через 2 часа: <b>${title}</b>${when}\n\nДо встречи!`,
        keyboard: withAction('Не смогу', 'cx'),
      }
    case 'booking_opened':
      return { text: `📣 Запись открыта: <b>${title}</b>${when}`, keyboard: openBtn() }
    // предложение места из листа ожидания с TTL 30 мин (D-03)
    case 'waitlist_offer':
      return {
        text:
          `🎉 Освободилось место на <b>${title}</b>${when}${seatsNote(p)}\n\n` +
          `Подтвердите участие в течение 30 мин — иначе место уйдёт следующему в очереди.`,
        keyboard: withAction('Беру место', 'oa'),
      }
    // запрос приглашения на событие `invite`: организатору — запрос, игроку — ответ (20.4.7)
    case 'invite_request_organizer':
      return {
        text:
          `🔑 Запрос приглашения\n<b>${title}</b>${when}\n` +
          `Игрок: ${esc(p.playerName ?? '—')}\n\nОтветьте на запрос, чтобы игрок смог записаться.`,
        keyboard: openBtn(),
      }
    case 'invite_request_decided':
      return {
        text: p.inviteApproved
          ? `🎟 Организатор пригласил вас на <b>${title}</b>${when}\n\n` +
            `Приглашение одноразовое. Место не держится, пока вы не запишетесь.`
          : `Организатор не смог пригласить вас на <b>${title}</b>${when}.\n\n` +
            `Вы можете отправить запрос снова.`,
        keyboard: openBtn(),
      }
    case 'waitlist_offer_expired':
      return {
        text:
          `⌛ Вы не подтвердили место на <b>${title}</b>${when} за 30 мин.\n\n` +
          `Место передано следующему, запись в листе ожидания снята.`,
        keyboard: openBtn(),
      }
  }
}
