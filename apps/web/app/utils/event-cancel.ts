/**
 * Последствия отмены события для диалога подтверждения (20.5.6, W-05). Только объяснение для
 * организатора по составу; фактические возвраты проводит сервер (`events.cancel`, 20.2.1):
 * - записи (и очередь) отменяются без продвижения, игроки получают уведомление;
 * - оплаченные места возвращаются, неоплаченные платежи отменяются, занятия абонемента возвращаются
 *   (D-14: отмена события организатором возвращает все оплаченные места);
 * - баланс событий возвращается, только если нет ни одной неотменённой записи, включая очередь
 *   (D-09, D-13).
 */
import { type RosterBooking, seatsWordRu } from './organizer-roster'

export interface CancelConsequences {
  /** Неотменённые записи, включая очередь; `null` — состав не загружен. */
  activeBookings: number | null
  inMain: number
  waitlisted: number
  /** Места в частичной очереди у записей в основе. */
  queuedSeats: number
  paid: number
  unpaid: number
  subscription: number
  balance: 'returned' | 'kept' | 'unknown'
  lines: string[]
}

const PAID_STATUSES = ['confirmed', 'attended', 'no_show']
const MAIN_STATUSES = ['confirmed', 'pending_payment', 'attended', 'no_show']

export function cancelConsequencesOf(rows: readonly RosterBooking[] | null): CancelConsequences {
  if (rows === null) {
    return {
      activeBookings: null,
      inMain: 0,
      waitlisted: 0,
      queuedSeats: 0,
      paid: 0,
      unpaid: 0,
      subscription: 0,
      balance: 'unknown',
      lines: [
        'Состав не загружен: все записи будут отменены, игроки получат уведомление.',
        'Оплаты вернутся, занятия абонементов вернутся. Баланс событий вернётся только если в событии нет ни одной записи, включая лист ожидания.',
      ],
    }
  }
  const active = rows.filter((r) => r.status !== 'cancelled')
  const inMain = active.filter((r) => MAIN_STATUSES.includes(r.status))
  const waitlisted = active.filter((r) => r.status === 'waitlisted').length
  const queuedSeats = inMain.reduce((sum, r) => sum + Math.max(0, r.waitlistSeats), 0)
  const paid = inMain.filter(
    (r) => PAID_STATUSES.includes(r.status) && r.method !== 'subscription' && r.paymentId !== null,
  ).length
  const unpaid = inMain.filter((r) => r.status === 'pending_payment' && r.paymentId !== null).length
  const subscription = inMain.filter((r) => r.method === 'subscription').length
  const balance = active.length === 0 ? 'returned' : 'kept'

  const lines: string[] = []
  if (active.length === 0) lines.push('Записей нет — уведомлять игроков не нужно.')
  else {
    lines.push(
      `Записи будут отменены: ${active.length}. Каждый игрок получит уведомление в Telegram.`,
    )
    if (waitlisted > 0 || queuedSeats > 0)
      lines.push(
        `В листе ожидания: ${waitlisted > 0 ? `${waitlisted} ${waitlisted === 1 ? 'запись' : 'записей'}` : seatsWordRu(queuedSeats)} — очередь тоже отменяется, места никому не предлагаются.`,
      )
  }
  if (paid > 0) lines.push(`Оплаченные записи (${paid}): платежи отметятся возвращёнными.`)
  if (unpaid > 0) lines.push(`Неоплаченные платежи (${unpaid}) будут отменены.`)
  if (subscription > 0)
    lines.push(`Абонементы (${subscription}): занятия вернутся на абонемент игрока.`)
  lines.push(
    balance === 'returned'
      ? 'Баланс событий: в событии нет записей, поэтому вернётся 1 событие, если оно было списано.'
      : 'Баланс событий не возвращается: в событии есть записи (в том числе в листе ожидания).',
  )

  return {
    activeBookings: active.length,
    inMain: inMain.length,
    waitlisted,
    queuedSeats,
    paid,
    unpaid,
    subscription,
    balance,
    lines,
  }
}
