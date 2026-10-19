import { describe, expect, it } from 'vitest'

import { isValidPayload, toInlineKeyboard } from './internal-server'

describe('internal notify — payload validation', () => {
  it('accepts valid payload', () => {
    expect(isValidPayload({ telegramId: '123', text: 'hi' })).toBe(true)
  })

  it('rejects missing telegramId', () => {
    expect(isValidPayload({ text: 'hi' })).toBe(false)
    expect(isValidPayload({ telegramId: '', text: 'hi' })).toBe(false)
  })

  it('rejects missing text', () => {
    expect(isValidPayload({ telegramId: '123' })).toBe(false)
  })

  it('rejects non-object', () => {
    expect(isValidPayload(null)).toBe(false)
    expect(isValidPayload('string')).toBe(false)
  })
})

describe('internal notify — keyboard conversion', () => {
  it('returns undefined for no keyboard', () => {
    expect(toInlineKeyboard(undefined)).toBeUndefined()
    expect(toInlineKeyboard([])).toBeUndefined()
  })

  it('converts webAppUrl button to web_app', () => {
    const kb = toInlineKeyboard([[{ text: 'Открыть', webAppUrl: 'https://vt.by/m/' }]])
    expect(kb?.inline_keyboard[0]?.[0]).toEqual({
      text: 'Открыть',
      web_app: { url: 'https://vt.by/m/' },
    })
  })

  it('converts url button to url', () => {
    const kb = toInlineKeyboard([[{ text: 'Сайт', url: 'https://vt.by' }]])
    expect(kb?.inline_keyboard[0]?.[0]).toEqual({ text: 'Сайт', url: 'https://vt.by' })
  })

  it('handles multiple rows', () => {
    const kb = toInlineKeyboard([
      [{ text: 'A', webAppUrl: 'https://a' }],
      [{ text: 'B', url: 'https://b' }],
    ])
    expect(kb?.inline_keyboard).toHaveLength(2)
  })
})

describe('internal notify — action buttons (20.3.3)', () => {
  it('converts callbackData to callback_data', () => {
    const kb = toInlineKeyboard([[{ text: 'Беру место', callbackData: 'oa:5' }]])
    expect(kb?.inline_keyboard[0]?.[0]).toEqual({ text: 'Беру место', callback_data: 'oa:5' })
  })

  it('accepts only known callback_data formats', () => {
    const p = (callbackData: string) => ({
      telegramId: '1',
      text: 'x',
      keyboard: [[{ text: 'b', callbackData }]],
    })
    expect(isValidPayload(p('cx:5'))).toBe(true)
    expect(isValidPayload(p('oa:5'))).toBe(true)
    expect(isValidPayload(p('cy:5'))).toBe(false)
    expect(isValidPayload(p('cx:5;x'))).toBe(false)
    expect(isValidPayload({ telegramId: '1', text: 'x', keyboard: 'nope' })).toBe(false)
    expect(
      isValidPayload({ telegramId: '1', text: 'x', keyboard: [[{ callbackData: 'cx:1' }]] }),
    ).toBe(false)
  })
})
