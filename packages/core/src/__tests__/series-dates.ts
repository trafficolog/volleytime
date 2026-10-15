import { dateToZonedInput } from '@volley-time/shared'

const DAY = 86_400_000

/** Календарная дата `YYYY-MM-DD` плюс `n` дней. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
}

/** Сегодня в часовом поясе группы. */
export function today(timezone = 'Europe/Minsk'): string {
  return dateToZonedInput(new Date(), timezone).slice(0, 10)
}

/**
 * Понедельник не раньше чем через `weeks` недель от сегодня: даты серий в тестах считаются от
 * текущего дня, поэтому тесты не «протухают» со временем (ревью PR #145).
 */
export function futureMonday(weeks = 3): string {
  const start = addDays(today('UTC'), weeks * 7)
  const weekday = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7 // 0 — понедельник
  return addDays(start, (7 - weekday) % 7)
}

/**
 * Ближайший будущий весенний переход Europe/Berlin (последнее воскресенье марта), не раньше чем
 * через 3 недели: понедельник недели перед переходом и воскресенье перехода.
 */
export function nextBerlinSpringShift(): { monday: string; sunday: string } {
  const now = new Date()
  for (let year = now.getUTCFullYear(); ; year++) {
    let sunday = `${year}-03-31`
    while (new Date(`${sunday}T00:00:00Z`).getUTCDay() !== 0) sunday = addDays(sunday, -1)
    const monday = addDays(sunday, -6)
    if (Date.parse(`${monday}T00:00:00Z`) > now.getTime() + 21 * DAY) return { monday, sunday }
  }
}
