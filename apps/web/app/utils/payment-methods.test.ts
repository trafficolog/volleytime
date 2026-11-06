import { describe, expect, it } from 'vitest'

import {
  NO_METHODS_TEXT,
  methodSubtitle,
  playerPaymentView,
  requisitesLine,
  requisitesPatch,
  validateRequisites,
  type PaymentMethodView,
} from './payment-methods'

const transfer = (extra: Partial<PaymentMethodView> = {}): PaymentMethodView => ({
  method: 'transfer',
  enabled: true,
  bank: 'Belarusbank',
  cardLast4: '3214',
  recipient: 'Иван П.',
  ...extra,
})
const cash = (enabled = true): PaymentMethodView => ({
  method: 'cash',
  enabled,
  bank: null,
  cardLast4: null,
  recipient: null,
})

describe('requisites', () => {
  it('words the requisites line and skips empty parts', () => {
    expect(requisitesLine(transfer())).toBe('Belarusbank · *3214 · Иван П.')
    expect(requisitesLine(transfer({ bank: null, recipient: null }))).toBe('*3214')
    expect(requisitesLine(transfer({ bank: null, cardLast4: null, recipient: null }))).toBe('')
  })

  it('shows requisites for the transfer subtitle and a hint without them', () => {
    expect(methodSubtitle(transfer())).toBe('Belarusbank · *3214 · Иван П.')
    expect(methodSubtitle(transfer({ bank: null, cardLast4: null, recipient: null }))).toContain(
      'Реквизиты показываются игроку',
    )
    expect(methodSubtitle(cash())).toContain('Касса обновляется')
  })

  it('validates the card tail, text length and full numbers', () => {
    expect(validateRequisites({ bank: '', cardLast4: '', recipient: '' })).toEqual({})
    expect(
      validateRequisites({ bank: 'Банк №5', cardLast4: '3214', recipient: 'Иван П.' }),
    ).toEqual({})
    expect(
      validateRequisites({ bank: '', cardLast4: '123', recipient: '' }).cardLast4,
    ).toBeDefined()
    expect(
      validateRequisites({ bank: '', cardLast4: '4111111111111111', recipient: '' }).cardLast4,
    ).toBeDefined()
    expect(
      validateRequisites({ bank: 'x'.repeat(101), cardLast4: '', recipient: '' }).bank,
    ).toContain('100')
    for (const value of [
      '4111 1111 1111 1111',
      '4111-1111-1111-1111',
      '123456789',
      '4111  1111  1111  1111',
      '4111 - 1111 - 1111 - 1111',
      '4111.1111.1111.1111',
      '4111/1111/1111/1111',
      '4111_1111_1111_1111',
      '4111–1111–1111–1111',
      '4111—1111—1111—1111',
      '４１１１１１１１１１１１１１１１',
      '４１１１ ４１１１ ４１１１ ４１１１',
      '٤١١١١١١١١١١١١١١١١',
      '4111  -  1111 . 1111 / 1111',
    ]) {
      expect(validateRequisites({ bank: value, cardLast4: '', recipient: '' }).bank).toContain(
        'Номер карты не принимается',
      )
      expect(validateRequisites({ bank: '', cardLast4: '', recipient: value }).recipient).toContain(
        'Номер карты не принимается',
      )
    }
    // граница: 8 цифр подряд ещё допустимы
    expect(validateRequisites({ bank: '12345678', cardLast4: '', recipient: '' })).toEqual({})
  })

  it('builds a patch of changed requisites only; an empty field clears the value', () => {
    expect(
      requisitesPatch(transfer(), { bank: 'Belarusbank', cardLast4: '3214', recipient: 'Иван П.' }),
    ).toEqual({})
    expect(
      requisitesPatch(transfer(), { bank: ' Приор ', cardLast4: '3214', recipient: '' }),
    ).toEqual({ bank: 'Приор', recipient: null })
    expect(requisitesPatch(cash(), { bank: '', cardLast4: '', recipient: '' })).toEqual({})
  })
})

describe('player payment view', () => {
  it('lists only enabled methods with requisites for the transfer', () => {
    const view = playerPaymentView([cash(false), transfer()])
    expect(view.fallback).toBeNull()
    expect(view.lines).toHaveLength(1)
    expect(view.lines[0]).toMatchObject({ method: 'transfer', title: 'Перевод на карту' })
    expect(view.lines[0]!.text).toContain('Belarusbank · *3214 · Иван П.')
  })

  it('asks to contact the organizer when the transfer has no requisites', () => {
    const view = playerPaymentView([transfer({ bank: null, cardLast4: null, recipient: null })])
    expect(view.lines[0]!.text).toContain('уточните у организатора')
  })

  it('explains how to pay when every method is off or the list is empty', () => {
    expect(playerPaymentView([cash(false), transfer({ enabled: false })])).toMatchObject({
      lines: [],
      fallback: NO_METHODS_TEXT,
    })
    expect(playerPaymentView([]).fallback).toBe(NO_METHODS_TEXT)
    expect(NO_METHODS_TEXT).toContain('Уточните у него')
  })
})
