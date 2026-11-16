/** `callback_data` кнопки «Кто уже играет» (21.4.9): `rs:<id события>`, авторизация — в web по Telegram id. */
export const rosterAskData = (eventId: number) => `rs:${eventId}`
export const ROSTER_BUTTON = '👥 Кто уже играет'
export const ROSTER_MARK = '👥 Кто уже играет'
export const ROSTER_DENIED = 'Состав доступен участникам группы'
const ROSTER_MAX_LINES = 30

/** Ответ web `event-roster`: только имена и число мест, без username и прочих полей. */
export type RosterReply =
  | {
      result: 'ok'
      title: string
      startsAt: string
      timeZone: string
      capacity: number
      players: { name: string | null; seats: number }[]
    }
  | { result: 'not_found' }

/** Блок состава для дописывания к сообщению: имена и «+N» мест. */
export function buildRosterBlock(r: {
  capacity: number
  players: { name: string | null; seats: number }[]
}): string {
  const taken = r.players.reduce((sum, p) => sum + p.seats, 0)
  if (r.players.length === 0) return `${ROSTER_MARK}\nПока никто не записался.`
  const lines = r.players.slice(0, ROSTER_MAX_LINES).map((p, i) => {
    const extra = p.seats > 1 ? ` +${p.seats - 1}` : ''
    return `${i + 1}. ${p.name?.trim() || 'Игрок'}${extra}`
  })
  const rest = r.players.length - lines.length
  if (rest > 0) lines.push(`…и ещё ${rest}`)
  return `${ROSTER_MARK} (занято ${taken} из ${r.capacity})\n${lines.join('\n')}`
}
