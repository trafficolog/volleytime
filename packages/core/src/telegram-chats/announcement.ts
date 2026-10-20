import { esc, type RenderedMessage } from '../notifier/templates'

export interface AnnouncementInput {
  title: string
  startsAt: Date
  timeZone: string
  /** Зал; без зала — название группы. */
  placeName: string
  capacity: number
  taken: number
  /** `https://t.me/<бот>?startapp=event_<id>` — единственный вид кнопок в групповом чате. */
  deeplink: string
}

/** «Ср · 28 мая · 20:00» в часовом поясе группы (макет «анонс „Записаться“»). */
export function formatAnnounceWhen(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const weekday = get('weekday')
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${get('day')} ${get('month')} · ${get('hour')}:${get('minute')}`
}

/**
 * Анонс события в чат группы (20.3.4): дата, место, «Свободно N из M мест» и две кнопки. В групповом
 * чате `web_app` не работает, поэтому обе кнопки — `url`-диплинки на Mini App (`startapp=event_<id>`);
 * кнопок действий над записью («Не смогу», «Беру место») в чате нет — они остаются в личном чате.
 * Текст строится из данных события на стороне web, пользовательские строки экранируются.
 */
export function buildEventAnnouncement(input: AnnouncementInput): RenderedMessage {
  const free = Math.max(0, input.capacity - input.taken)
  const seats = free > 0 ? `Свободно ${free} из ${input.capacity} мест.` : 'Мест нет.'
  return {
    text: [
      `<b>${esc(formatAnnounceWhen(input.startsAt, input.timeZone))}</b>`,
      esc(`${input.title} · ${input.placeName}`),
      `<i>${seats}</i>`,
    ].join('\n'),
    keyboard: [
      [{ text: 'Записаться', url: input.deeplink }],
      [{ text: 'Открыть тренировку', url: input.deeplink }],
    ],
  }
}
