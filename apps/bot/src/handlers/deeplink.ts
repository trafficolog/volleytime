export type Deeplink =
  { kind: 'org_invite'; token: string } | { kind: 'event'; eventId: number } | { kind: 'none' }

/**
 * Парсит start_param бота в структурированный deeplink.
 * Форматы: org_<token> (приглашение), event_<id> (событие).
 */
export function parseDeeplink(startParam: string | undefined): Deeplink {
  if (!startParam) return { kind: 'none' }
  if (startParam.startsWith('org_')) {
    const token = startParam.slice(4)
    if (token.length > 0) return { kind: 'org_invite', token }
  }
  if (startParam.startsWith('event_')) {
    const id = Number(startParam.slice(6))
    if (Number.isInteger(id) && id > 0) return { kind: 'event', eventId: id }
  }
  return { kind: 'none' }
}
