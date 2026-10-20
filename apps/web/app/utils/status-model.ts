/**
 * Статусная модель (19.1.2, M-05): три оси, которые никогда не смешиваются в одном чипе.
 *  1. Моё участие  — синий чип словом, только у игрока (`participationOf`).
 *  2. Событие      — нейтральный серый чип словом (`eventStateOf`).
 *  3. Места        — цифра + шкала, цвет на шкале (`seatsOf`, `meterTint`).
 * Оплата — отдельная ось (amber/grass), живёт в `event-pricing-label.ts`.
 * Только представление: серверные статусы не меняются.
 */

export type ParticipationKey = 'going' | 'waitlist' | 'missed'
export interface Participation {
  key: ParticipationKey
  label: string
  icon: 'check' | 'clock'
}

/**
 * Участие игрока по статусу его записи.
 * `pending_payment` — место за игроком, оплата — отдельная ось, поэтому «Иду».
 * `attended` / `no_show` — итог уже прошедшего события, не «участие»: чипа нет.
 * `waitPos` — позиция в очереди (20.4.11): сервер отдаёт её только самому игроку; без поля «В очереди»,
 * `null` у записи в очереди — «Не попали» (очередь уже не движется).
 */
export function participationOf(
  booking:
    { status: string; waitPos?: number | null; waitlistSeats?: number | null } | null | undefined,
): Participation | null {
  if (!booking) return null
  if (booking.status === 'confirmed' || booking.status === 'pending_payment') {
    // места в основе и ещё места в очереди (20.1.2): «Иду · +1 в очереди · 2-й» (решение 2026-10-20)
    const queued = booking.waitlistSeats ?? 0
    const pos = booking.waitPos
    return {
      key: 'going',
      label: queued > 0 && pos && pos > 0 ? `Иду · +${queued} в очереди · ${pos}-й` : 'Иду',
      icon: 'check',
    }
  }
  if (booking.status === 'waitlisted') {
    const pos = booking.waitPos
    // явный null — сервер не отдаёт позицию, потому что очередь уже не движется (событие закрыто,
    // началось, отменено, рассчитано): игрок не попал; нет поля — позиция неизвестна
    if (pos === null) return { key: 'missed', label: 'Не попали', icon: 'clock' }
    return {
      key: 'waitlist',
      label: pos && pos > 0 ? `В очереди · ${pos}-й` : 'В очереди',
      icon: 'clock',
    }
  }
  return null
}

export type EventStateKey = 'cancelled' | 'past' | 'closed' | 'draft'
export interface EventState {
  key: EventStateKey
  label: string
}

/**
 * Состояние события одним серым словом. `null` — запись открыта, чипа нет.
 * Приоритет: отменено → черновик (даже с прошедшей датой) → прошло → закрыто.
 */
export function eventStateOf(
  event: { status: string; startsAt: string | Date; endsAt?: string | Date | null },
  now: Date = new Date(),
): EventState | null {
  if (event.status === 'cancelled') return { key: 'cancelled', label: 'Отменена' }
  if (event.status === 'draft') return { key: 'draft', label: 'Черновик' }
  const ended = event.endsAt ? new Date(event.endsAt) <= now : false
  if (event.status === 'finished' || ended) return { key: 'past', label: 'Прошла' }
  if (event.status === 'closed' || new Date(event.startsAt) <= now)
    return { key: 'closed', label: 'Запись закрыта' }
  return null
}

/** Заполненность → цвет шкалы. Единственное правило для списка, карточки и календаря. */
export type MeterTone = 'grass' | 'amber' | 'rose'
export const meterTone = (pct: number): MeterTone =>
  pct >= 100 ? 'rose' : pct > 70 ? 'amber' : 'grass'
export const meterTint = (pct: number): string => `var(--vt-${meterTone(pct)})`
/** Та же семантика, светлые тона для синей/тёмной поверхности (hero). */
export const meterTintOnDark = (pct: number): string =>
  pct >= 100
    ? 'var(--vt-rose-on-hero)'
    : pct > 70
      ? 'var(--vt-amber-on-hero)'
      : 'var(--vt-meter-ok-on-hero)'

export interface Seats {
  pct: number
  taken: number
  capacity: number
  full: boolean
  /** «12/16» или «мест нет» (только когда событие ещё открыто). */
  text: string
  /** Событие в нейтральном состоянии — шкала серая, не красится. */
  dim: boolean
  tone: MeterTone
}

/**
 * Места. `taken` — занятые МЕСТА (не игроки): при многоместной записи (20.1.2)
 * достаточно передавать сумму мест, остальное не меняется.
 */
export function seatsOf(
  seats: { taken: number; capacity: number },
  state: EventState | null = null,
): Seats {
  const capacity = Math.max(0, seats.capacity)
  const taken = Math.max(0, seats.taken)
  const pct = capacity > 0 ? Math.min(100, (taken / capacity) * 100) : 0
  const full = capacity > 0 && taken >= capacity
  const dim = state !== null
  return {
    pct,
    taken,
    capacity,
    full,
    dim,
    tone: meterTone(pct),
    text: full && !dim ? 'мест нет' : `${taken}/${capacity}`,
  }
}

/** Согласование: «1 ждёт / 2 ждут / 5 ждут / 21 ждёт». */
export function pendingVerb(count: number): 'ждёт' | 'ждут' {
  const n = Math.abs(count)
  return n % 10 === 1 && n % 100 !== 11 ? 'ждёт' : 'ждут'
}
export const pendingLabel = (count: number): string => `${count} ${pendingVerb(count)}`

/** Размер очереди для всех игроков: людей (записей), не мест, без имён (решение 2026-10-20). */
export const waitlistPeopleLabel = (count: number): string => `в очереди ${count} чел.`

/** Сколько записей ждёт оплаты. */
export const pendingOf = (bookings: readonly { status: string }[]): number =>
  bookings.filter((b) => b.status === 'pending_payment').length

export const OVERLAP_LABEL = 'Пересечение'

/** События, чьи интервалы пересекаются с `event` (для общего календаря, M-10). */
export function overlapsOf<
  T extends { id: number | string; startsAt: string | Date; endsAt: string | Date },
>(event: T, others: readonly T[]): T[] {
  const s = new Date(event.startsAt).getTime()
  const e = new Date(event.endsAt).getTime()
  return others.filter(
    (o) =>
      o.id !== event.id && new Date(o.startsAt).getTime() < e && new Date(o.endsAt).getTime() > s,
  )
}
