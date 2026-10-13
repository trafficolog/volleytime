import { createHash, createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { validateLoginWidgetData } from './login-widget'
import { TelegramAuthError } from './validate'

const BOT_TOKEN = '123456:WIDGET_TEST'

type Fields = Record<string, string | number>

/** Подпись по документации Login Widget: secret = SHA256(token). */
function signWidget(fields: Fields, token = BOT_TOKEN): Fields & { hash: string } {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n')
  const secret = createHash('sha256').update(token).digest()
  return { ...fields, hash: createHmac('sha256', secret).update(dcs).digest('hex') }
}

const nowSec = () => Math.floor(Date.now() / 1000)
const base = (): Fields => ({ id: 4242, first_name: 'Игрок', username: 'pl', auth_date: nowSec() })

describe('validateLoginWidgetData (19.3.1, D-05)', () => {
  it('accepts a valid signed payload and returns the telegram user', () => {
    const r = validateLoginWidgetData(signWidget(base()), BOT_TOKEN)
    expect(r.user.id).toBe(4242n)
    expect(r.user.first_name).toBe('Игрок')
    expect(r.user.username).toBe('pl')
  })

  it('accepts string values as sent by a query-string callback', () => {
    const signed = signWidget(base())
    const asStrings = Object.fromEntries(Object.entries(signed).map(([k, v]) => [k, String(v)]))
    expect(validateLoginWidgetData(asStrings, BOT_TOKEN).user.id).toBe(4242n)
  })

  it('includes unknown signed fields in the check string', () => {
    const r = validateLoginWidgetData(signWidget({ ...base(), extra: 'x' }), BOT_TOKEN)
    expect(r.user.id).toBe(4242n)
  })

  it('SECURITY: rejects a tampered id', () => {
    const signed = signWidget(base())
    expect(() => validateLoginWidgetData({ ...signed, id: 1 }, BOT_TOKEN)).toThrow(/signature/)
  })

  it('SECURITY: rejects a field added after signing', () => {
    const signed = signWidget(base())
    expect(() => validateLoginWidgetData({ ...signed, last_name: 'X' }, BOT_TOKEN)).toThrow(
      /signature/,
    )
  })

  it('SECURITY: rejects another bot token', () => {
    expect(() => validateLoginWidgetData(signWidget(base(), '999:OTHER'), BOT_TOKEN)).toThrow(
      /signature/,
    )
  })

  it('SECURITY: rejects data signed with the Mini App (WebAppData) algorithm', () => {
    const fields = base()
    const dcs = Object.keys(fields)
      .sort()
      .map((k) => `${k}=${fields[k]}`)
      .join('\n')
    const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
    const hash = createHmac('sha256', secret).update(dcs).digest('hex')
    expect(() => validateLoginWidgetData({ ...fields, hash }, BOT_TOKEN)).toThrow(/signature/)
  })

  it('SECURITY: empty bot token is a configuration error even for a matching signature', () => {
    expect(() => validateLoginWidgetData(signWidget(base(), ''), '')).toThrow(/not configured/)
    expect(() => validateLoginWidgetData(signWidget(base(), ''), '  ')).toThrow(TelegramAuthError)
  })

  it('rejects missing or malformed hash', () => {
    expect(() => validateLoginWidgetData(base(), BOT_TOKEN)).toThrow(TelegramAuthError)
    expect(() => validateLoginWidgetData({ ...base(), hash: 'zz' }, BOT_TOKEN)).toThrow(/signature/)
    expect(() => validateLoginWidgetData(null, BOT_TOKEN)).toThrow(TelegramAuthError)
  })

  it('rejects stale data after 1 hour by default and honours a configured max age', () => {
    const old = signWidget({ ...base(), auth_date: nowSec() - 3601 })
    expect(() => validateLoginWidgetData(old, BOT_TOKEN)).toThrow(/expired/)
    const fiveMin = signWidget({ ...base(), auth_date: nowSec() - 300 })
    expect(() => validateLoginWidgetData(fiveMin, BOT_TOKEN, { maxAgeSeconds: 120 })).toThrow(
      /expired/,
    )
    expect(validateLoginWidgetData(fiveMin, BOT_TOKEN, { maxAgeSeconds: 600 }).user.id).toBe(4242n)
  })

  it('rejects auth_date from the future and invalid auth_date', () => {
    expect(() =>
      validateLoginWidgetData(signWidget({ ...base(), auth_date: nowSec() + 600 }), BOT_TOKEN),
    ).toThrow(/future/)
    expect(() =>
      validateLoginWidgetData(signWidget({ ...base(), auth_date: 'abc' }), BOT_TOKEN),
    ).toThrow(/auth_date/)
  })

  it('rejects a signed payload without a valid user', () => {
    const noName = base()
    delete noName.first_name
    expect(() => validateLoginWidgetData(signWidget(noName), BOT_TOKEN)).toThrow(/Invalid user/)
    expect(() => validateLoginWidgetData(signWidget({ ...base(), id: -5 }), BOT_TOKEN)).toThrow(
      /Invalid user/,
    )
  })
})
