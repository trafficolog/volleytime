/**
 * Запись на несколько мест (20.4.5, M-06): границы степпера, разбиение «основа / очередь»,
 * согласие на частичную очередь и отсчёт предложения места. Только представление: число мест,
 * лимит группы и очередь решает сервер (20.1.2, 20.3.1) — здесь они лишь предсказаны для экрана.
 */

export type SeatPlanKind = 'main' | 'partial' | 'queue'

export interface SeatPlan {
  seats: number
  /** Мест, которые игрок займёт сразу. */
  mainSeats: number
  /** Мест, которые встанут в очередь. */
  queueSeats: number
  kind: SeatPlanKind
  /** Частичная очередь требует явного согласия игрока (`allowWaitlist`, иначе 409). */
  needsConsent: boolean
}

/** «1 место / 2 места / 5 мест / 21 место». */
export function seatsWord(count: number): string {
  const n = Math.abs(count)
  if (n % 10 === 1 && n % 100 !== 11) return 'место'
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'места'
  return 'мест'
}
export const seatsLabel = (count: number): string => `${count} ${seatsWord(count)}`

/** «до 1 места / до 3 мест»: родительный падеж после «до». */
export const seatsUpTo = (count: number): string =>
  `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'места' : 'мест'}`

/** «1 игрок / 2 игрока / 5 игроков». */
export function playersWord(count: number): string {
  const n = Math.abs(count)
  if (n % 10 === 1 && n % 100 !== 11) return 'игрок'
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'игрока'
  return 'игроков'
}

/**
 * Верхняя граница степпера: лимит группы и вместимость события; при выключенном
 * `EVENT_MULTI_SEAT_ENABLED` — одно место (интерфейс как до 20.1.2).
 */
export function maxSeatsFor(input: {
  maxSeatsPerBooking: number | null | undefined
  capacity: number
  multiSeatEnabled: boolean
}): number {
  if (!input.multiSeatEnabled) return 1
  const limit = Math.min(input.maxSeatsPerBooking ?? 1, input.capacity)
  return Math.max(1, Math.floor(limit))
}

export function clampSeats(seats: number, max: number): number {
  if (!Number.isFinite(seats)) return 1
  return Math.min(Math.max(1, Math.floor(seats)), Math.max(1, max))
}

/** Разбиение выбранных мест по свободным: хватает — основа, нет ни одного — очередь, иначе и то и другое. */
export function planSeats(seats: number, freeSeats: number): SeatPlan {
  const mainSeats = Math.min(Math.max(0, freeSeats), seats)
  const queueSeats = seats - mainSeats
  const kind: SeatPlanKind = queueSeats === 0 ? 'main' : mainSeats === 0 ? 'queue' : 'partial'
  return { seats, mainSeats, queueSeats, kind, needsConsent: kind === 'partial' }
}

/** Можно ли отправлять запись: частичная очередь — только с явным согласием. */
export function canSubmitBooking(plan: SeatPlan, consent: boolean): boolean {
  return !plan.needsConsent || consent
}

/** Заголовок кнопки записи: «Записаться», «Записаться · 2 места», «В лист ожидания · 2 места». */
export function bookingSubmitLabel(plan: SeatPlan): string {
  const tail = plan.seats > 1 ? ` · ${seatsLabel(plan.seats)}` : ''
  if (plan.kind === 'queue')
    return plan.seats > 1 ? `В лист ожидания${tail}` : 'Встать в лист ожидания'
  return `Записаться${tail}`
}

/** Подпись выбранного числа мест: «Только я» / «Я и ещё 2». */
export function seatsHeadline(seats: number): string {
  return seats <= 1 ? 'Только я' : `Я и ещё ${seats - 1}`
}

export interface MyBookingSeats {
  status: string
  seats?: number | null
  waitlistSeats?: number | null
}

/** Что показать про места своей записи сверх статуса; `null` — ничего (одно место). */
export function myBookingSeatsText(booking: MyBookingSeats): string | null {
  const seats = booking.seats ?? 1
  const queued = booking.waitlistSeats ?? 0
  if (booking.status === 'waitlisted') return seats > 1 ? `В очереди на ${seatsLabel(seats)}` : null
  if (queued > 0) return `${seatsLabel(seats)} за вами, ещё ${seatsLabel(queued)} в очереди`
  return null
}

/** Заголовок карточки записи: «Вы записаны на 2 места» вместо общего. */
export function myBookingTitle(booking: MyBookingSeats, fallback: string): string {
  const seats = booking.seats ?? 1
  if (['confirmed', 'pending_payment'].includes(booking.status) && seats > 1)
    return `Вы записаны на ${seatsLabel(seats)}`
  return fallback
}

export interface OfferCountdown {
  expired: boolean
  /** Осталось секунд, округлено вверх (0 после истечения). */
  secondsLeft: number
  /** «29:41»; пусто после истечения. */
  clock: string
  /** «Осталось 29:41» либо итог истечения. */
  text: string
}

/** Итог истёкшего предложения — решение владельца 2026-10-16 (D-03): игрок покидает очередь. */
export const OFFER_EXPIRED_TEXT =
  'Время подтверждения вышло — вы покинули очередь. Записаться можно заново.'

/** Отсчёт предложения места из очереди: 30 мин на подтверждение (D-03, 20.3.1). */
export function offerCountdown(expiresAt: string | Date, now: Date): OfferCountdown {
  const msLeft = new Date(expiresAt).getTime() - now.getTime()
  if (!Number.isFinite(msLeft) || msLeft <= 0)
    return { expired: true, secondsLeft: 0, clock: '', text: OFFER_EXPIRED_TEXT }
  const secondsLeft = Math.ceil(msLeft / 1000)
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
  return { expired: false, secondsLeft, clock, text: `Осталось ${clock}` }
}

export const offerTitle = (seats: number): string =>
  seats > 1 ? `Освободилось ${seatsLabel(seats)}` : 'Освободилось место'

/** Способ оплаты в листе записи: подготовлен страницей, форма его только рисует. */
export interface BookingMethodOption {
  id: string
  label: string
  hint: string
  /** Правая подпись: сумма или «−2 сесс.». */
  tag?: string
  disabled?: boolean
}
