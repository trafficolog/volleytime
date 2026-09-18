/** Даты в часовом поясе организации (Task 5.13.16). */
export const DEFAULT_TIMEZONE = 'Europe/Minsk'

const fmt = (tz: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: tz || DEFAULT_TIMEZONE, ...opts })

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d))

/** «18 сентября, 19:00» */
export function formatEventDate(d: Date | string, tz = DEFAULT_TIMEZONE): string {
  return fmt(tz, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(
    toDate(d),
  )
}

/** «19:00» */
export function formatTime(d: Date | string, tz = DEFAULT_TIMEZONE): string {
  return fmt(tz, { hour: '2-digit', minute: '2-digit' }).format(toDate(d))
}

/** «чт, 18 сент.» */
export function formatDay(d: Date | string, tz = DEFAULT_TIMEZONE): string {
  return fmt(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(toDate(d))
}

/** «18.09.2026» */
export function formatShortDate(d: Date | string, tz = DEFAULT_TIMEZONE): string {
  return fmt(tz, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(toDate(d))
}

function partsInZone(d: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(d)
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
  return p
}

/** Смещение зоны (мс) в момент d: локальное время зоны минус UTC. */
function zoneOffsetMs(d: Date, tz: string): number {
  const p = partsInZone(d, tz)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - d.getTime()
}

/** Значение `<input type="datetime-local">` (время в зоне организации) → Date (UTC). */
export function zonedInputToDate(value: string, tz = DEFAULT_TIMEZONE): Date {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) throw new Error(`Invalid datetime-local value: ${value}`)
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!)
  // две итерации корректно обрабатывают переходы на летнее/зимнее время
  let ts = asUtc - zoneOffsetMs(new Date(asUtc), tz)
  ts = asUtc - zoneOffsetMs(new Date(ts), tz)
  return new Date(ts)
}

/** Date → значение `<input type="datetime-local">` в зоне организации. */
export function dateToZonedInput(d: Date | string, tz = DEFAULT_TIMEZONE): string {
  const p = partsInZone(toDate(d), tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}
