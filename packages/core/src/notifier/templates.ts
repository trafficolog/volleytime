export type NotificationType =
  | 'booking_confirmed'
  | 'booking_pending_payment'
  | 'booking_waitlisted'
  | 'waitlist_promoted'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'payment_pending_organizer'
  | 'event_cancelled'
  | 'reminder_24h'
  | 'reminder_2h'

export interface KeyboardButton {
  text: string
  url?: string
  webAppUrl?: string
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
  currency?: string
  playerName?: string
  method?: string
  needsPayment?: boolean
  refunded?: boolean
  miniAppUrl?: string
}

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

  const title = p.eventTitle ? esc(p.eventTitle) : 'событие'
  const when = p.eventDate ? `\n📅 ${esc(p.eventDate)}` : ''

  switch (type) {
    case 'booking_confirmed':
      return { text: `✅ Вы записаны на <b>${title}</b>${when}`, keyboard: openBtn() }
    // бронь держится до подтверждения оплаты — отдельный текст, чтобы место не считали закреплённым (8.9.1)
    case 'booking_pending_payment':
      return {
        text:
          `📝 Место на <b>${title}</b>${when} забронировано.\n\n` +
          `💳 Оплатите ${formatMoney(p.amount ?? 0, p.currency)}` +
          (p.method === 'transfer' ? ' переводом' : ' наличными') +
          ` организатору — держим место до подтверждения оплаты.`,
        keyboard: openBtn(),
      }
    case 'booking_waitlisted':
      return {
        text: `📋 Вы в листе ожидания на <b>${title}</b>${when}\n\nЕсли место освободится, мы сообщим.`,
        keyboard: openBtn(),
      }
    case 'waitlist_promoted':
      return {
        text:
          `🎉 Освободилось место — вы в составе на <b>${title}</b>${when}` +
          (p.needsPayment ? '\n\n💳 Не забудьте оплатить участие.' : ''),
        keyboard: openBtn(),
      }
    case 'payment_confirmed':
      return {
        text:
          `✅ Оплата ${formatMoney(p.amount ?? 0, p.currency)} подтверждена.\n` +
          (p.planName ? `Абонемент «${esc(p.planName)}» активирован.` : `<b>${title}</b>${when}`),
        keyboard: openBtn(),
      }
    case 'payment_rejected':
      return {
        text: p.planName
          ? `❌ Оплата абонемента «${esc(p.planName)}» отклонена.\n\nСвяжитесь с организатором.`
          : `❌ Оплата за <b>${title}</b>${when} отклонена. Запись отменена.\n\nСвяжитесь с организатором.`,
        keyboard: openBtn(),
      }
    case 'payment_pending_organizer':
      return {
        text:
          `💰 Новая заявка на оплату\n` +
          (p.planName ? `Абонемент «${esc(p.planName)}»\n` : `<b>${title}</b>${when}\n`) +
          `Игрок: ${esc(p.playerName ?? '—')}\n` +
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
      return { text: `🏐 Напоминание: завтра <b>${title}</b>${when}`, keyboard: openBtn() }
    case 'reminder_2h':
      return { text: `⏰ Через 2 часа: <b>${title}</b>${when}\n\nДо встречи!`, keyboard: openBtn() }
  }
}
