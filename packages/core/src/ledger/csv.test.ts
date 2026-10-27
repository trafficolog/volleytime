import { describe, expect, it } from 'vitest'

import { buildLedgerCsv, csvCell, formatCsvAmount } from './csv'

describe('ledger csv', () => {
  it('escapes formula injection, quotes and separators', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-1')).toBe("'-1")
    expect(csvCell('@cmd')).toBe("'@cmd")
    expect(csvCell('\tx')).toBe("'\tx")
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(csvCell(null)).toBe('')
  })

  it('formats minor units with comma decimals', () => {
    expect(formatCsvAmount(0)).toBe('0,00')
    expect(formatCsvAmount(5)).toBe('0,05')
    expect(formatCsvAmount(4250)).toBe('42,50')
    expect(formatCsvAmount(10_000_000)).toBe('100000,00')
  })

  it('builds a BOM-prefixed document with header and a direction column', () => {
    const csv = buildLedgerCsv(
      [
        {
          id: 1,
          type: 'income',
          category: 'contribution',
          amount: 1500,
          currency: 'BYN',
          description: '=HYPERLINK("x")',
          occurredAt: new Date('2026-05-28T10:00:00Z'),
          createdAt: new Date('2026-05-28T10:00:00Z'),
          method: 'cash',
          event: { id: 3, title: 'Основа', startsAt: new Date('2026-05-28T16:00:00Z') },
          author: { name: 'Орг', telegramUsername: null },
          payer: null,
        },
      ],
      'Europe/Minsk',
    )
    expect(csv.startsWith('﻿')).toBe(true)
    const [header, row] = csv.slice(1).split('\r\n')
    expect(header).toBe('Дата;Тип;Категория;Описание;Событие;Способ;Сумма;Валюта;Плательщик;Внёс')
    expect(row).toBe(
      '28.05.2026 13:00;Поступление;Взнос на аренду;"\'=HYPERLINK(""x"")";Основа;Наличные;15,00;BYN;;Орг',
    )
  })
})
