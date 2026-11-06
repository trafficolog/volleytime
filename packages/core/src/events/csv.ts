import { formatShortDate, formatTime } from '@volley-time/shared'

import { csvCell } from '../ledger/csv'

export const EVENTS_CSV_HEADER = ['Дата', 'Название', 'Зал', 'Места', 'Статус'] as const

/** Событие для выгрузки: только поля события, без сумм оплат и данных игроков (21.2.10). */
export interface EventCsvRow {
  title: string
  startsAt: Date
  endsAt: Date | null
  status: string
  capacity: number
  /** Занято мест (подтверждённые и ждущие оплаты брони). */
  taken: number
  /** Название зала, иначе произвольное место события. */
  place: string | null
}

/** Статус одним словом, как в таблице кабинета: приоритет отмена → черновик → прошла → закрыта. */
export function eventStatusLabel(
  e: Pick<EventCsvRow, 'status' | 'startsAt' | 'endsAt'>,
  now: Date,
): string {
  if (e.status === 'cancelled') return 'Отменена'
  if (e.status === 'draft') return 'Черновик'
  if (e.status === 'finished' || (e.endsAt !== null && e.endsAt <= now)) return 'Прошла'
  if (e.status === 'closed' || e.startsAt <= now) return 'Запись закрыта'
  return 'Открыта запись'
}

/**
 * CSV списка событий: UTF-8 с BOM, разделитель `;`, строки через CRLF, формулы нейтрализованы
 * (`csvCell`, как в кассе и отчётах). «Места» — «12 из 14» текстом, чтобы Excel не принял за дату.
 */
export function buildEventsCsv(
  rows: readonly EventCsvRow[],
  timezone: string,
  now: Date = new Date(),
): string {
  const lines = [EVENTS_CSV_HEADER.join(';')]
  for (const e of rows) {
    lines.push(
      [
        `${formatShortDate(e.startsAt, timezone)} ${formatTime(e.startsAt, timezone)}`,
        e.title,
        e.place,
        `${e.taken} из ${e.capacity}`,
        eventStatusLabel(e, now),
      ]
        .map((cell) => csvCell(cell))
        .join(';'),
    )
  }
  return `﻿${lines.join('\r\n')}\r\n`
}
