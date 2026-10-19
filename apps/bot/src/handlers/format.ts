/** HTML-экранирование для parse_mode=HTML (названия событий и групп — пользовательский ввод). */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** «ср 28 мая, 20:00» в часовом поясе группы. */
export function formatWhen(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')}, ${get('hour')}:${get('minute')}`
}

/** Обрезка подписи кнопки (Telegram показывает ~30–40 символов). */
export function short(s: string, max = 32): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
