export type Deeplink =
  | { kind: 'org_invite'; token: string }
  | { kind: 'event'; eventId: number; inviteToken?: string }
  | { kind: 'none' }

const ORG = /^org_([A-Za-z0-9_-]{1,40})$/
const EVENT = /^event_(\d{1,12})$/
/** Личное приглашение на событие (20.1.3): `event_<id>_<token>`, токен 16–40 символов. */
const EVENT_INVITE = /^event_(\d{1,12})_([A-Za-z0-9_-]{16,40})$/

/**
 * Парсит start_param бота в структурированный deeplink.
 * Форматы: org_<token> (приглашение в группу), event_<id>, event_<id>_<token> (приглашение на событие).
 * Формат тот же, что у `resolveStartParam` Mini App, — бот передаёт параметр дальше без изменений.
 */
export function parseDeeplink(startParam: string | undefined): Deeplink {
  if (!startParam) return { kind: 'none' }
  const org = startParam.match(ORG)
  if (org) return { kind: 'org_invite', token: org[1]! }
  const event = startParam.match(EVENT)
  if (event && Number(event[1]) > 0) return { kind: 'event', eventId: Number(event[1]) }
  const invited = startParam.match(EVENT_INVITE)
  if (invited && Number(invited[1]) > 0)
    return { kind: 'event', eventId: Number(invited[1]), inviteToken: invited[2]! }
  return { kind: 'none' }
}
