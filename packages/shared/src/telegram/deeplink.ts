/** Telegram deeplinks (Task 4.9.2). start_param: ≤64 символа [A-Za-z0-9_-]. */
const START_PARAM_RE = /^[A-Za-z0-9_-]{1,64}$/
const USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/

export class DeeplinkConfigError extends Error {
  code = 'telegram.bot_username_missing'
  override name = 'DeeplinkConfigError'
}

export type StartParamKind = 'org' | 'event'

export function buildStartParam(kind: StartParamKind, value: string | number): string {
  const param = `${kind}_${value}`
  if (!START_PARAM_RE.test(param)) throw new Error(`Invalid start_param: ${param}`)
  return param
}

/** https://t.me/<bot>?start=<param>; пустое/некорректное имя бота — ошибка, а не битая ссылка. */
export function buildBotDeeplink(botUsername: string, startParam: string): string {
  const username = (botUsername ?? '').trim().replace(/^@/, '')
  if (!USERNAME_RE.test(username)) {
    throw new DeeplinkConfigError('TELEGRAM_BOT_USERNAME is not configured')
  }
  if (!START_PARAM_RE.test(startParam)) throw new Error(`Invalid start_param: ${startParam}`)
  return `https://t.me/${username}?start=${startParam}`
}

export function buildInviteDeeplink(botUsername: string, token: string): string {
  return buildBotDeeplink(botUsername, buildStartParam('org', token))
}

/** Ссылка «Поделиться в Telegram». */
export function buildShareUrl(url: string, text?: string): string {
  const sp = new URLSearchParams({ url })
  if (text) sp.set('text', text)
  return `https://t.me/share/url?${sp.toString()}`
}

/**
 * Извлечь токен приглашения из того, что вставил пользователь:
 * голый токен, `org_<token>`, `https://t.me/<bot>?start=org_<token>`, `/m/invite/<token>`.
 */
export function parseInviteInput(input: string): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  const fromStart = raw.match(/[?&]start(?:app)?=org_([A-Za-z0-9_-]+)/)
  if (fromStart) return fromStart[1]!
  const fromPath = raw.match(/\/invite\/([A-Za-z0-9_-]+)/)
  if (fromPath) return fromPath[1]!
  const prefixed = raw.match(/^org_([A-Za-z0-9_-]+)$/)
  if (prefixed) return prefixed[1]!
  return /^[A-Za-z0-9_-]{8,32}$/.test(raw) ? raw : null
}

export type StartTarget =
  { kind: 'invite'; token: string } | { kind: 'event'; eventId: number } | { kind: 'none' }

/** Разбор start_param Mini App (Task 8.8.3). */
export function resolveStartParam(param: string | null | undefined): StartTarget {
  const raw = (param ?? '').trim()
  if (!raw) return { kind: 'none' }
  const org = raw.match(/^org_([A-Za-z0-9_-]{1,40})$/)
  if (org) return { kind: 'invite', token: org[1]! }
  const event = raw.match(/^event_(\d{1,12})$/)
  if (event) return { kind: 'event', eventId: Number(event[1]) }
  return { kind: 'none' }
}
