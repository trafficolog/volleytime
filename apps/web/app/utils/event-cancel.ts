/**
 * Последствия отмены события для диалога подтверждения (20.5.6, W-05). Только объяснение для
 * организатора по составу; фактические возвраты проводит сервер (`events.cancel`, 20.2.1):
 * - записи (и очередь) отменяются без продвижения, игроки получают уведомление;
 * - оплаченные места возвращаются (в том числе наличные места смешанной записи с абонементом),
 *   неоплаченные платежи отменяются, занятия абонемента возвращаются; у отменённых записей split
 *   с зафиксированной долей доля тоже возвращается (D-14);
 * - баланс событий возвращается, если отмена до открытия записи или нет ни одной неотменённой
 *   записи, включая очередь (D-09, D-13).
 * Счёт — в местах: запись может занимать несколько мест (20.1.2).
 */
import { type RosterBooking, seatsWordRu, subscriptionSeatsOf } from './organizer-roster'

export interface CancelConsequences {
  /** Неотменённые записи, включая очередь; `null` — состав не загружен. */
  activeBookings: number | null
  inMain: number
  waitlisted: number
  /** Места в частичной очереди у записей в основе. */
  queuedSeats: number
  /** Места, оплаченные платежами (будут возвращены). */
  paidSeats: number
  /** Места, ждущие оплаты (платежи отменятся). */
  unpaidSeats: number
  /** Места, оплаченные занятиями абонемента (занятия вернутся). */
  subscriptionSeats: number
  /** Отменённые записи с зафиксированной долей split (доля возвращается). */
  releasedShares: number
  balance: 'returned' | 'kept' | 'unknown'
  lines: string[]
}

const MAIN_STATUSES = ['confirmed', 'pending_payment', 'attended', 'no_show']

export function cancelConsequencesOf(
  rows: readonly RosterBooking[] | null,
  options: { bookingOpensAt?: string | Date | null; now?: Date } = {},
): CancelConsequences {
  if (rows === null) {
    return {
      activeBookings: null,
      inMain: 0,
      waitlisted: 0,
      queuedSeats: 0,
      paidSeats: 0,
      unpaidSeats: 0,
      subscriptionSeats: 0,
      releasedShares: 0,
      balance: 'unknown',
      lines: [
        'Состав не загружен: все записи будут отменены, игроки получат уведомление.',
        'Оплаты вернутся, занятия абонементов вернутся. Баланс событий вернётся, если запись ещё не открывалась или в событии нет ни одной записи, включая лист ожидания.',
      ],
    }
  }
  const now = options.now ?? new Date()
  const opensAt = options.bookingOpensAt ? new Date(options.bookingOpensAt) : null
  const beforeOpening = opensAt !== null && now < opensAt

  const active = rows.filter((r) => r.status !== 'cancelled')
  const inMain = active.filter((r) => MAIN_STATUSES.includes(r.status))
  const waitlistedRows = active.filter((r) => r.status === 'waitlisted')
  const queuedSeats = inMain.reduce((sum, r) => sum + Math.max(0, r.waitlistSeats), 0)
  const waitlistedSeats = waitlistedRows.reduce((sum, r) => sum + Math.max(0, r.seats), 0)
  const seatsTotal = inMain.reduce((sum, r) => sum + Math.max(0, r.seats), 0) + waitlistedSeats
  const paidSeats = inMain.reduce((sum, r) => sum + r.paidSeats, 0)
  const unpaidSeats = inMain.reduce((sum, r) => sum + r.pendingPaymentIds.length, 0)
  const subscriptionSeats = inMain.reduce((sum, r) => sum + subscriptionSeatsOf(r), 0)
  const releasedShares = rows.filter(
    (r) => r.status === 'cancelled' && r.allocatedAmount !== null,
  ).length
  const balance = beforeOpening || active.length === 0 ? 'returned' : 'kept'

  const lines: string[] = []
  if (active.length === 0) lines.push('Записей нет — уведомлять игроков не нужно.')
  else {
    lines.push(
      `Записи будут отменены: ${active.length} (${seatsWordRu(seatsTotal)}). Каждый игрок получит уведомление в Telegram.`,
    )
    if (waitlistedRows.length > 0 || queuedSeats > 0)
      lines.push(
        `В листе ожидания: ${seatsWordRu(waitlistedSeats + queuedSeats)} — очередь тоже отменяется, места никому не предлагаются.`,
      )
  }
  if (paidSeats > 0) lines.push(`Оплаченные места (${paidSeats}): платежи отметятся возвращёнными.`)
  if (unpaidSeats > 0) lines.push(`Неоплаченные места (${unpaidSeats}): платежи будут отменены.`)
  if (subscriptionSeats > 0)
    lines.push(`Абонементы: занятия (${subscriptionSeats}) вернутся на абонемент игрока.`)
  if (releasedShares > 0)
    lines.push(
      `Отменённые записи с зафиксированной долей (${releasedShares}): доля тоже вернётся (сбор суммой).`,
    )
  lines.push(
    balance === 'returned'
      ? beforeOpening
        ? 'Баланс событий: отмена до открытия записи — вернётся 1 событие, если оно было списано.'
        : 'Баланс событий: в событии нет записей, поэтому вернётся 1 событие, если оно было списано.'
      : 'Баланс событий не возвращается: запись уже открыта и в событии есть записи (в том числе в листе ожидания).',
  )

  return {
    activeBookings: active.length,
    inMain: inMain.length,
    waitlisted: waitlistedRows.length,
    queuedSeats,
    paidSeats,
    unpaidSeats,
    subscriptionSeats,
    releasedShares,
    balance,
    lines,
  }
}
