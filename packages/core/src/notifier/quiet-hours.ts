/** Время суток в минутах от полуночи в часовом поясе `timeZone` для момента `at`. */
export function minutesOfDay(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

/**
 * Тихие часы (20.3.2, ADR v3): окно `[start, end)` в минутах от полуночи часового пояса группы-
 * источника; окно может переходить через полночь (22:00–07:00). Возвращает момент окончания окна,
 * если `now` внутри него, иначе `null`. Не заданы или `start = end` — окна нет.
 */
export function quietHoursEnd(
  now: Date,
  window: { start: number | null; end: number | null },
  timeZone: string,
): Date | null {
  const { start, end } = window
  if (start === null || end === null || start === end) return null
  let tz = timeZone
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
  } catch {
    tz = 'Europe/Minsk'
  }
  const m = minutesOfDay(now, tz)
  const inside = start < end ? m >= start && m < end : m >= start || m < end
  if (!inside) return null
  // конец окна — настенное время зоны: по разнице минут приближаем, затем поправляем на разницу
  // смещения (переход на летнее/зимнее время между now и концом окна)
  const minuteFloor = now.getTime() - (now.getTime() % 60_000)
  const approx = minuteFloor + ((end - m + 1440) % 1440) * 60_000
  const drift = ((end - minutesOfDay(new Date(approx), tz) + 2160) % 1440) - 720
  const corrected = approx + drift * 60_000
  // конец окна внутри пропущенного часа (весна): поправка может уйти в прошлое — берём без неё
  return new Date(corrected > now.getTime() ? corrected : approx)
}
