/**
 * Публичная страница события (20.6.1, P-17): модель представления по ответу
 * `GET /api/public/events/{slug}`. Цена — только из ответа (`quoteEventPrice`, 20.1.1, тот же
 * расчёт, что `GET …/events/{id}/price`), без своих формул; «мест нет» определяется занятостью
 * события, а не ценой (`seatCount.current` ограничен вместимостью); у отменённого события цены нет.
 */
import { formatTime, type EventPriceQuote } from '@volley-time/shared'

import { priceViewOf, type PriceScenario } from './event-price-view'
import { formatMoneyRu } from './labels'
import { eventStateOf, seatsOf, type Seats } from './status-model'

export interface PublicEventPayload {
  slug: string
  event: {
    title: string
    description: string | null
    status: 'published' | 'closed' | 'finished' | 'cancelled'
    startsAt: string
    endsAt: string
    place: { name: string | null; address: string | null }
    capacity: number
    taken: number
    players: number
    full: boolean
    currency: string
    joinMode: 'open' | 'invite'
    bookingOpensAt: string | null
  }
  group: { name: string; city: string | null; timezone: string; memberCount: number }
  price: (EventPriceQuote & { currency: string }) | null
  roster: { initials: string[]; more: number }
  indexable: boolean
  telegramUrl: string | null
}

export type PublicEventState = 'open' | 'opens_later' | 'invite' | 'closed' | 'past' | 'cancelled'

export interface PublicTile {
  label: string
  value: string
  sub: string | null
}

export interface PublicEventModel {
  state: PublicEventState
  statusChip: string
  /** «Делим сумму 210,00 BYN» — только для сбора суммой с действующей ценой. */
  priceChip: string | null
  /** Пояснение под кнопкой записи. */
  priceNote: string
  cta: { label: string; href: string | null }
  dateTile: PublicTile
  priceTile: PublicTile | null
  seats: Seats
  /** «и ещё N» рядом с инициалами; null — нечего показывать. */
  rosterLine: string | null
  splitExplainer: {
    title: string
    divider: string | null
    scenarios: PriceScenario[]
    note: string
  } | null
  place: { name: string; address: string | null } | null
  seoTitle: string
  seoDescription: string
}

const fmt = (tz: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: tz, ...opts })
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('ru') + s.slice(1)

/** «30 мая» — без времени и без предлога, который в ICU зависит от версии. */
const dayMonth = (d: Date, tz: string) => fmt(tz, { day: 'numeric', month: 'long' }).format(d)

export function publicEventModel(p: PublicEventPayload, now: Date = new Date()): PublicEventModel {
  const ev = p.event
  const tz = p.group.timezone
  const starts = new Date(ev.startsAt)
  const ends = new Date(ev.endsAt)
  const money = (minor: number) => formatMoneyRu(minor, ev.currency)

  const lifecycle = eventStateOf({ status: ev.status, startsAt: starts, endsAt: ends }, now)
  const opensAt = ev.bookingOpensAt ? new Date(ev.bookingOpensAt) : null
  const state: PublicEventState =
    lifecycle?.key === 'cancelled'
      ? 'cancelled'
      : lifecycle?.key === 'past'
        ? 'past'
        : lifecycle?.key === 'closed'
          ? 'closed'
          : ev.joinMode === 'invite'
            ? 'invite'
            : opensAt && opensAt > now
              ? 'opens_later'
              : 'open'

  const seats = seatsOf({ taken: ev.taken, capacity: ev.capacity }, lifecycle)
  const priceView = p.price
    ? priceViewOf(
        p.price,
        ev.currency,
        {
          status: ev.status,
          startsAt: starts,
          endsAt: ends,
          capacity: ev.capacity,
          taken: ev.taken,
        },
        now,
      )
    : null
  const isSplit = p.price?.mode === 'split'
  const settled = p.price?.basis === 'settled'

  const priceTile: PublicTile | null = !p.price
    ? null
    : p.price.mode === 'fixed'
      ? {
          label: 'Цена',
          value: p.price.perSeat.max === 0 ? 'Бесплатно' : money(p.price.perSeat.max),
          sub: p.price.perSeat.max === 0 ? null : 'за одно место',
        }
      : settled
        ? { label: 'Итог с человека', value: priceView!.headline, sub: priceView!.divider }
        : {
            label: 'Цена · делим сумму',
            value: priceView!.headline,
            sub: `при полном составе — ${money(p.price.perSeat.min)}`,
          }

  const ctaLabel =
    state === 'open' || state === 'opens_later'
      ? seats.full && state === 'open'
        ? 'В лист ожидания через Telegram'
        : 'Записаться через Telegram'
      : 'Открыть в Telegram'

  const dateValue = dayMonth(starts, tz)
  const dateSub = `${formatTime(starts, tz)} — ${formatTime(ends, tz)}`
  const weekday = capitalize(fmt(tz, { weekday: 'long' }).format(starts))
  const placeName = ev.place.name

  return {
    state,
    statusChip: {
      open: 'Открытая запись',
      opens_later:
        `Запись откроется ${opensAt ? `${dayMonth(opensAt, tz)}, ${formatTime(opensAt, tz)}` : ''}`.trim(),
      invite: 'Запись по приглашению',
      closed: 'Запись закрыта',
      past: 'Событие прошло',
      cancelled: 'Событие отменено',
    }[state],
    priceChip:
      isSplit && p.price?.targetAmount && !(state === 'cancelled' || state === 'past')
        ? `Делим сумму ${money(p.price.targetAmount)}`
        : null,
    priceNote: {
      open: isSplit
        ? 'Цена зависит от числа игроков — чем больше запишется, тем дешевле каждому.'
        : 'Войдёшь в Telegram — попадёшь в свою запись. Никакой регистрации.',
      opens_later:
        'Запись ещё не открыта. Откройте событие в Telegram — напомним, когда она начнётся.',
      invite:
        'Запись только по приглашению организатора. Откройте Telegram, чтобы запросить доступ.',
      closed: settled
        ? 'Запись закрыта. Участники получили сумму к оплате в Telegram.'
        : 'Запись закрыта. Откройте событие в Telegram, чтобы посмотреть свою запись.',
      past: 'Событие уже прошло.',
      cancelled: 'Событие отменено организатором.',
    }[state],
    cta: { label: ctaLabel, href: p.telegramUrl },
    dateTile: { label: weekday, value: dateValue, sub: dateSub },
    priceTile,
    seats,
    rosterLine: p.roster.more > 0 ? `и ещё ${p.roster.more}` : null,
    splitExplainer:
      priceView && isSplit
        ? {
            title: settled ? 'Как посчитана цена' : 'Как считается цена',
            divider: priceView.divider,
            scenarios: priceView.scenarios,
            note: settled
              ? 'Сумма зафиксирована при закрытии записи. Кто занял несколько мест, платит за каждое.'
              : 'Итог зафиксируется при закрытии записи. Можно занять несколько мест одной записью.',
          }
        : null,
    place: placeName ? { name: placeName, address: ev.place.address } : null,
    seoTitle: `${ev.title} — ${dateValue}, ${formatTime(starts, tz)} · ${p.group.name}`,
    seoDescription:
      `${weekday}, ${dateValue}, ${dateSub}.` +
      (placeName ? ` ${placeName}.` : '') +
      ` Мест занято ${ev.taken} из ${ev.capacity}.`,
  }
}

/** Страница без данных: 404 — нет события, 429 — лимит запросов, иначе сбой загрузки. */
export function publicEventProblem(statusCode: number | undefined): {
  status: 404 | 429 | 502
  title: string
  description: string
} {
  if (statusCode === 404)
    return {
      status: 404,
      title: 'Событие не найдено',
      description: 'Ссылка устарела или событие скрыто организатором.',
    }
  if (statusCode === 429)
    return {
      status: 429,
      title: 'Слишком много запросов',
      description: 'Подождите минуту и обновите страницу.',
    }
  return {
    status: 502,
    title: 'Не удалось загрузить событие',
    description: 'Попробуйте обновить страницу чуть позже.',
  }
}

const icsStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
const icsText = (t: string) => t.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r\n|\r|\n/g, '\\n')

/** Свёртка строки по RFC 5545: не больше 75 октетов, продолжение — CRLF + пробел, без разрыва символа. */
export function icsFold(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    // у продолжения первый октет занят пробелом
    if (size + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

/** Файл календаря (.ics) для кнопки «В календарь»: только данные события, без игроков. */
export function publicEventIcs(p: PublicEventPayload, now: Date = new Date()): string {
  const place = [p.event.place.name, p.event.place.address].filter(Boolean).join(', ')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VolleyTime//Public event//RU',
    'BEGIN:VEVENT',
    `UID:${p.slug}@volleytime`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(new Date(p.event.startsAt))}`,
    `DTEND:${icsStamp(new Date(p.event.endsAt))}`,
    `SUMMARY:${icsText(p.event.title)}`,
    ...(place ? [`LOCATION:${icsText(place)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(icsFold)
    .join('\r\n')
}
